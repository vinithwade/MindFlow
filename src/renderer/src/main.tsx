import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { MotionConfig } from 'framer-motion'
import { App } from './App'
import { AuthProvider } from './auth'
import { ErrorBoundary } from './ErrorBoundary'
import { initSentry } from './sentry'

initSentry()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          <App />
        </AuthProvider>
      </MotionConfig>
    </ErrorBoundary>
  </React.StrictMode>
)
