import { useEffect, useState } from 'react'
import { Zap, Sparkles, AppWindow } from 'lucide-react'
import type { CreditAccount, Usage as UsageData, ReplyHistoryItem } from '@shared/types'
import { fetchCredits } from './credits'

/**
 * Usage & Credits dashboard — "bar + breakdown" layout:
 * a credits progress bar, tier/app breakdown cards, a 30-day trend, and a
 * recent-usage list. Reads usage from local history (IPC) and the authoritative
 * balance from Supabase (read-only; the gateway writes it).
 */
export function Usage({ onManage }: { onManage: () => void }): JSX.Element {
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [credits, setCredits] = useState<CreditAccount | null>(null)

  useEffect(() => {
    const load = (): void => {
      void window.api.getUsage().then(setUsage)
      void fetchCredits().then(setCredits)
    }
    load()
    const id = setInterval(load, 4000)
    return () => clearInterval(id)
  }, [])

  const grant = credits?.monthlyGrant ?? 0
  const balance = credits?.balance ?? 0
  const used = credits ? Math.max(0, grant - balance) : (usage?.totalCredits ?? 0)
  const pct = grant > 0 ? Math.min(100, Math.round((used / grant) * 100)) : 0

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Usage &amp; Credits</h1>
          <p className="mt-1 text-sm text-gray-500">Where your credits go this period.</p>
        </div>
        <PlanBadge credits={credits} />
      </div>

      {/* Progress bar */}
      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-end justify-between">
          <div className="text-sm text-gray-600">
            <span className="text-2xl font-semibold text-gray-900">{used.toLocaleString()}</span>
            <span className="text-gray-400">
              {' '}
              / {credits ? grant.toLocaleString() : '—'} credits used
            </span>
          </div>
          <div className="text-xs text-gray-400">
            {credits ? `${pct}%` : 'No active plan'}
            {credits?.periodEnd && ` · Resets ${formatDate(credits.periodEnd)}`}
          </div>
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500"
            style={{ width: `${credits ? pct : 0}%` }}
          />
        </div>
        {!credits && (
          <p className="mt-2 text-xs text-gray-400">
            Your remaining balance appears here once your plan is active.
          </p>
        )}
      </div>

      {/* Breakdown cards */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        <BreakdownCard
          Icon={Zap}
          label="Standard"
          primary={`${(usage?.standard.count ?? 0).toLocaleString()} replies`}
          secondary={`${(usage?.standard.credits ?? 0).toLocaleString()} credits`}
        />
        <BreakdownCard
          Icon={Sparkles}
          label="Premium"
          primary={`${(usage?.premium.count ?? 0).toLocaleString()} replies`}
          secondary={`${(usage?.premium.credits ?? 0).toLocaleString()} credits`}
        />
        <BreakdownCard
          Icon={AppWindow}
          label="Top app"
          primary={usage?.byApp[0]?.app ?? '—'}
          secondary={
            usage?.byApp[0] ? `${usage.byApp[0].credits.toLocaleString()} credits` : 'no usage yet'
          }
        />
      </div>

      {/* 30-day trend */}
      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Last 30 days
        </h3>
        <Trend daily={usage?.daily ?? []} />
      </div>

      {/* Recent usage */}
      <h3 className="mb-2 mt-7 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Recent usage
      </h3>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {(usage?.recent.length ?? 0) === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">No usage yet.</div>
        ) : (
          usage!.recent.map((item, i) => <UsageRow key={item.id} item={item} divider={i > 0} />)
        )}
      </div>

      {/* Actions */}
      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={onManage}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-105"
        >
          Upgrade plan
        </button>
        <button
          onClick={onManage}
          className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Buy more credits
        </button>
      </div>
    </div>
  )
}

function PlanBadge({ credits }: { credits: CreditAccount | null }): JSX.Element {
  if (!credits) {
    return (
      <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-500">
        No plan
      </span>
    )
  }
  if (credits.plan === 'pro' || credits.plan === 'pro_plus') {
    return (
      <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
        {credits.plan === 'pro_plus' ? 'Pro+' : 'Pro'}
      </span>
    )
  }
  const days = credits.periodEnd ? daysLeft(credits.periodEnd) : 0
  return (
    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
      Trial · {days} day{days === 1 ? '' : 's'} left
    </span>
  )
}

function BreakdownCard({
  Icon,
  label,
  primary,
  secondary
}: {
  Icon: typeof Zap
  label: string
  primary: string
  secondary: string
}): JSX.Element {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
        <Icon size={14} strokeWidth={2} className="text-gray-400" />
        {label}
      </div>
      <div className="mt-2 truncate text-lg font-semibold text-gray-900">{primary}</div>
      <div className="text-xs text-gray-400">{secondary}</div>
    </div>
  )
}

function Trend({ daily }: { daily: { day: string; credits: number }[] }): JSX.Element {
  const max = Math.max(1, ...daily.map((d) => d.credits))
  return (
    <div className="flex h-16 items-end gap-1">
      {daily.map((d) => (
        <div
          key={d.day}
          title={`${d.day}: ${d.credits} credits`}
          className="flex-1 rounded-sm bg-accent/70 transition-all hover:bg-accent"
          style={{ height: `${Math.max(3, (d.credits / max) * 100)}%` }}
        />
      ))}
    </div>
  )
}

function UsageRow({ item, divider }: { item: ReplyHistoryItem; divider: boolean }): JSX.Element {
  const time = new Date(item.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const tier = item.tier ?? 'standard'
  const credits = typeof item.credits === 'number' ? item.credits : tier === 'premium' ? 8 : 1
  return (
    <div
      className={`flex items-center gap-4 px-5 py-3 ${divider ? 'border-t border-gray-100' : ''}`}
    >
      <span className="w-20 shrink-0 text-xs tabular-nums text-gray-400">{time}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-gray-800">{item.app || 'Unknown'}</span>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
          tier === 'premium' ? 'bg-accent/10 text-accent' : 'bg-gray-100 text-gray-500'
        }`}
      >
        {tier}
      </span>
      <span className="w-12 shrink-0 text-right text-xs tabular-nums text-gray-500">
        −{credits}
      </span>
    </div>
  )
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

function daysLeft(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}
