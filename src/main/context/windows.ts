import { clipboard, desktopCapturer, screen } from 'electron'
import { writeFile } from 'fs/promises'
import { runPs } from '../winPowershell'
import { SOURCE_DENYLIST, friendlyAppName } from './appName'

/**
 * Windows implementations of the context/automation primitives, mirroring
 * ./macos.ts exactly. AppleScript becomes PowerShell (persistent warm host —
 * see ../winPowershell.ts): Win32 for the foreground window, SendKeys for
 * keystrokes, UI Automation for focused-element text, WScript AppActivate +
 * SetForegroundWindow for re-focusing the source app.
 */

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

type FrontApp = { app: string; process: string; title: string }
const EMPTY_FRONT: FrontApp = { app: '', process: '', title: '' }
// Remember the last genuine foreground app, so a transient tool being frontmost
// at trigger time doesn't hijack the insertion target (same as macOS).
let lastRealFront: FrontApp | null = null

/**
 * Frontmost application. `process` is "<pid>|<processName>" — the PID makes
 * re-activation reliable (process names aren't unique; think multiple Chrome
 * profiles), while the name keeps logs readable.
 */
export async function getFrontApp(): Promise<FrontApp> {
  const cmd =
    '$h=[MFWin32]::GetForegroundWindow(); ' +
    '$sb=New-Object System.Text.StringBuilder 512; ' +
    '[void][MFWin32]::GetWindowText($h,$sb,512); ' +
    '$procId=[uint32]0; [void][MFWin32]::GetWindowThreadProcessId($h,[ref]$procId); ' +
    "$p=Get-Process -Id $procId -ErrorAction SilentlyContinue; " +
    "Write-Output ($p.ProcessName + '||' + $sb.ToString() + '||' + $procId)"
  try {
    const out = await runPs(cmd)
    const [name = '', title = '', pid = ''] = out.split('||')
    // Ignore ourselves and transient screenshot tools: target the last real app.
    if (!name || SOURCE_DENYLIST.has(name)) return lastRealFront ?? EMPTY_FRONT
    const result: FrontApp = {
      app: friendlyAppName(name, title),
      process: `${pid}|${name}`,
      title
    }
    lastRealFront = result
    return result
  } catch {
    return lastRealFront ?? EMPTY_FRONT
  }
}

/** Bring the source app back to the front. Accepts the "<pid>|<name>" token. */
export async function activateProcess(processToken: string): Promise<void> {
  if (!processToken) return
  const pid = parseInt(processToken, 10)
  if (!Number.isFinite(pid) || pid <= 0) return
  // AppActivate (by PID) plus a Win32 fallback: restore if minimized, then
  // SetForegroundWindow — covers the cases where AppActivate alone is refused
  // by the foreground-lock rules.
  const cmd =
    `$p=Get-Process -Id ${pid} -ErrorAction SilentlyContinue; ` +
    'if($p -and $p.MainWindowHandle -ne 0){ ' +
    'if([MFWin32]::IsIconic($p.MainWindowHandle)){ [void][MFWin32]::ShowWindow($p.MainWindowHandle,9) }; ' +
    '[void][MFWin32]::SetForegroundWindow($p.MainWindowHandle) }; ' +
    `$ws=New-Object -ComObject WScript.Shell; [void]$ws.AppActivate(${pid})`
  await runPs(cmd)
}

/**
 * Selected text via the clipboard-copy trick (same pattern as macOS): stash the
 * user's clipboard, send Ctrl+C to the frontmost app (which still has focus —
 * the overlay is shown inactive), read what landed, restore the original.
 * Returns null when nothing was selected.
 */
export async function getSelectedText(): Promise<string | null> {
  const original = clipboard.readText()
  const sentinel = `__mindflow_sentinel_${Date.now()}__`
  clipboard.writeText(sentinel)

  try {
    await runPs("[System.Windows.Forms.SendKeys]::SendWait('^c')")
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
 * UI Automation fallback (the Windows analogue of AXSelectedText): read the
 * focused element's selected text via TextPattern, else its ValuePattern value,
 * else the TextPattern document text. Fragile across apps — wrapped in try.
 */
export async function getAccessibilityText(): Promise<string | null> {
  const cmd =
    '$t=$null; $ae=[System.Windows.Automation.AutomationElement]::FocusedElement; ' +
    'if($ae){ $tp=$null; ' +
    'if($ae.TryGetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern,[ref]$tp)){ ' +
    '$sel=$tp.GetSelection(); if($sel -and $sel.Length -gt 0){ $t=$sel[0].GetText(100000) }; ' +
    'if(-not $t){ $t=$tp.DocumentRange.GetText(100000) } }; ' +
    'if(-not $t){ $vp=$null; ' +
    'if($ae.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern,[ref]$vp)){ ' +
    '$t=$vp.Current.Value } } }; ' +
    'if($t){ Write-Output $t }'
  try {
    const out = await runPs(cmd)
    return out && out.trim().length > 0 ? out.trim() : null
  } catch {
    return null
  }
}

/** Send Ctrl+V to the frontmost app (used by the insertion layer). */
export async function sendPaste(): Promise<void> {
  await runPs("[System.Windows.Forms.SendKeys]::SendWait('^v')")
}

/** Press Enter in the frontmost app — used by "Send" to fire the message off. */
export async function sendEnter(): Promise<void> {
  await runPs("[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')")
}

/**
 * Capture the active display to a PNG (for OCR) via Electron desktopCapturer —
 * no external binary, and Windows needs no screen-recording permission.
 */
export async function screenshotToFile(path: string): Promise<boolean> {
  try {
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    const { width, height } = display.size
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.round(width * display.scaleFactor),
        height: Math.round(height * display.scaleFactor)
      }
    })
    const source =
      sources.find((s) => s.display_id === String(display.id)) ?? sources[0]
    if (!source || source.thumbnail.isEmpty()) return false
    await writeFile(path, source.thumbnail.toPNG())
    return true
  } catch {
    return false
  }
}
