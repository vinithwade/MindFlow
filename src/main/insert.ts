import { clipboard } from 'electron'
import { relinquishFocus } from './windows'
import { sendPaste, sendEnter, activateProcess } from './context/platform'

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * Layer 5: "Send" the reply into the source app — paste it at the cursor, then
 * press Return so it's sent in one click.
 *
 * The hard part is focus. Clicking "Send" (or pressing ⏎) makes OUR app
 * frontmost, so a naive paste would land in the overlay. We:
 *   1. put the reply on the clipboard,
 *   2. hide our windows / yield focus (relinquishFocus — app.hide() on macOS),
 *   3. RE-ACTIVATE the exact app we captured at trigger time (by process name
 *      on macOS, by PID on Windows), which restores its text caret — far more
 *      reliable than hide + hope,
 *   4. send Cmd+V / Ctrl+V so it pastes at the cursor,
 *   5. press Return/Enter to send the message,
 *   6. restore the user's original clipboard after the paste lands.
 *
 * When the captured content was a selection, the paste replaces it in place.
 *
 * Returns true when the reply was pasted+sent. Returns false WITHOUT pasting if
 * we had a captured source app but couldn't re-focus it — pasting blind would
 * fire the reply into whatever app happens to be frontmost (worst case: sending
 * a message to the wrong person). In that case the reply is left on the clipboard
 * so the caller can tell the user to paste it manually.
 */
export async function insertText(text: string, appProcess?: string): Promise<boolean> {
  if (process.platform !== 'darwin' && process.platform !== 'win32') return false

  const original = clipboard.readText()
  clipboard.writeText(text)

  // Hide ALL of MindFlow (overlay + dashboard), not just the overlay. Clicking
  // Insert made us the active app; hiding only the overlay would let our own
  // Settings window flash forward.
  relinquishFocus()

  // Then pin focus to the exact app the user triggered from, so the paste lands
  // there even if it wasn't the immediately-prior app.
  if (appProcess) {
    let refocused = true
    try {
      await activateProcess(appProcess)
    } catch {
      refocused = false
    }
    // Re-activation failed: do NOT paste/Enter into an unknown frontmost app.
    // Leave the reply on the clipboard (skip the restore below) for manual paste.
    if (!refocused) return false
  }

  // Give the target app a moment to become frontmost and restore its caret.
  await sleep(110)

  try {
    await sendPaste()
    // "Send": after the paste lands, press Return to fire the message off in the
    // same click (Enter sends in chat apps like WhatsApp/Slack/iMessage/X).
    await sleep(70)
    await sendEnter()
  } finally {
    // Wait for the paste to consume the clipboard before restoring it.
    await sleep(250)
    clipboard.writeText(original)
  }
  return true
}
