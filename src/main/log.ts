import { app } from 'electron'
import { appendFileSync, statSync, writeFileSync } from 'fs'
import { join } from 'path'

/**
 * Tiny logger: info/debug are silenced in packaged builds (unless MINDFLOW_DEBUG=1),
 * while warn/error always print. In packaged builds warn/error ALSO append to
 * <userData>/main.log so field issues (e.g. on a user's Windows machine) are
 * diagnosable after the fact. Logging must never break the app — best-effort.
 */
const verbose = !app.isPackaged || process.env.MINDFLOW_DEBUG === '1'

const MAX_LOG_BYTES = 1024 * 1024 // start fresh when the log grows past ~1MB

let logPath: string | null | undefined // undefined = not initialised, null = unavailable
function fileLine(level: string, args: unknown[]): void {
  if (!app.isPackaged) return
  try {
    if (logPath === undefined) {
      logPath = join(app.getPath('userData'), 'main.log')
      try {
        if (statSync(logPath).size > MAX_LOG_BYTES) writeFileSync(logPath, '')
      } catch {
        /* no log file yet */
      }
    }
    if (!logPath) return
    const text = args
      .map((a) =>
        a instanceof Error ? a.stack ?? a.message : typeof a === 'string' ? a : JSON.stringify(a)
      )
      .join(' ')
    appendFileSync(logPath, `${new Date().toISOString()} [${level}] ${text}\n`)
  } catch {
    logPath = null // disable file logging rather than ever throwing
  }
}

export const log = {
  info: (...args: unknown[]): void => {
    if (verbose) console.log(...args)
  },
  warn: (...args: unknown[]): void => {
    console.warn(...args)
    fileLine('warn', args)
  },
  error: (...args: unknown[]): void => {
    console.error(...args)
    fileLine('error', args)
  }
}
