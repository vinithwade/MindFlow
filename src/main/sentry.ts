import * as Sentry from '@sentry/electron/main'

/**
 * Crash/error reporting (main process). No-op unless a DSN is provided at build
 * time via MAIN_VITE_SENTRY_DSN (electron-vite inlines it). The renderer inits
 * its own @sentry/electron/renderer and reports through this main process.
 */
export function initSentry(): void {
  const env = import.meta.env as unknown as Record<string, string | undefined>
  const dsn = env.MAIN_VITE_SENTRY_DSN
  if (!dsn) return
  Sentry.init({ dsn, tracesSampleRate: 0 })
}
