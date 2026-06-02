import { app, clipboard } from 'electron'
import { hideOverlay } from './windows'
import { sendPaste, activateProcess } from './context/macos'

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * Layer 5: insert the reply into the source app at the cursor.
 *
 * The hard part is focus. Clicking "Insert" (or pressing ⏎) makes OUR app
 * frontmost, so a naive Cmd+V would paste into the overlay. We:
 *   1. put the reply on the clipboard,
 *   2. hide the overlay,
 *   3. RE-ACTIVATE the exact app we captured at trigger time (by process name),
 *      which restores its text caret — far more reliable than app.hide() + hope,
 *   4. send Cmd+V so it pastes at the cursor,
 *   5. restore the user's original clipboard after the paste lands.
 *
 * When the captured content was a selection, the paste replaces it in place.
 */
export async function insertText(text: string, appProcess?: string): Promise<void> {
  if (process.platform !== 'darwin') return

  const original = clipboard.readText()
  clipboard.writeText(text)

  hideOverlay()

  // Return focus to the app the user triggered from, so the paste lands there.
  if (appProcess) {
    try {
      await activateProcess(appProcess)
    } catch {
      app.hide() // fallback: at least relinquish our focus
    }
  } else {
    app.hide()
  }

  // Give the target app a moment to become frontmost and restore its caret.
  await sleep(220)

  try {
    await sendPaste()
  } finally {
    // Wait for the paste to consume the clipboard before restoring it.
    await sleep(450)
    clipboard.writeText(original)
  }
}
