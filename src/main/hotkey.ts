import { chmodSync } from 'fs'
import { dirname, join } from 'path'
import { app } from 'electron'
import { GlobalKeyboardListener, IGlobalKeyEvent } from 'node-global-key-listener'
import { Hotkey } from '../shared/types'
import { beginSession, endRecording } from './pipeline'
import { log } from './log'
import { labelFor, orderKeys, isSuppressible } from './hotkeyKeys'

/**
 * Global push-to-talk engine, built on node-global-key-listener — a low-level
 * Event Tap (macOS) that reports DOWN/UP for ANY key, including the Fn key that
 * Electron's globalShortcut cannot see. The same engine powers the
 * "press to record" UI: any single key (Fn) or multi-key combo works.
 */

let listener: GlobalKeyboardListener | null = null
let starting: Promise<void> | null = null

// Hold detection
let requiredKeys: string[] = []
let engaged = false
const downNow = new Set<string>()
// A real hold must exceed this to activate — filters accidental quick taps.
const MIN_HOLD_MS = 200
let holdTimer: ReturnType<typeof setTimeout> | null = null
let sessionStarted = false

// Capture (recording a new shortcut)
let capturing = false
let captureHeld = new Set<string>()
let captureMax: string[] = []
let captureResolve: ((hk: Hotkey | null) => void) | null = null
let captureTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Path to the MacKeyServer binary. In a packaged app it lives in
 * app.asar.unpacked (the library would otherwise resolve it inside app.asar,
 * which can't be executed); in dev we let the library resolve it from
 * node_modules.
 */
function macServerPath(): string | undefined {
  if (process.platform !== 'darwin' || !app.isPackaged) return undefined
  return join(
    process.resourcesPath,
    'app.asar.unpacked',
    'node_modules',
    'node-global-key-listener',
    'bin',
    'MacKeyServer'
  )
}

/** The bundled MacKeyServer ships without the execute bit — set it before use. */
function ensureExecutable(): void {
  try {
    let bin = macServerPath()
    if (!bin) {
      const pkgDir = dirname(require.resolve('node-global-key-listener/package.json'))
      bin =
        process.platform === 'darwin'
          ? join(pkgDir, 'bin', 'MacKeyServer')
          : join(pkgDir, 'bin', 'WinKeyServer.exe')
    }
    chmodSync(bin, 0o755)
  } catch {
    /* best-effort */
  }
}

async function ensureListener(): Promise<void> {
  if (listener) return
  if (starting) return starting
  starting = (async () => {
    ensureExecutable()
    const serverPath = macServerPath()
    const l = new GlobalKeyboardListener(
      serverPath
        ? { mac: { serverPath, onError: (c) => log.warn('[hotkey] keyserver error', c) } }
        : {}
    )
    await l.addListener(handleEvent)
    listener = l
  })()
  try {
    await starting
  } catch (err) {
    log.warn('[hotkey] global key listener failed to start:', (err as Error).message)
    listener = null
  } finally {
    starting = null
  }
}

function handleEvent(e: IGlobalKeyEvent): boolean | void {
  const name = e.name as string | undefined
  if (!name) return

  if (capturing) return handleCapture(e, name)

  if (e.state === 'DOWN') downNow.add(name)
  else downNow.delete(name)

  if (requiredKeys.length === 0) return
  const allDown = requiredKeys.every((k) => downNow.has(k))
  if (allDown && !engaged) {
    // Press detected — but only ACTIVATE once the hold passes MIN_HOLD_MS, so a
    // quick tap does nothing (true hold-to-talk).
    engaged = true
    sessionStarted = false
    if (holdTimer) clearTimeout(holdTimer)
    holdTimer = setTimeout(() => {
      holdTimer = null
      sessionStarted = true
      beginSession()
    }, MIN_HOLD_MS)
  } else if (!allDown && engaged) {
    engaged = false
    if (holdTimer) {
      clearTimeout(holdTimer)
      holdTimer = null
    }
    // Only stop+transcribe if a hold actually started a session; taps are ignored.
    if (sessionStarted) {
      sessionStarted = false
      endRecording()
    }
  }

  // While the app owns a single suppressible key (Fn / a function key), halt the
  // OS default for it — so pressing Fn opens OUR overlay, not the macOS emoji
  // picker / dictation. Only for single suppressible keys, never for modifiers
  // or letters, so normal typing and ⌘-shortcuts are untouched.
  if (requiredKeys.length === 1 && requiredKeys[0] === name && isSuppressible(name)) {
    return true
  }
}

/* ------------------------------ Hold control ------------------------------- */

export async function registerHotkey(hotkey: Hotkey): Promise<void> {
  requiredKeys = hotkey.keys
  engaged = false
  downNow.clear()
  await ensureListener()
  log.info(`[hotkey] push-to-talk = ${hotkey.label} [${hotkey.keys.join(', ')}]`)
}

export function unregisterHotkey(): void {
  requiredKeys = []
  engaged = false
  downNow.clear()
  if (listener) {
    try {
      listener.kill()
    } catch {
      /* ignore */
    }
    listener = null
  }
}

/* -------------------------------- Capture ---------------------------------- */

export async function captureHotkey(): Promise<Hotkey | null> {
  await ensureListener()
  if (!listener) return null

  // Cancel any in-flight capture.
  if (capturing) finalizeCapture(null)

  capturing = true
  captureHeld = new Set()
  captureMax = []

  return new Promise<Hotkey | null>((resolve) => {
    captureResolve = resolve
    // Safety timeout if the user never presses anything.
    captureTimer = setTimeout(() => finalizeCapture(null), 10000)
  })
}

export function cancelHotkeyCapture(): void {
  if (capturing) finalizeCapture(null)
}

function handleCapture(e: IGlobalKeyEvent, name: string): boolean {
  if (name === 'ESCAPE') {
    finalizeCapture(null)
    return true
  }
  if (e.state === 'DOWN') {
    captureHeld.add(name)
    if (captureHeld.size > captureMax.length) captureMax = orderKeys([...captureHeld])
  } else {
    captureHeld.delete(name)
    // When everything is released, the largest simultaneously-held set wins.
    if (captureHeld.size === 0 && captureMax.length > 0) {
      finalizeCapture({ keys: captureMax, label: labelFor(captureMax) })
    }
  }
  // Swallow keystrokes during capture so they don't trigger app side effects.
  return true
}

function finalizeCapture(result: Hotkey | null): void {
  capturing = false
  if (captureTimer) {
    clearTimeout(captureTimer)
    captureTimer = null
  }
  const resolve = captureResolve
  captureResolve = null
  captureHeld = new Set()
  captureMax = []
  resolve?.(result)
}
