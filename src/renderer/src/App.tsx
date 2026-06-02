import { useEffect, useState } from 'react'
import {
  AudioLines,
  House,
  SlidersHorizontal,
  Sparkles,
  ShieldCheck,
  CircleUserRound,
  Info,
  type LucideIcon
} from 'lucide-react'
import { AppSettings } from '@shared/types'
import { Segmented, KeyInput, Card, Field, Toggle } from './ui'
import { PermissionsPanel } from './PermissionsPanel'
import { ShortcutRecorder } from './ShortcutRecorder'
import { Onboarding } from './Onboarding'
import { Home } from './Home'
import { Login } from './Login'
import { useAuth } from './auth'
import { pushSettings, pushReply } from './sync'
import { PRIVACY_URL, TERMS_URL } from './legal'

type Section = 'home' | 'general' | 'providers' | 'permissions' | 'account' | 'about'
type NavItem = { id: Section; label: string; Icon: LucideIcon }

// Core navigation (top) and account/info (pinned to the bottom).
const NAV_TOP: NavItem[] = [
  { id: 'home', label: 'Home', Icon: House },
  { id: 'general', label: 'General', Icon: SlidersHorizontal },
  { id: 'providers', label: 'Providers', Icon: Sparkles },
  { id: 'permissions', label: 'Permissions', Icon: ShieldCheck }
]
const NAV_BOTTOM: NavItem[] = [
  { id: 'account', label: 'Account', Icon: CircleUserRound },
  { id: 'about', label: 'About', Icon: Info }
]

