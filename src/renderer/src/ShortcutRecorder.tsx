import { useRef, useState } from 'react'
import { Hotkey } from '@shared/types'

/**
 * Press-to-record shortcut control. Clicking "Record" tells main to capture the
 * next key(s) you press and release (single key like Fn, or a multi-key combo),
 * via the global key listener — so it can capture keys the browser never sees.
 */
export function ShortcutRecorder({
  value,
  onChange
}: {
  value: Hotkey
  onChange: (hk: Hotkey) => void
}): JSX.Element {
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Distinguish "user clicked Cancel" from "capture failed/timed out".
  const cancelled = useRef(false)

  async function record(): Promise<void> {
    setRecording(true)
    setError(null)
    cancelled.current = false
    try {
      const hk = await window.api.startHotkeyCapture()
      if (hk) {
        onChange(hk)
      } else if (!cancelled.current) {
        // Null without a cancel = nothing was captured (timed out, or the key
        // listener isn't running — e.g. blocked by antivirus on Windows).
        setError(
          "No keys detected. Press and release the keys while recording. If this keeps happening, restart MindFlow — your antivirus may be blocking its key listener."
        )
      }
    } finally {
      setRecording(false)
    }
  }

  function cancel(): void {
    cancelled.current = true
    void window.api.cancelHotkeyCapture()
    setRecording(false)
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="flex min-w-[120px] items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5">
          {recording ? (
            <span className="text-sm text-accent">
              <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-accent align-middle" />
              Press your keys…
            </span>
          ) : (
            <span className="text-sm font-medium text-gray-900">{value.label || 'Not set'}</span>
          )}
        </div>

        {recording ? (
          <button
            onClick={cancel}
            className="rounded-lg px-3 py-2 text-[13px] text-gray-500 hover:text-gray-900"
          >
            Cancel
          </button>
        ) : (
          <button
            onClick={() => void record()}
            className="rounded-lg bg-black/[0.05] px-3.5 py-2 text-[13px] font-medium text-gray-700 transition hover:bg-black/[0.09]"
          >
            Record
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  )
}
