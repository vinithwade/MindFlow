import { Component, ErrorInfo, ReactNode } from 'react'
import { reportError } from './sentry'

/**
 * Catches render-time errors so a single component failure shows a recoverable
 * fallback instead of a blank white window. (Sentry reporting is wired in C1.)
 */
interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[renderer] uncaught error:', error, info.componentStack)
    reportError(error)
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-canvas p-8 text-center font-sans">
        <div className="text-2xl">⚠️</div>
        <h1 className="text-base font-semibold text-gray-900">Something went wrong</h1>
        <p className="max-w-sm text-sm text-gray-500">
          The app hit an unexpected error. Reloading usually fixes it.
        </p>
        <pre className="max-h-24 max-w-sm overflow-auto rounded-lg bg-gray-100 p-2 text-left text-[11px] text-gray-500">
          {this.state.error.message}
        </pre>
        <button
          onClick={() => window.location.reload()}
          className="mt-1 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-105"
        >
          Reload
        </button>
      </div>
    )
  }
}
