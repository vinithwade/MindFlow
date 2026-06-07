import { app, ipcMain, session, shell, systemPreferences, nativeImage } from 'electron'
import { createServer, Server } from 'http'
import { join } from 'path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { IPC, AppSettings, PermissionKind } from '../shared/types'
import { getSettings, setSettings } from './settings'
import {
  createMainWindow,
  getOverlayWindow,
  getMainWindow,
  resizeOverlay
} from './windows'
import { getPermissionStatus, requestPermission } from './permissions'
import { log } from './log'
import { validateApiKey } from './validateKey'
import { getDashboard, getUsage, mergeReplies, clearHistory } from './history'
import { ReplyHistoryItem } from '../shared/types'
import { registerHotkey, unregisterHotkey, captureHotkey, cancelHotkeyCapture } from './hotkey'
import { warmPsHost, disposePsHost } from './winPowershell'
import { initAutoUpdater } from './updater'
import { initSentry } from './sentry'
import { createTray } from './tray'
import { setAppMenu } from './menu'
import {
  beginSession,
  endRecording,
  handleAudio,
  dismissSession,
  regenerateCurrent,
  insertReply,
  setAuthed,
  setCreditBalance
} from './pipeline'

/**
 * Main process: owns the global push-to-talk hotkey, the overlay lifecycle,
 * and the IPC surface. Also handles the `mindflow://` OAuth deep link.
 */

// Crash reporting first (no-op without a DSN), then safety nets.
initSentry()
process.on('uncaughtException', (err) => log.error('[main] uncaughtException:', err))
process.on('unhandledRejection', (reason) => log.error('[main] unhandledRejection:', reason))

const PROTOCOL = 'mindflow'
/** Candidate loopback ports for the OAuth redirect (allowlist all in Supabase). */
const AUTH_PORTS = [8765, 8766, 8767]
let authPort = AUTH_PORTS[0]
// The loopback only forwards a callback while an OAuth attempt is "armed".
let oauthArmed = false
let armTimer: ReturnType<typeof setTimeout> | null = null

function armOAuth(): void {
  oauthArmed = true
  if (armTimer) clearTimeout(armTimer)
  armTimer = setTimeout(() => (oauthArmed = false), 120_000)
}

/** Open-at-login only works in a real (packaged) app bundle. */
function applyLoginItem(open: boolean): void {
  if (!app.isPackaged) return
  try {
    app.setLoginItemSettings({ openAtLogin: open })
  } catch (e) {
    log.warn('[login-item]', (e as Error).message)
  }
}

/** Register the custom URL scheme (kept as a fallback OAuth redirect path). */
function registerProtocol(): void {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [join(process.argv[1])])
    }
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL)
  }
}

/** Forward an OAuth callback URL (loopback or deep link) to the renderer. */
function sendAuthCallback(url: string): void {
  if (!url) return
  const mw = getMainWindow() ?? createMainWindow()
  const send = (): void => mw.webContents.send(IPC.AUTH_CALLBACK, url)
  if (mw.webContents.isLoading()) mw.webContents.once('did-finish-load', send)
  else send()
  mw.show()
  mw.focus()
}

/**
 * Local loopback server that catches the Google OAuth redirect
 * (http://localhost:8765/auth-callback?code=…) and hands the code to the
 * renderer to complete the session. This is the recommended desktop OAuth flow.
 */
