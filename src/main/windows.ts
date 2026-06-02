import { BrowserWindow, screen, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

/**
 * Window manager: one ordinary Settings/main window and one frameless,
 * transparent, always-on-top overlay that shows the generated reply near
 * the cursor (the "magical, instant, invisible" surface from the spec).
 */

let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null

/** The overlay grows from a vertical "pill" (listening) to a "card" (reply). */
export type OverlayMode = 'pill' | 'card'
const OVERLAY_SIZES: Record<OverlayMode, { w: number; h: number }> = {
  pill: { w: 60, h: 188 }, // slim, tall vertical capsule
  card: { w: 420, h: 480 } // portrait reply card
}
let currentMode: OverlayMode = 'pill'
// The overlay is anchored to the BOTTOM-RIGHT corner of the active display
// (Wispr-Flow-style, Dock-aware); the card grows up-and-left from there. We
// remember which display so it follows the cursor across monitors/Spaces.
let overlayDisplay: Electron.Display | null = null
const MARGIN = 16 // gap off the right and bottom edges of the work area

function rendererEntry(htmlFile: string): { url?: string; file?: string } {
  // In dev, electron-vite serves renderer entries from a dev server.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    return { url: `${process.env['ELECTRON_RENDERER_URL']}/${htmlFile}` }
  }
  return { file: join(__dirname, `../renderer/${htmlFile}`) }
}

function loadEntry(win: BrowserWindow, htmlFile: string): void {
  const entry = rendererEntry(htmlFile)
  if (entry.url) void win.loadURL(entry.url)
  else if (entry.file) void win.loadFile(entry.file)
}

export function createMainWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show()
    return mainWindow
  }

  mainWindow = new BrowserWindow({
    width: 720,
    height: 560,
    show: false,
    title: 'MindFlow',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  loadEntry(mainWindow, 'index.html')
  return mainWindow
}

export function getOverlayWindow(): BrowserWindow {
  if (overlayWindow && !overlayWindow.isDestroyed()) return overlayWindow

  overlayWindow = new BrowserWindow({
    width: OVERLAY_SIZES.pill.w,
    height: OVERLAY_SIZES.pill.h,
    show: false,
    frame: false,
    transparent: true,
    // 'panel' makes this an NSPanel. Critical on macOS: a normal window cannot
    // float over ANOTHER app's full-screen Space no matter what flags are set —
    // only a panel can join full-screen Spaces. This is what lets the overlay
    // appear over full-screen WhatsApp/Safari/etc.
    type: 'panel',
    // Programmatic resize (pill <-> card) needs resizable; frameless hides handles.
    resizable: true,
    movable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    fullscreenable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Float above full-screen apps too, and don't steal focus from the source app
  // until the user interacts with it. skipTransformProcessType avoids the Dock
  // flicker that setVisibleOnAllWorkspaces otherwise causes.
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  overlayWindow.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
    skipTransformProcessType: true
  })

  loadEntry(overlayWindow, 'overlay.html')
  return overlayWindow
}

/** Anchor the overlay to the bottom-right corner of the active display. */
function positionOverlay(mode: OverlayMode, heightOverride?: number): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return
  const display = overlayDisplay ?? screen.getPrimaryDisplay()
  // workArea excludes the Dock and menu bar, so anchoring inside it keeps us
  // above/beside the Dock automatically — never covering it (Dock-aware).
  const { x: dx, y: dy, width: dw, height: dh } = display.workArea
  const w = OVERLAY_SIZES[mode].w
  // Clamp content-driven height so it never exceeds the screen.
  const h = Math.min(heightOverride ?? OVERLAY_SIZES[mode].h, dh - 24)
  // Bottom-right corner, a fixed margin off both edges. Because both the right
  // and bottom are fixed, the card grows up-and-left from the corner as its
  // width (pill→card) and height change.
  const x = Math.round(dx + dw - w - MARGIN)
  const y = Math.round(dy + dh - h - MARGIN)
  overlayWindow.setBounds({ x, y, width: w, height: h })
}

/** Show the overlay (pill size) at the right edge of the active display. */
export function showOverlayNearCursor(): void {
  const win = getOverlayWindow()
  // "Active display" = the one the cursor is on, so it appears where you work.
  overlayDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  currentMode = 'pill'
  positionOverlay('pill')
  // Re-assert on every show: macOS gives each full-screen app its own Space, and
  // Electron drops these collection flags across hide/show cycles (we app.hide()
  // after each insert). Without re-applying, the overlay won't appear over a
  // full-screen app (e.g. WhatsApp full-screen) — only on the regular desktop.
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
    skipTransformProcessType: true
  })
  // showInactive (not show/focus) so we never switch the user's Space or steal
  // focus from the app they're replying to.
  win.showInactive()
}

/** Switch between pill and card (sets the width + a default height). */
export function setOverlayMode(mode: OverlayMode): void {
  currentMode = mode
  positionOverlay(mode)
  // When the reply card appears, take keyboard focus so the user can just hit
  // Enter to Send right away. During the pill/recording phase we stay inactive
  // so we never interrupt the source app; only the actionable card grabs focus.
  // The card's autoFocus'd draft then receives keystrokes immediately.
  if (mode === 'card' && overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.focus()
  }
}

/** Resize the overlay window to fit the renderer's measured content height. */
export function resizeOverlay(height: number): void {
  positionOverlay(currentMode, Math.max(80, Math.round(height)))
}

export function hideOverlay(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.hide()
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}
