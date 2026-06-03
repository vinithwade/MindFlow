import { useEffect, useState } from 'react'
import { Check, Loader2, RefreshCw } from 'lucide-react'
import type { CreditAccount } from '@shared/types'
import { fetchCredits, createPaymentLink } from './credits'
import { PLANS, TOPUPS, type PlanCard } from './plans'

/**
 * Billing / Plans page. Shows the current plan + balance, the subscription
 * plans and top-up packs. "Buy" asks the backend for a Razorpay payment link
 * and opens it in the system browser; the credits poll then reflects the
 * purchase once Razorpay's webhook credits the account.
 */
export function Billing(): JSX.Element {
  const [credits, setCredits] = useState<CreditAccount | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [waiting, setWaiting] = useState(false)
  const [error, setError] = useState('')

  const refresh = (): void => {
    void fetchCredits().then(setCredits)
  }
  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 4000)
    return () => clearInterval(id)
  }, [])

  async function buy(id: string): Promise<void> {
    setError('')
    setBusy(id)
    try {
      const res = await createPaymentLink(id)
      if (!res.url) {
        setError(res.error ?? 'Could not start checkout.')
        return
      }
      await window.api.openExternal(res.url)
      setWaiting(true)
    } finally {
      setBusy(null)
    }
  }

  const planLabel =
    credits?.plan === 'pro_plus' ? 'Pro+' : credits?.plan === 'pro' ? 'Pro' : 'Trial'

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold text-gray-900">Plans &amp; Billing</h1>
      <p className="mt-1 text-sm text-gray-500">Buy a plan or top up your credits.</p>

      {/* Current status */}
      <div className="mt-6 flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div>
          <div className="text-sm text-gray-500">Current plan</div>
          <div className="text-lg font-semibold text-gray-900">{planLabel}</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold text-gray-900">
            {credits ? credits.balance.toLocaleString() : '—'}
          </div>
          <div className="text-xs text-gray-400">
            credits left{credits ? ` of ${credits.monthlyGrant.toLocaleString()}` : ''}
          </div>
        </div>
      </div>

      {waiting && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="flex items-center gap-2">
            <Loader2 size={15} className="animate-spin" />
            Finish the payment in your browser — your credits update here automatically.
          </span>
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 rounded-lg bg-white/70 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-white"
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      {/* Plans */}
      <h3 className="mb-2 mt-7 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Plans (30-day passes)
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {PLANS.map((p) => (
          <PlanTile key={p.id} card={p} busy={busy === p.id} onBuy={() => void buy(p.id)} />
        ))}
      </div>

      {/* Top-ups */}
      <h3 className="mb-2 mt-7 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Credit top-ups (one-time)
      </h3>
      <div className="grid grid-cols-3 gap-4">
        {TOPUPS.map((p) => (
          <PlanTile key={p.id} card={p} compact busy={busy === p.id} onBuy={() => void buy(p.id)} />
        ))}
      </div>

      <p className="mt-6 text-xs text-gray-400">
        Payments are processed securely by Razorpay. Credits reset on renewal; top-ups add to your
        balance and don't expire until used.
      </p>
    </div>
  )
}

function PlanTile({
  card,
  compact,
  busy,
  onBuy
}: {
  card: PlanCard
  compact?: boolean
  busy: boolean
  onBuy: () => void
}): JSX.Element {
  return (
    <div
      className={`flex flex-col rounded-2xl border bg-white p-5 shadow-sm ${
        card.highlight ? 'border-accent ring-1 ring-accent/30' : 'border-gray-200'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-900">{card.name}</div>
        {card.highlight && (
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
            Best value
          </span>
        )}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-semibold text-gray-900">{card.price}</span>
        {card.cadence && <span className="text-xs text-gray-400">{card.cadence}</span>}
      </div>
      {!compact && (
        <p className="mt-1 flex items-start gap-1.5 text-xs text-gray-500">
          <Check size={13} className="mt-0.5 shrink-0 text-accent" />
          {card.tagline}
        </p>
      )}
      {compact && <p className="mt-1 text-xs text-gray-400">{card.tagline}</p>}
      <button
        onClick={onBuy}
        disabled={busy}
        className="mt-4 flex items-center justify-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-[13px] font-medium text-white transition hover:brightness-105 disabled:opacity-50"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : null}
        {busy ? 'Opening…' : 'Buy'}
      </button>
    </div>
  )
}
