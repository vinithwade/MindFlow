import { tmpdir } from 'os'
import { join } from 'path'
import { unlink } from 'fs/promises'
import { screenshotToFile } from './macos'

/**
 * OCR fallback (last resort): screenshot the active display and run Tesseract.
 * Lazy-loaded so a missing/incompatible tesseract.js never breaks startup — if
 * it fails, we simply return null and the pipeline proceeds context-light.
 * Note: full-screen OCR is coarse; selection/accessibility paths are preferred.
 */
export async function ocrActiveScreen(): Promise<string | null> {
  const path = join(tmpdir(), `vra_shot_${Date.now()}.png`)
  const ok = await screenshotToFile(path)
  if (!ok) return null

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Tesseract = require('tesseract.js')
    const { data } = await Tesseract.recognize(path, 'eng')
    const text: string = (data?.text ?? '').trim()
    return text.length > 0 ? text : null
  } catch (err) {
    console.warn('[ocr] unavailable:', (err as Error).message)
    return null
  } finally {
    void unlink(path).catch(() => undefined)
  }
}