let authServer: Server | null = null
function startAuthServer(portIdx = 0): void {
  if (authServer || portIdx >= AUTH_PORTS.length) return
  const port = AUTH_PORTS[portIdx]
  const server = createServer((req, res) => {
    if (req.url && req.url.startsWith('/auth-callback')) {
      if (oauthArmed) {
        oauthArmed = false
        sendAuthCallback(`http://localhost:${port}${req.url}`)
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(
        '<!doctype html><html><body style="font-family:-apple-system,system-ui;text-align:center;padding-top:90px;color:#111">' +
          '<h2>✅ Signed in</h2><p style="color:#666">You can close this tab and return to MindFlow.</p>' +
          '</body></html>'
      )
    } else {
      res.writeHead(404)
      res.end()
    }
  })
  server.on('error', (e: NodeJS.ErrnoException) => {
    if (e.code === 'EADDRINUSE') {
      log.warn(`[auth] port ${port} busy, trying next`)
      startAuthServer(portIdx + 1) // fall back to the next allowlisted port
    } else {
      log.warn('[auth] loopback server error:', e.message)
    }
  })
  server.listen(port, '127.0.0.1', () => {
    authServer = server
    authPort = port
    log.info(`[auth] loopback listening on http://localhost:${port}`)
  })
}

// macOS delivers the deep link via open-url.
app.on('open-url', (event, url) => {
  event.preventDefault()
  sendAuthCallback(url)
})

// Single-instance: on Windows/Linux the deep link arrives as an argv on a 2nd launch.
if (!app.requestSingleInstanceLock()) {
  app.quit()
}
app.on('second-instance', (_e, argv) => {
  const url = argv.find((a) => a.startsWith(`${PROTOCOL}://`))
  if (url) sendAuthCallback(url)
  else getMainWindow()?.show()
})

function registerIpc(): void {
  ipcMain.handle(IPC.GET_SETTINGS, () => getSettings())

  ipcMain.handle(IPC.SET_SETTINGS, (_evt, partial: Partial<AppSettings>) => {
    const prev = getSettings()
    const next = setSettings(partial)
    // Re-arm the global hotkey only when the combo actually changed.
    if (JSON.stringify(next.hotkey) !== JSON.stringify(prev.hotkey)) {
      void registerHotkey(next.hotkey)
    }
    if (next.launchAtLogin !== prev.launchAtLogin) applyLoginItem(next.launchAtLogin)
    return next
  })

  // Record a new shortcut: capture the next key(s) the user presses+releases.
  ipcMain.handle(IPC.START_HOTKEY_CAPTURE, async () => {
    const hk = await captureHotkey()
    if (hk) setSettings({ hotkey: hk })
    // Re-arm so the new shortcut is live immediately, then return it.
    const next = getSettings()
    if (hk) void registerHotkey(next.hotkey)
    return hk
  })
  ipcMain.handle(IPC.CANCEL_HOTKEY_CAPTURE, () => cancelHotkeyCapture())

  // Renderer reports its measured content height → size the overlay to fit.
  ipcMain.on(IPC.RESIZE_OVERLAY, (_evt, height: number) => resizeOverlay(height))

  ipcMain.handle(IPC.OVERLAY_DISMISS, () => dismissSession())

  ipcMain.handle(IPC.GET_DASHBOARD, () => getDashboard())
  ipcMain.handle(IPC.GET_USAGE, () => getUsage())
  ipcMain.handle(IPC.OPEN_EXTERNAL, (_evt, url: string) => shell.openExternal(url))
  ipcMain.handle(IPC.OAUTH_BEGIN, () => armOAuth())
  ipcMain.handle(IPC.GET_AUTH_PORT, () => authPort)
  ipcMain.handle(IPC.SET_AUTHED, (_evt, v: boolean) => setAuthed(v))
  ipcMain.handle(IPC.SET_CREDIT_BALANCE, (_evt, v: number | null) => setCreditBalance(v))
  ipcMain.handle(IPC.MERGE_HISTORY, (_evt, items: ReplyHistoryItem[]) => mergeReplies(items))
  ipcMain.handle(IPC.CLEAR_HISTORY, () => clearHistory())
  ipcMain.handle(
    IPC.TEST_API_KEY,
    (_evt, p: { provider: 'openai' | 'anthropic' | 'deepgram'; key: string }) =>
      validateApiKey(p.provider, p.key)
  )
  ipcMain.handle(IPC.GET_PERMISSIONS, () => getPermissionStatus())
  ipcMain.handle(IPC.REQUEST_PERMISSION, async (_evt, kind: PermissionKind) => {
    await requestPermission(kind)
    return getPermissionStatus()
  })
  ipcMain.handle(IPC.OPEN_MAIN, () => {
    createMainWindow()
  })

  // Renderer hands back recorded audio (ArrayBuffer) → run the pipeline.
  ipcMain.handle(
    IPC.AUDIO_SUBMIT,
    async (_evt, payload: { buffer: ArrayBuffer; mimeType: string }) => {
      await handleAudio(Buffer.from(payload.buffer), payload.mimeType)
      return { ok: true }
    }
  )

  ipcMain.handle(IPC.OVERLAY_REGENERATE, async () => {
    await regenerateCurrent()
    return { ok: true }
  })

  ipcMain.handle(IPC.OVERLAY_INSERT, async (_evt, text: string) => {
    await insertReply(text)
    return { ok: true }
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.mindflow.app')

  // In dev the dock shows the generic Electron icon; set our MindFlow icon.
  // (Packaged builds get the icon from build/icon.icns via electron-builder.)
  if (process.platform === 'darwin' && !app.isPackaged) {
    const img = nativeImage.createFromPath(join(process.cwd(), 'build', 'icon-1024.png'))
    if (!img.isEmpty()) app.dock?.setIcon(img)
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Allow our renderer windows to use the microphone.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
    cb(permission === 'media')
  })
  // On macOS, trigger the OS-level microphone consent prompt early.
  if (process.platform === 'darwin') {
    void systemPreferences.askForMediaAccess('microphone').catch(() => undefined)
  }

  setAppMenu()
  createTray()
  registerProtocol()
  startAuthServer()
  registerIpc()
  const initial = getSettings()
  applyLoginItem(initial.launchAtLogin)
  void registerHotkey(initial.hotkey)

  // Windows: spawn + warm the PowerShell automation host so the first
  // context-capture/paste doesn't pay the cold-start cost. No-op on macOS.
  warmPsHost()

  // Warm up the overlay so the first invocation is instant.
  getOverlayWindow()
  createMainWindow()

  // Background auto-updates (packaged + signed builds only).
  initAutoUpdater()

  // Clicking the Dock icon opens/raises the Settings window (recreating it if
  // the user had closed it). The overlay window doesn't count as "a window".
  app.on('activate', () => {
    const mw = getMainWindow()
    if (!mw || mw.isDestroyed()) createMainWindow()
    else {
      mw.show()
      mw.focus()
    }
  })
})

app.on('will-quit', () => {
  unregisterHotkey()
  disposePsHost()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Re-exported for potential programmatic triggers/tests.
export { beginSession, endRecording }
