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
// The overlay is pinned to the RIGHT edge, vertically centered, on the active
// display; the card grows leftward from there. We remember which display.
let overlayDisplay: Electron.Display | null = null
const RIGHT_MARGIN = 16

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
    title: 'Voice Reply Assistant',
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
  // until the user interacts with it.
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  loadEntry(overlayWindow, 'overlay.html')
  return overlayWindow
}

/** Place the overlay at the right edge, vertically centered, for a given size. */
function positionOverlay(mode: OverlayMode, heightOverride?: number): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return
  const display = overlayDisplay ?? screen.getPrimaryDisplay()
  const { x: dx, y: dy, width: dw, height: dh } = display.workArea
  const w = OVERLAY_SIZES[mode].w
  // Clamp content-driven height so it never exceeds the screen.
  const h = Math.min(heightOverride ?? OVERLAY_SIZES[mode].h, dh - 24)
  // Right edge a fixed margin from the screen edge; vertically centered, so the
  // card grows leftward and stays centered as its height changes.
  const x = Math.round(dx + dw - w - RIGHT_MARGIN)
  const y = Math.round(dy + (dh - h) / 2)
  overlayWindow.setBounds({ x, y, width: w, height: h })
}

/** Show the overlay (pill size) at the right edge of the active display. */
export function showOverlayNearCursor(): void {
  const win = getOverlayWindow()
  // "Active display" = the one the cursor is on, so it appears where you work.
  overlayDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  currentMode = 'pill'
  positionOverlay('pill')
  win.showInactive()
}

/** Switch between pill and card (sets the width + a default height). */
export function setOverlayMode(mode: OverlayMode): void {
  currentMode = mode
  positionOverlay(mode)
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
