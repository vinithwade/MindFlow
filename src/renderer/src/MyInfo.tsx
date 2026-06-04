import { useState } from 'react'
import { AppSettings, MyInfoEntry, MyInfoKind } from '@shared/types'
import { Card, Field, Toggle } from './ui'

const KINDS: { value: MyInfoKind; label: string }[] = [
  { value: 'email', label: 'Email' },
  { value: 'link', label: 'Link' },
  { value: 'phone', label: 'Phone' },
  { value: 'handle', label: 'Handle' }
]
const DEFAULT_LABEL: Record<MyInfoKind, string> = {
  email: 'Email',
  link: 'Website',
  phone: 'Phone',
  handle: 'Handle'
}
const PLACEHOLDER: Record<MyInfoKind, string> = {
  email: 'you@email.com',
  link: 'https://linkedin.com/in/you',
  phone: '+1 415 555 0199',
  handle: '@username'
}

function uid(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return 'id-' + Date.now() + '-' + Math.floor(Math.random() * 1e6)
  }
}

/**
 * "My Info" — reusable personal details the assistant can insert into replies.
 * Auto-detected items appear as pending until the user confirms they're theirs.
 */
export function MyInfo({
  settings,
  save
}: {
  settings: AppSettings
  save: (p: Partial<AppSettings>) => void
}): JSX.Element {
  const [kind, setKind] = useState<MyInfoKind>('email')
  const [value, setValue] = useState('')
  const info = settings.myInfo ?? []
  const pending = info.filter((e) => !e.confirmed)
  const confirmed = info.filter((e) => e.confirmed)

  const update = (next: MyInfoEntry[]): void => save({ myInfo: next })
  const confirm = (id: string): void =>
    update(info.map((e) => (e.id === id ? { ...e, confirmed: true } : e)))
  const remove = (id: string): void => update(info.filter((e) => e.id !== id))

  function add(): void {
    const v = value.trim()
    if (!v) return
    if (!info.some((e) => e.value.toLowerCase() === v.toLowerCase())) {
      update([...info, { id: uid(), label: DEFAULT_LABEL[kind], value: v, kind, confirmed: true }])
    }
    setValue('')
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">My Info</h1>
        <p className="text-sm text-gray-500">
          Save your email, links, phone, and handles so MindFlow can drop them into a reply when you
          ask — "share my LinkedIn", "send my email".
        </p>
      </div>

      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-gray-800">Auto-detect from replies</div>
            <p className="mt-0.5 max-w-sm text-xs text-gray-500">
              Spot emails/links/numbers in messages you send and suggest them below to confirm. Never
              captures other people's details from the screen.
            </p>
          </div>
          <Toggle
            checked={settings.autoDetectMyInfo}
            onChange={(v) => save({ autoDetectMyInfo: v })}
          />
        </div>
      </Card>

      {pending.length > 0 && (
        <Card>
          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-800">Detected — confirm these are yours</div>
            {pending.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
              >
                <span className="shrink-0 rounded bg-white px-2 py-0.5 text-[11px] font-medium text-gray-600">
                  {e.label}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-gray-800">{e.value}</span>
                <button
                  onClick={() => confirm(e.id)}
                  className="shrink-0 text-xs font-semibold text-accent hover:underline"
                >
                  Confirm
                </button>
                <button
                  onClick={() => remove(e.id)}
                  className="shrink-0 text-xs text-gray-400 hover:text-rose-600"
                >
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="space-y-4">
          <Field label="Add a detail">
            <div className="flex gap-2">
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as MyInfoKind)}
                className="rounded-xl border border-gray-200 bg-white px-2.5 py-2.5 text-sm text-gray-700 outline-none focus:border-accent"
              >
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    add()
                  }
                }}
                placeholder={PLACEHOLDER[kind]}
                spellCheck={false}
                className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
              <button
                onClick={add}
                disabled={!value.trim()}
                className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-105 disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </Field>

          <div>
            <div className="mb-2 text-xs font-medium text-gray-500">{confirmed.length} saved</div>
            {confirmed.length === 0 ? (
              <p className="text-sm text-gray-400">Nothing saved yet.</p>
            ) : (
              <div className="space-y-2">
                {confirmed.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2"
                  >
                    <span className="shrink-0 rounded bg-white px-2 py-0.5 text-[11px] font-medium text-gray-600 ring-1 ring-gray-200">
                      {e.label}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-800">{e.value}</span>
                    <button
                      onClick={() => remove(e.id)}
                      className="shrink-0 text-xs text-gray-400 hover:text-rose-600"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
