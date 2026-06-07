import { useEffect, useState } from 'react'
import { PermissionKind, PermissionStatus } from '@shared/types'
import { IS_MAC } from './platform'

const ALL_ITEMS: {
  kind: PermissionKind
  title: string
  desc: string
  required: boolean
}[] = [
  { kind: 'microphone', title: 'Microphone', desc: 'Hear what you say.', required: true },
  {
    kind: 'accessibility',
    title: 'Accessibility',
    desc: 'Hold-to-talk hotkey + insert replies.',
    required: true
  },
  { kind: 'screen', title: 'Screen Recording', desc: 'OCR fallback (optional).', required: false }
]

// Accessibility / Screen Recording are macOS privacy gates; Windows has no
// equivalent grants (main reports them as granted), so only show Microphone.
const ITEMS = IS_MAC ? ALL_ITEMS : ALL_ITEMS.filter((i) => i.kind === 'microphone')

/**
 * Live permissions status. Polls every 2s because macOS grants happen in System
 * Settings, outside the app — this reflects them without a manual refresh.
 */
export function PermissionsPanel(): JSX.Element {
  const [status, setStatus] = useState<PermissionStatus | null>(null)

  useEffect(() => {
    let alive = true
    const refresh = async (): Promise<void> => {
      const s = await window.api.getPermissions()
      if (alive) setStatus(s)
    }
    void refresh()
    const id = setInterval(refresh, 2000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  return (
    <div className="space-y-2.5">
      {ITEMS.map((item) => {
        const state = status?.[item.kind] ?? 'unknown'
        const granted = state === 'granted'
        return (
          <div
            key={item.kind}
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
          >
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                granted ? 'bg-emerald-500' : state === 'denied' ? 'bg-rose-500' : 'bg-gray-300'
              }`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm text-gray-900">
                {item.title}
                {item.required && (
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                    required
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">{item.desc}</p>
            </div>
            {granted ? (
              <span className="text-xs font-medium text-emerald-600">Granted</span>
            ) : (
              <button
                onClick={() => void window.api.requestPermission(item.kind)}
                className="rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/20"
              >
                Grant
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