export function App(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [section, setSection] = useState<Section>('home')
  const auth = useAuth()

  useEffect(() => {
    void window.api.getSettings().then(setSettings)
  }, [])

  // When signed in (and sync enabled), push each new reply to the cloud.
  const syncEnabled = settings?.syncEnabled ?? true
  useEffect(() => {
    return window.api.onReplyRecorded((item) => {
      if (auth.session && syncEnabled) void pushReply(item)
    })
  }, [auth.session, syncEnabled])

  async function save(partial: Partial<AppSettings>): Promise<void> {
    const next = await window.api.setSettings(partial)
    setSettings(next)
    if (auth.session && next.syncEnabled) void pushSettings(next)
  }

  if (auth.loading || !settings) return <div className="h-screen w-screen bg-canvas" />

  // Locked until the user signs in or creates an account.
  if (!auth.session) return <AuthGate />

  if (!settings.onboardingComplete) {
    return <Onboarding onDone={() => void save({ onboardingComplete: true })} />
  }

  return (
    <div className="flex h-screen w-screen bg-canvas font-sans text-gray-900">
      {/* Sidebar */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white/70 px-3 pb-3 pt-4">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-2 pb-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white shadow-sm">
            <AudioLines size={18} strokeWidth={2.25} />
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-semibold text-gray-900">Voice Reply</div>
            <div className="text-[11px] text-gray-400">Assistant</div>
          </div>
          <span className="rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
            Beta
          </span>
        </div>

        {/* Top nav */}
        <nav className="space-y-0.5">
          {NAV_TOP.map((n) => (
            <NavButton key={n.id} item={n} active={section === n.id} onSelect={setSection} />
          ))}
        </nav>

        <div className="flex-1" />

        {/* Account / info pinned to the bottom */}
        <nav className="space-y-0.5 border-t border-gray-200 pt-2">
          {NAV_BOTTOM.map((n) => (
            <NavButton key={n.id} item={n} active={section === n.id} onSelect={setSection} />
          ))}
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-8 py-7">
        {section === 'home' && <Home hotkey={settings.hotkey} />}
        {section === 'general' && <General settings={settings} save={save} />}
        {section === 'providers' && <Providers settings={settings} save={save} />}
        {section === 'permissions' && <Permissions />}
        {section === 'account' && <Account settings={settings} save={save} />}
        {section === 'about' && <About />}
      </main>
    </div>
  )
}

function NavButton({
  item,
  active,
  onSelect
}: {
  item: NavItem
  active: boolean
  onSelect: (id: Section) => void
}): JSX.Element {
  const { Icon, label, id } = item
  return (
    <button
      onClick={() => onSelect(id)}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
        active
          ? 'bg-accent/10 font-medium text-accent'
          : 'text-gray-600 hover:bg-black/[0.04] hover:text-gray-900'
      }`}
    >
      <Icon size={17} strokeWidth={2} className={active ? 'text-accent' : 'text-gray-400'} />
      {label}
    </button>
  )
}

function Header({ title, sub }: { title: string; sub: string }): JSX.Element {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      <p className="text-sm text-gray-500">{sub}</p>
    </div>
  )
}

function General({
  settings,
  save
}: {
  settings: AppSettings
  save: (p: Partial<AppSettings>) => void
}): JSX.Element {
  return (
    <div className="max-w-lg">
      <Header title="General" sub="How you trigger and shape replies." />
      <Card>
        <div className="space-y-5">
          <Field
            label="Push-to-talk shortcut"
            hint="Click Record, then press the key(s) you want — a single key like Fn, or a combo. Hold it, speak, release. Default is Fn."
          >
            <ShortcutRecorder value={settings.hotkey} onChange={(hk) => save({ hotkey: hk })} />
          </Field>
          <Field label="Default tone">
            <Segmented
              value={settings.defaultTone}
              onChange={(v) => save({ defaultTone: v })}
              options={[
                { value: 'friendly', label: 'Friendly' },
                { value: 'professional', label: 'Professional' },
                { value: 'casual', label: 'Casual' }
              ]}
            />
          </Field>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-gray-800">Screenshot OCR fallback</div>
              <p className="mt-0.5 max-w-sm text-xs text-gray-500">
                When no text is selected or readable, take a screenshot and read it. Off by default —
                it briefly captures your screen and needs Screen Recording permission.
              </p>
            </div>
            <Toggle checked={settings.enableOcr} onChange={(v) => save({ enableOcr: v })} />
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-gray-800">Launch at login</div>
              <p className="mt-0.5 max-w-sm text-xs text-gray-500">
                Start Voice Reply automatically when you log in.
              </p>
            </div>
            <Toggle
              checked={settings.launchAtLogin}
              onChange={(v) => save({ launchAtLogin: v })}
            />
          </div>
        </div>
      </Card>
    </div>
  )
}

function TestKey({
  provider,
  value
}: {
  provider: 'openai' | 'anthropic' | 'deepgram'
  value: string
}): JSX.Element {
  const [status, setStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [msg, setMsg] = useState('')

  async function run(): Promise<void> {
    setStatus('testing')
    setMsg('')
    const r = await window.api.testApiKey(provider, value)
    setStatus(r.ok ? 'ok' : 'fail')
    setMsg(r.ok ? 'Valid ✓' : (r.error ?? 'Invalid'))
  }

  return (
    <div className="mt-1.5 flex items-center gap-2">
      <button
        disabled={!value || status === 'testing'}
        onClick={() => void run()}
        className="text-xs font-medium text-accent hover:underline disabled:opacity-40"
      >
        {status === 'testing' ? 'Testing…' : 'Test key'}
      </button>
      {status === 'ok' && <span className="text-xs text-emerald-600">{msg}</span>}
      {status === 'fail' && <span className="text-xs text-rose-600">{msg}</span>}
    </div>
  )
}

function Providers({
  settings,
  save
}: {
  settings: AppSettings
  save: (p: Partial<AppSettings>) => void
}): JSX.Element {
  return (
    <div className="max-w-lg space-y-4">
      <Header title="Providers" sub="Choose your engines and add API keys." />
      <Card>
        <div className="space-y-5">
          <Field label="Speech-to-text">
            <Segmented
              value={settings.sttProvider}
              onChange={(v) => save({ sttProvider: v })}
              options={[
                { value: 'openai', label: 'OpenAI Whisper' },
                { value: 'deepgram', label: 'Deepgram' }
              ]}
            />
          </Field>
          <Field label="Reply model">
            <Segmented
              value={settings.llmProvider}
              onChange={(v) => save({ llmProvider: v })}
              options={[
                { value: 'anthropic', label: 'Claude' },
                { value: 'openai', label: 'OpenAI' }
              ]}
            />
          </Field>
        </div>
      </Card>
      <Card>
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-gray-700">API keys</h2>
          <Field label="OpenAI" hint="Covers Whisper STT and GPT replies.">
            <KeyInput
              value={settings.apiKeys.openai ?? ''}
              onChange={(v) => save({ apiKeys: { ...settings.apiKeys, openai: v } })}
              placeholder="sk-…"
            />
            <TestKey provider="openai" value={settings.apiKeys.openai ?? ''} />
          </Field>
          <Field label="Anthropic">
            <KeyInput
              value={settings.apiKeys.anthropic ?? ''}
              onChange={(v) => save({ apiKeys: { ...settings.apiKeys, anthropic: v } })}
              placeholder="sk-ant-…"
            />
            <TestKey provider="anthropic" value={settings.apiKeys.anthropic ?? ''} />
          </Field>
          <Field label="Deepgram">
            <KeyInput
              value={settings.apiKeys.deepgram ?? ''}
              onChange={(v) => save({ apiKeys: { ...settings.apiKeys, deepgram: v } })}
              placeholder="Deepgram API key"
            />
            <TestKey provider="deepgram" value={settings.apiKeys.deepgram ?? ''} />
          </Field>
        </div>
      </Card>
    </div>
  )
}

function Permissions(): JSX.Element {
  return (
    <div className="max-w-lg">
      <Header title="Permissions" sub="macOS access the app needs to work everywhere." />
      <PermissionsPanel />
    </div>
  )
}

/** Full-screen login gate shown until the user is authenticated. */
function AuthGate(): JSX.Element {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-canvas font-sans">
      <div className="w-full max-w-sm px-6">
        <div className="mb-2 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-2xl shadow-sm">
            🎙️
          </div>
          <div className="text-base font-semibold text-gray-900">Voice Reply Assistant</div>
        </div>
        <Login />
      </div>
    </div>
  )
}

function Account({
  settings,
  save
}: {
  settings: AppSettings
  save: (p: Partial<AppSettings>) => void
}): JSX.Element {
  const { session, user, signOut, deleteAccount } = useAuth()

  if (!session) {
    return (
      <div className="max-w-lg">
        <Header title="Account" sub="Sign in to sync your replies & settings across devices." />
        <Login />
      </div>
    )
  }

  const meta = (user?.user_metadata ?? {}) as { name?: string; full_name?: string }
  const name = meta.name || meta.full_name || ''

  async function exportData(): Promise<void> {
    const dash = await window.api.getDashboard()
    const blob = new Blob([JSON.stringify({ settings, ...dash }, null, 2)], {
      type: 'application/json'
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'voice-reply-data.json'
    a.click()
  }

  async function removeAccount(): Promise<void> {
    if (!window.confirm('Delete your account and all synced data? This cannot be undone.')) return
    try {
      await deleteAccount()
    } catch (e) {
      window.alert(`Could not delete account: ${(e as Error).message}`)
    }
  }

  return (
    <div className="max-w-lg space-y-4">
      <Header title="Account" sub="Manage your account and data." />
      <Card>
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-lg font-semibold text-accent">
            {(name || user?.email || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            {name && <div className="truncate text-sm font-semibold text-gray-900">{name}</div>}
            <div className="truncate text-sm text-gray-500">{user?.email}</div>
          </div>
          <button
            onClick={() => void signOut()}
            className="rounded-xl border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Sign out
          </button>
        </div>
      </Card>

      <Card>
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-gray-800">Sync to cloud</div>
              <p className="mt-0.5 max-w-sm text-xs text-gray-500">
                Keep replies & settings across devices. Turn off for local-only mode.
              </p>
            </div>
            <Toggle checked={settings.syncEnabled} onChange={(v) => save({ syncEnabled: v })} />
          </div>
          <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
            <button
              onClick={() => void exportData()}
              className="rounded-lg bg-black/[0.05] px-3 py-2 text-[13px] font-medium text-gray-700 hover:bg-black/[0.09]"
            >
              Export my data
            </button>
            <button
              onClick={() => {
                if (window.confirm('Clear all locally-stored replies?')) void window.api.clearHistory()
              }}
              className="rounded-lg bg-black/[0.05] px-3 py-2 text-[13px] font-medium text-gray-700 hover:bg-black/[0.09]"
            >
              Clear local history
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-rose-600">Delete account</div>
            <p className="mt-0.5 max-w-sm text-xs text-gray-500">
              Permanently delete your account and all synced data.
            </p>
          </div>
          <button
            onClick={() => void removeAccount()}
            className="rounded-lg border border-rose-200 px-3.5 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
          >
            Delete
          </button>
        </div>
      </Card>
    </div>
  )
}

function About(): JSX.Element {
  return (
    <div className="max-w-lg">
      <Header title="About" sub="Voice Reply Assistant" />
      <Card>
        <p className="text-sm leading-relaxed text-gray-600">
          Hold your shortcut, speak your intent, and get a polished reply for whatever is on screen —
          no copy-paste into ChatGPT. Voice + screen context → an intelligent reply.
        </p>
        <div className="mt-4 flex items-center gap-4 text-sm">
          <button
            onClick={() => void window.api.openExternal(PRIVACY_URL)}
            className="text-accent hover:underline"
          >
            Privacy Policy
          </button>
          <button
            onClick={() => void window.api.openExternal(TERMS_URL)}
            className="text-accent hover:underline"
          >
            Terms of Service
          </button>
        </div>
        <p className="mt-3 text-xs text-gray-400">Version 0.1.0 · macOS</p>
      </Card>
    </div>
  )
}
