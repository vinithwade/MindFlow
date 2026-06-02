import { app } from 'electron'

/**
 * Tiny logger: info/debug are silenced in packaged builds (unless MINDFLOW_DEBUG=1),
 * while warn/error always print. Keeps production logs quiet without losing
 * real problems.
 */
const verbose = !app.isPackaged || process.env.MINDFLOW_DEBUG === '1'

export const log = {
  info: (...args: unknown[]): void => {
    if (verbose) console.log(...args)
  },
  warn: (...args: unknown[]): void => console.warn(...args),
  error: (...args: unknown[]): void => console.error(...args)
}
