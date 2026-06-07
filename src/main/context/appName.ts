/**
 * Shared app-naming helpers used by both the macOS and Windows context
 * implementations: the source-app denylist and the friendly-name mapping
 * (including browser-tab sniffing).
 */

/**
 * Processes that must never be recorded as the "source app" to paste into:
 * MindFlow itself (Electron in dev), and the OS's transient screenshot tools.
 * If one of these is frontmost when the user triggers, we fall back to the
 * last real app instead of re-activating it on insert (which would flash a
 * screenshot/Finder window forward instead of the page they're replying to).
 */
export const SOURCE_DENYLIST = new Set([
  // Us
  'Electron', // dev (mac process name)
  'electron', // dev (win process name)
  'MindFlow', // packaged
  // macOS screenshot tools
  'screencaptureui', // Cmd-Shift-4/5 interactive screenshot UI
  'Screenshot', // Screenshot.app
  'Screencapture',
  // Windows screenshot / shell surfaces
  'SnippingTool',
  'Snipping Tool',
  'ScreenClippingHost',
  'ShellExperienceHost'
])

/** Map raw process names to friendlier surface names; sniff browser tabs by title. */
export function friendlyAppName(app: string, title: string): string {
  const t = title.toLowerCase()
  const browsers = [
    // macOS app names
    'Google Chrome',
    'Safari',
    'Arc',
    'Brave Browser',
    'Microsoft Edge',
    'Firefox',
    // Windows process names
    'chrome',
    'msedge',
    'firefox',
    'brave',
    'arc',
    'opera'
  ]
  if (browsers.includes(app)) {
    if (t.includes('twitter') || t.includes('/ x') || t.endsWith(' / x')) return 'Twitter/X'
    if (t.includes('linkedin')) return 'LinkedIn'
    if (t.includes('gmail') || t.includes('mail')) return 'Email'
    if (t.includes('discord')) return 'Discord'
    if (t.includes('whatsapp')) return 'WhatsApp'
    if (t.includes('slack')) return 'Slack'
  }
  const map: Record<string, string> = {
    // macOS
    Mail: 'Email',
    'Microsoft Outlook': 'Email',
    // Windows process names
    olk: 'Email', // new Outlook
    OUTLOOK: 'Email',
    Slack: 'Slack',
    slack: 'Slack',
    Discord: 'Discord',
    WhatsApp: 'WhatsApp',
    Notepad: 'Notepad',
    notepad: 'Notepad'
  }
  return map[app] ?? app
}
