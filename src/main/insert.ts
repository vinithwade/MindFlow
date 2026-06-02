import { app, clipboard } from 'electron'
import { hideOverlay } from './windows'
import { sendPaste, sendEnter, activateProcess } from './context/macos'

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * Layer 5: "Send" the reply into the source app — paste it at the cursor, then
 * press Return so it's sent in one click.
 *
 * The hard part is focus. Clicking "Send" (or pressing ⏎) makes OUR app
 * frontmost, so a naive Cmd+V would paste into the overlay. We:
 *   1. put the reply on the clipboard,
 *   2. hide the overlay (and the rest of our app),
 *   3. RE-ACTIVATE the exact app we captured at trigger time (by process name),
 *      which restores its text caret — far more reliable than app.hide() + hope,
 *   4. send Cmd+V so it pastes at the cursor,
 *   5. press Return to send the message,
 *   6. restore the user's original clipboard after the paste lands.
 *
 * When the captured content was a selection, the paste replaces it in place.
 */
export async function insertText(text: string, appProcess?: string): Promise<void> {
  if (process.platform !== 'darwin') return

  const original = clipboard.readText()
  clipboard.writeText(text)

  // Hide ALL of MindFlow (overlay + dashboard), not just the overlay. Clicking
  // Insert made us the active app; hiding only the overlay would let our own
  // Settings window flash forward. app.hide() yields focus toward the prior app.
  hideOverlay()
  app.hide()

  // Then pin focus to the exact app the user triggered from, so the paste lands
  // there even if it wasn't the immediately-prior app.
  if (appProcess) {
    try {
      await activateProcess(appProcess)
    } catch {
      /* app.hide() already relinquished our focus */
    }
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
}
