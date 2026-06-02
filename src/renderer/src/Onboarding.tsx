import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AppSettings } from '@shared/types'
import { Segmented, KeyInput } from './ui'
import { PermissionsPanel } from './PermissionsPanel'

/**
 * First-run guided setup: choose a provider + key → grant permissions → done.
 * Saves directly via the settings API; calls onDone to flip onboardingComplete.
 */
export function Onboarding({ onDone }: { onDone: () => void }): JSX.Element {
  const [step, setStep] = useState(0)
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    void window.api.getSettings().then(setSettings)
  }, [])

  async function save(partial: Partial<AppSettings>): Promise<void> {
    const next = await window.api.setSettings(partial)
    setSettings(next)
  }

  if (!settings) return <div className="h-screen w-screen bg-canvas" />

  const provider = settings.llmProvider
  const currentKey =
    provider === 'anthropic' ? settings.apiKeys.anthropic : settings.apiKeys.openai
  const hasKey = !!currentKey?.trim()

  const steps = [
    {
      title: 'Welcome',
      body: (
        <div className="space-y-4 text-center">
          <div className="text-5xl">🎙️</div>
          <h1 className="text-2xl font-semibold text-gray-900">Voice Reply Assistant</h1>
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-gray-500">
            Read a tweet, email, or DM. Hold a shortcut, say what you mean, and a polished reply
            appears — grounded in what's on your screen. No copy-paste into ChatGPT.
          </p>
        </div>
      ),
      canNext: true
    },
    {
      title: 'Connect a model',
      body: (
        <div className="space-y-5">
          <p className="text-sm text-gray-500">
            Pick a reply model and paste its API key. (OpenAI also powers transcription.)
          </p>
          <Segmented
            value={provider}
            onChange={(v) =>
              save({ llmProvider: v, sttProvider: v === 'openai' ? 'openai' : settings.sttProvider })
            }
            options={[
              { value: 'anthropic', label: 'Claude' },
              { value: 'openai', label: 'OpenAI' }
            ]}
          />
          <KeyInput
            value={currentKey ?? ''}
            onChange={(v) =>
              save({
                apiKeys: {
                  ...settings.apiKeys,
                  [provider === 'anthropic' ? 'anthropic' : 'openai']: v
                }
              })
            }
            placeholder={provider === 'anthropic' ? 'sk-ant-…' : 'sk-…'}
          />
          {provider === 'anthropic' && (
            <div className="space-y-1.5">
              <p className="text-xs text-gray-500">
                Claude needs a transcription key too (OpenAI Whisper or Deepgram):
              </p>
              <KeyInput
                value={settings.apiKeys.openai ?? ''}
                onChange={(v) =>
                  save({ apiKeys: { ...settings.apiKeys, openai: v }, sttProvider: 'openai' })
                }
                placeholder="OpenAI key for Whisper (sk-…)"
              />
            </div>
          )}
        </div>
      ),
      canNext: hasKey
    },
    {
      title: 'Grant permissions',
      body: (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            The app works system-wide, so macOS needs a few permissions. You can finish setup and
            grant these anytime.
          </p>
          <PermissionsPanel />
        </div>
      ),
      canNext: true
    },
    {
      title: "You're set",
      body: (
        <div className="space-y-4 text-center">
          <div className="text-5xl">✨</div>
          <h1 className="text-xl font-semibold text-gray-900">Ready to go</h1>
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-gray-500">
            Open any app, optionally highlight some text, then hold{' '}
            <kbd className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">
              {settings.hotkey.label}
            </kbd>{' '}
            and speak. Your reply appears in the overlay.
          </p>
        </div>
      ),
      canNext: true
    }
  ]

  const last = step === steps.length - 1
  const cur = steps[step]

  return (
    <div className="flex h-screen w-screen flex-col bg-canvas font-sans text-gray-900">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 pt-6">
        {steps.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i === step ? 'w-6 bg-accent' : 'w-1.5 bg-gray-300'
            }`}
          />
        ))}
      </div>

      {/* Body */}
      <div className="flex flex-1 items-center justify-center px-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.22 }}
            className="w-full max-w-md"
          >
            {cur.body}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between border-t border-gray-200 px-10 py-4">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className={`text-sm text-gray-500 hover:text-gray-900 ${step === 0 ? 'invisible' : ''}`}
        >
          Back
        </button>
        <button
          disabled={!cur.canNext}
          onClick={() => (last ? onDone() : setStep((s) => s + 1))}
          className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:brightness-105 disabled:opacity-40"
        >
          {last ? 'Start using it' : 'Continue'}
        </button>
      </div>
    </div>
  )
}
