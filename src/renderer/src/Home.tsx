import { useEffect, useState } from 'react'
import { Dashboard, ReplyHistoryItem, Hotkey } from '@shared/types'

/**
 * Home dashboard — layout inspired by Wispr Flow: a greeting, a tip banner, a
 * stats strip, and a recent-activity list of past replies. White theme.
 */
export function Home({ hotkey }: { hotkey: Hotkey }): JSX.Element {
  const [data, setData] = useState<Dashboard | null>(null)

  useEffect(() => {
    const load = (): void => {
      void window.api.getDashboard().then(setData)
    }
    load()
    // Refresh while the window is open so new replies appear.
    const id = setInterval(load, 4000)
    return () => clearInterval(id)
  }, [])

  const name = data?.name
  const stats = data?.stats
  const history = data?.history ?? []

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold text-gray-900">
        Welcome back{name ? `, ${name}` : ''}
      </h1>
      <p className="mt-1 text-sm text-gray-500">Here's your reply activity.</p>

      {/* Tip banner + stats */}
      <div className="mt-6 flex gap-4">
        <div className="relative flex-1 overflow-hidden rounded-2xl bg-gradient-to-br from-[#5b9dff] to-[#2f7ff0] p-5 text-white shadow-sm">
          <h2 className="text-base font-semibold">Reply without leaving your app</h2>
          <p className="mt-1 max-w-sm text-sm text-white/85">
            Read anything on screen, then hold{' '}
            <kbd className="rounded bg-white/20 px-1.5 py-0.5 text-xs font-medium">
              {hotkey.label}
            </kbd>{' '}
            and speak your intent. A polished reply appears, ready to insert.
          </p>
        </div>

        <div className="flex w-64 shrink-0 flex-col justify-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4">
          <Stat value={stats?.totalReplies ?? 0} label="total replies" />
          <div className="h-px bg-gray-200" />
          <Stat value={stats?.totalWords ?? 0} label="words generated" />
          <div className="h-px bg-gray-200" />
          <Stat value={stats?.dayStreak ?? 0} label="day streak" />
        </div>
      </div>

      {/* Recent activity */}
      <h3 className="mb-2 mt-7 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Recent
      </h3>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {history.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">
            No replies yet — hold <span className="font-medium text-gray-600">{hotkey.label}</span>{' '}
            anywhere and speak to get started.
          </div>
        ) : (
          history.map((item, i) => (
            <Row key={item.id} item={item} divider={i > 0} />
          ))
        )}
      </div>
    </div>
  )
}

function Stat({ value, label }: { value: number; label: string }): JSX.Element {
  return (
    <div>
      <div className="text-2xl font-semibold text-gray-900">{value.toLocaleString()}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  )
}

function Row({ item, divider }: { item: ReplyHistoryItem; divider: boolean }): JSX.Element {
  const time = new Date(item.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return (
    <div className={`flex items-start gap-4 px-5 py-3.5 ${divider ? 'border-t border-gray-100' : ''}`}>
      <span className="w-20 shrink-0 pt-0.5 text-xs tabular-nums text-gray-400">{time}</span>
      <p className="min-w-0 flex-1 truncate text-sm text-gray-800">{item.reply}</p>
      {item.app && (
        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
          {item.app}
        </span>
      )}
    </div>
  )
}
