import * as Sentry from '@sentry/electron/renderer'

/** Renderer crash reporting. No-op unless VITE_SENTRY_DSN is set at build time. */
export function initSentry(): void {
  if (!import.meta.env.VITE_SENTRY_DSN) return
  Sentry.init({})
}

export function reportError(error: unknown): void {
  if (!import.meta.env.VITE_SENTRY_DSN) return
  Sentry.captureException(error)
}
