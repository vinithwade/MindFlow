import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { MotionConfig } from 'framer-motion'
import { OverlayApp } from './OverlayApp'
import { ErrorBoundary } from './ErrorBoundary'
import { initSentry } from './sentry'

initSentry()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <OverlayApp />
      </MotionConfig>
    </ErrorBoundary>
  </React.StrictMode>
)
