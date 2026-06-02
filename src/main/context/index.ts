import { ScreenContext } from '../../shared/types'
import { getFrontApp, getSelectedText, getAccessibilityText } from './macos'
import { ocrActiveScreen } from './ocr'

/** Cap captured content so we don't blow up the LLM prompt with a whole screen. */
const MAX_CONTENT = 4000

/**
 * Layer 2: build the `{ app, content }` context object by walking a graceful
 * degradation chain — selected text → accessibility text → (optional) OCR. The
 * first path that yields content wins; `source` records which one.
 *
 * OCR is OFF by default: it screenshots the screen (which pops the macOS
 * screenshot thumbnail and needs Screen Recording permission), so it's opt-in.
 *
 * macOS-first (V1). Windows parity (UI Automation) lands in M6.
 */
export async function captureContext(opts: { enableOcr?: boolean } = {}): Promise<ScreenContext> {
  const empty: ScreenContext = {
    app: '',
    appProcess: '',
    content: '',
    source: 'none',
    hadSelection: false
  }
  if (process.platform !== 'darwin') return empty

  // App detection runs in parallel with the selection probe.
  const [front, selected] = await Promise.all([getFrontApp(), getSelectedText()])
  const base = { app: front.app, appProcess: front.process }

  if (selected) {
    return { ...base, content: clamp(selected), source: 'selection', hadSelection: true }
  }

  const ax = await getAccessibilityText()
  if (ax) {
    return { ...base, content: clamp(ax), source: 'accessibility', hadSelection: false }
  }

  // Only screenshot when the user has explicitly enabled OCR.
  if (opts.enableOcr) {
    const ocr = await ocrActiveScreen()
    if (ocr) {
      return { ...base, content: clamp(ocr), source: 'ocr', hadSelection: false }
    }
  }

  // No content extracted — generation can still proceed from voice alone.
  return { ...base, content: '', source: 'none', hadSelection: false }
}

function clamp(text: string): string {
  return text.length > MAX_CONTENT ? text.slice(0, MAX_CONTENT) + '…' : text
}
