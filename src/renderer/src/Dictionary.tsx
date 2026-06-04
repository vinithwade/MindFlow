import { useState } from 'react'
import { AppSettings } from '@shared/types'
import { Card, Field, Toggle } from './ui'

/**
 * Personal dictionary settings — custom words that bias transcription + reply
 * spelling. Auto-learned words (Wispr-style) and manual ones both live here.
 */
export function Dictionary({
  settings,
  save
}: {
  settings: AppSettings
  save: (p: Partial<AppSettings>) => void
}): JSX.Element {
  const [word, setWord] = useState('')
  const dict = settings.dictionary ?? []

  function add(): void {
    const w = word.trim()
    if (!w) return
    if (!dict.some((d) => d.toLowerCase() === w.toLowerCase())) {
      save({ dictionary: [...dict, w] })
    }
    setWord('')
  }
  function remove(w: string): void {
    save({ dictionary: dict.filter((d) => d !== w) })
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Dictionary</h1>
        <p className="text-sm text-gray-500">
          Teach MindFlow your words — names, brands, jargon, acronyms — so it hears and spells them
          right.
        </p>
      </div>

      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-gray-800">Auto-learn words</div>
            <p className="mt-0.5 max-w-sm text-xs text-gray-500">
              Automatically add names and uncommon terms from your replies. Everyday words are
              ignored.
            </p>
          </div>
          <Toggle
            checked={settings.autoLearnDictionary}
            onChange={(v) => save({ autoLearnDictionary: v })}
          />
        </div>
      </Card>

      <Card>
        <div className="space-y-4">
          <Field label="Add a word" hint="Names, brands, technical terms, acronyms.">
            <div className="flex gap-2">
              <input
                value={word}
                onChange={(e) => setWord(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    add()
                  }
                }}
                placeholder="e.g. Kubernetes, Anthropic, Erik"
                spellCheck={false}
                className="flex-1 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
              <button
                onClick={add}
                disabled={!word.trim()}
                className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-105 disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </Field>

          <div>
            <div className="mb-2 text-xs font-medium text-gray-500">
              {dict.length} word{dict.length === 1 ? '' : 's'}
            </div>
            {dict.length === 0 ? (
              <p className="text-sm text-gray-400">
                No words yet — they'll appear here automatically as you use MindFlow.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {dict
                  .slice()
                  .reverse()
                  .map((w) => (
                    <span
                      key={w}
                      className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm text-gray-700"
                    >
                      {w}
                      <button
                        onClick={() => remove(w)}
                        aria-label={`Remove ${w}`}
                        className="text-base leading-none text-gray-400 transition hover:text-rose-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
