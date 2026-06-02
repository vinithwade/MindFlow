import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ReplySession } from '@shared/types'
import { useRecorder } from './useRecorder'
import { Waveform } from './Waveform'

/**
 * Floating overlay. A slim vertical "pill" while capturing (mic-reactive
 * waveform), expanding into a "card" when the reply is ready. The window is
 * sized by main (pill/card); framer-motion handles the expand + slide-in.
 */
export function OverlayApp(): JSX.Element {
  const [session, setSession] = useState<ReplySession | null>(null)
  const [draft, setDraft] = useState('')

  useRecorder()

  useEffect(() => {
    const off = window.api.onSessionUpdate((s) => {
      setSession(s)
      if (s.status === 'ready' && s.result?.reply) setDraft(s.result.reply)
      if (s.status === 'listening') setDraft('')
    })
    return off
  }, [])

  const status = session?.status
  const isCard = status === 'ready' || status === 'error'

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') void window.api.dismissOverlay()
      if (!isCard) return
      if (e.key === 'Enter' && !e.shiftKey && draft.trim()) {
        e.preventDefault()
        void window.api.insert(draft)
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r') {
        e.preventDefault()
        void window.api.regenerate()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isCard, draft])

  return (
    <div className="h-screen w-screen overflow-hidden p-2 font-sans">
      {/* Keyed by session id so the slide-in replays on every invocation. */}
      <motion.div
        key={session?.id ?? 'idle'}
        initial={{ x: 60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="h-full w-full"
      >
        <motion.div
          layout
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className={`flex h-full w-full flex-col overflow-hidden rounded-[22px] border border-black/5 shadow-glass backdrop-blur-2xl ${
            isCard ? 'bg-white' : 'bg-panel'
          }`}
        >
          <AnimatePresence mode="wait" initial={false}>
            {isCard ? (
              <CardView
                key="card"
                session={session as ReplySession}
                draft={draft}
                onDraftChange={setDraft}
              />
            ) : (
              <PillView key="pill" session={session} />
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  )
}

/* ----------------------------- Pill (capturing) ---------------------------- */

function PillView({ session }: { session: ReplySession | null }): JSX.Element {
  const status = session?.status
  const listening = status === 'listening'
  // After Fn is released we're transcribing/generating — show a loader, not the
  // same listening waveform, so the state change is obvious.
  const loading = status === 'transcribing' || status === 'thinking'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
      className="flex h-full flex-col items-center justify-center gap-4"
    >
      <MicDot pulsing={listening} />
      {loading ? (
        <Spinner />
      ) : (
        <Waveform active={listening} orientation="vertical" bars={13} />
      )}
    </motion.div>
  )
}

/** Loading ring shown while transcribing / generating (after Fn is released). */
function Spinner(): JSX.Element {
  return (
    <span className="h-6 w-6 animate-spin rounded-full border-2 border-accent/25 border-t-accent" />
  )
}

function MicDot({ pulsing }: { pulsing: boolean }): JSX.Element {
  return (
    <span className="relative flex h-3 w-3 items-center justify-center">
      {pulsing && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/60" />
      )}
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
    </span>
  )
}

/* ------------------------------ Card (reply) ------------------------------- */

function CardView({
  session,
  draft,
  onDraftChange
}: {
  session: ReplySession
  draft: string
  onDraftChange: (v: string) => void
}): JSX.Element {
  const error = session.status === 'error'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      className="flex h-full flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className={`h-2 w-2 rounded-full ${error ? 'bg-rose-500' : 'bg-accent'}`} />
          <span className="max-w-[300px] truncate">
            {error ? 'Something went wrong' : `Replying in ${session.context.app || 'app'}`}
          </span>
        </div>
        <Kbd onClick={() => void window.api.dismissOverlay()}>Esc</Kbd>
      </div>

      <div className="mx-4 h-px bg-black/10" />

      {/* Body */}
      <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
        {error ? (
          <p className="text-sm text-rose-600">{session.error ?? 'Unknown error.'}</p>
        ) : (
          <>
            {session.transcript && (
              <p className="text-xs italic text-gray-400">“{session.transcript}”</p>
            )}
            <ContextBadge context={session.context} />
            <textarea
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              rows={4}
              className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-gray-900 outline-none placeholder:text-gray-400"
              placeholder="Your reply…"
              autoFocus
            />
          </>
        )}
      </div>

      {/* Actions */}
      {!error && (
        <>
          <div className="mx-4 h-px bg-black/10" />
          <div className="flex items-center gap-2 px-4 py-3">
            <button
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-white transition hover:brightness-105 disabled:opacity-40"
              disabled={!draft.trim()}
              onClick={() => void window.api.insert(draft)}
            >
              Send <Kbd inline>⏎</Kbd>
            </button>
            <ActionButton onClick={() => void window.api.regenerate()}>
              Regenerate <Kbd inline>⌘R</Kbd>
            </ActionButton>
            <ActionButton onClick={() => void navigator.clipboard.writeText(draft)}>
              Copy
            </ActionButton>
            <div className="flex-1" />
            <ActionButton subtle onClick={() => void window.api.dismissOverlay()}>
              Dismiss
            </ActionButton>
          </div>
        </>
      )}
    </motion.div>
  )
}

function ContextBadge({ context }: { context: ReplySession['context'] }): JSX.Element {
  const captured = context.source !== 'none' && context.content.trim().length > 0
  if (!captured) {
    return (
      <p className="text-xs text-amber-600">
        ⚠️ No screen content captured — replying from your voice only.
      </p>
    )
  }
  const label =
    context.source === 'selection'
      ? 'highlighted selection'
      : context.source === 'accessibility'
        ? 'on-screen text'
        : 'screenshot (OCR)'
  return (
    <details className="text-xs text-accent">
      <summary className="cursor-pointer list-none select-none">
        ✅ Saw {context.app || 'the screen'} · via {label}
        <span className="text-accent/60"> — view</span>
      </summary>
      <pre className="mt-1.5 max-h-24 overflow-y-auto whitespace-pre-wrap rounded-md bg-black/[0.04] p-2 text-[11px] leading-snug text-gray-600">
        {context.content}
      </pre>
    </details>
  )
}

/* ------------------------------- Primitives -------------------------------- */

function ActionButton({
  children,
  onClick,
  subtle
}: {
  children: React.ReactNode
  onClick: () => void
  subtle?: boolean
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium transition ${
        subtle
          ? 'text-gray-400 hover:text-gray-700'
          : 'bg-black/[0.05] text-gray-700 hover:bg-black/[0.09]'
      }`}
    >
      {children}
    </button>
  )
}

function Kbd({
  children,
  inline,
  onClick
}: {
  children: React.ReactNode
  inline?: boolean
  onClick?: () => void
}): JSX.Element {
  return (
    <kbd
      onClick={onClick}
      className={`rounded ${inline ? 'bg-white/25 px-1' : 'cursor-pointer bg-black/[0.05] px-1.5 py-0.5 hover:bg-black/10'} text-[11px] font-medium text-gray-500`}
    >
      {children}
    </kbd>
  )
}
