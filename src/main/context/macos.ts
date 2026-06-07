import { execFile } from 'child_process'
import { promisify } from 'util'
import { clipboard } from 'electron'
import { SOURCE_DENYLIST, friendlyAppName } from './appName'

const execFileAsync = promisify(execFile)

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

async function osascript(script: string): Promise<string> {
  const { stdout } = await execFileAsync('osascript', ['-e', script], {
    timeout: 4000,
    maxBuffer: 1024 * 1024
  })
  return stdout.trim()
}

type FrontApp = { app: string; process: string; title: string }
const EMPTY_FRONT: FrontApp = { app: '', process: '', title: '' }
// Remember the last genuine foreground app, so a transient tool being frontmost
// at trigger time doesn't hijack the insertion target.
let lastRealFront: FrontApp | null = null

/** Frontmost application: friendly name, raw process name, and window title. */
export async function getFrontApp(): Promise<FrontApp> {
  const script = `
    tell application "System Events"
      set frontApp to first process whose frontmost is true
      set appName to name of frontApp
      set winTitle to ""
      try
        set winTitle to name of front window of frontApp
      end try
    end tell
    return appName & "||" & winTitle
  `
  try {
    const out = await osascript(script)
    const [app = '', title = ''] = out.split('||')
    // Ignore ourselves and transient screenshot tools: target the last real app.
    if (!app || SOURCE_DENYLIST.has(app)) return lastRealFront ?? EMPTY_FRONT
    const result: FrontApp = { app: friendlyAppName(app, title), process: app, title }
    lastRealFront = result
    return result
  } catch {
    return lastRealFront ?? EMPTY_FRONT
  }
}

/** Bring a process to the front by its System Events process name. */
export async function activateProcess(processName: string): Promise<void> {
  if (!processName) return
  const safe = processName.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  await osascript(`tell application "System Events" to set frontmost of process "${safe}" to true`)
}

/**
 * Selected text via the clipboard-copy trick: stash the user's clipboard, send
 * Cmd+C to the frontmost app (which still has focus — the overlay is shown
 * inactive), read what landed, then restore the original clipboard.
 * Returns null when nothing was selected.
 */
export async function getSelectedText(): Promise<string | null> {
  const original = clipboard.readText()
  const sentinel = `__mindflow_sentinel_${Date.now()}__`
  clipboard.writeText(sentinel)

  try {
    await osascript('tell application "System Events" to keystroke "c" using command down')
    await sleep(140)
    const copied = clipboard.readText()
    if (copied && copied !== sentinel && copied.trim().length > 0) {
      return copied.trim()
    }
    return null
  } catch {
    return null
  } finally {
    // Restore the user's clipboard regardless of outcome.
    clipboard.writeText(original)
  }
}

/**
 * Accessibility fallback: read AXSelectedText, then the value of the focused
 * UI element, from the frontmost process. Fragile across apps — wrapped in try.
 */
export async function getAccessibilityText(): Promise<string | null> {
  const script = `
    tell application "System Events"
      set frontApp to first process whose frontmost is true
      set theText to ""
      try
        set theText to value of attribute "AXSelectedText" of (value of attribute "AXFocusedUIElement" of frontApp)
      end try
      if theText is "" then
        try
          set theText to value of (value of attribute "AXFocusedUIElement" of frontApp)
        end try
      end if
    end tell
    return theText
  `
  try {
    const out = await osascript(script)
    return out && out.trim().length > 0 ? out.trim() : null
  } catch {
    return null
  }
}

/** Send Cmd+V to the frontmost app (used by the insertion layer). */
export async function sendPaste(): Promise<void> {
  await osascript('tell application "System Events" to keystroke "v" using command down')
}

/** Press Return in the frontmost app — used by "Send" to fire the message off. */
export async function sendEnter(): Promise<void> {
  await osascript('tell application "System Events" to key code 36')
}

/** Capture the active display to a PNG and return the file path (for OCR). */
export async function screenshotToFile(path: string): Promise<boolean> {
  try {
    // -x: no sound, -o: no shadow. Captures the main display.
    await execFileAsync('screencapture', ['-x', '-o', '-t', 'png', path], { timeout: 5000 })
    return true
  } catch {
    return false
  }
}

