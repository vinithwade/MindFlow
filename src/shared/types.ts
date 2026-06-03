/**
 * Shared types — the contract between main, preload and renderer.
 * These mirror the 5-layer architecture from the product spec.
 */

/** Layer 2 output: structured screen context object. */
export interface ScreenContext {
  /** Active application name, e.g. "Twitter", "Slack". */
  app: string
  /** Raw macOS process name of the front app — used to re-focus it on insert. */
  appProcess: string
  /** Extracted visible/selected content the user is replying to. */
  content: string
  /** How the content was obtained — useful for debugging the fallback chain. */
  source: 'selection' | 'accessibility' | 'ocr' | 'none'
  /** True when the content came from a highlighted selection (enables replace-in-place). */
  hadSelection: boolean
}

/** Layer 3 output: structured understanding of the spoken intent. */
export interface Intent {
  intent: 'reply' | 'rewrite' | 'compose' | 'other'
  tone: ReplyTone
  goal: string
}

export type ReplyTone = 'friendly' | 'professional' | 'casual'

/** Layer 4 output: the generated reply plus the intent that produced it. */
export interface GenerationResult {
  reply: string
  intent: Intent
}

/** A single end-to-end interaction, surfaced to the overlay. */
export interface ReplySession {
  id: string
  transcript: string
  context: ScreenContext
  result?: GenerationResult
  status: 'listening' | 'transcribing' | 'thinking' | 'ready' | 'error'
  error?: string
}

/**
 * A push-to-talk shortcut: the set of keys that must be held simultaneously.
 * `keys` are node-global-key-listener standard names (e.g. "FN", "SPACE",
 * "LEFT META"); `label` is the human display (e.g. "Fn", "⌘ + Space").
 * Single key (like Fn) or multiple keys are both valid.
 */
export interface Hotkey {
  keys: string[]
  label: string
}

/** Persisted user settings. */
export interface AppSettings {
  hotkey: Hotkey
  defaultTone: ReplyTone
  sttProvider: 'deepgram' | 'openai'
  llmProvider: 'anthropic' | 'openai'
  apiKeys: {
    deepgram?: string
    openai?: string
    anthropic?: string
  }
  /** Opt-in: use a screenshot+OCR fallback when no text is selected/readable. */
  enableOcr: boolean
  /** When false, the app never syncs to the cloud (local-only mode). */
  syncEnabled: boolean
  /** Start the app automatically at login. */
  launchAtLogin: boolean
  /** Epoch ms of the last local settings change — used for sync last-write-wins. */
  settingsUpdatedAt: number
  /** False until the user finishes first-run onboarding. */
  onboardingComplete: boolean
}

export type PermissionState = 'granted' | 'denied' | 'unknown'
export type PermissionKind = 'microphone' | 'accessibility' | 'screen'

export interface PermissionStatus {
  microphone: PermissionState
  accessibility: PermissionState
  screen: PermissionState
}

export const DEFAULT_SETTINGS: AppSettings = {
  hotkey: { keys: ['FN'], label: 'Fn' },
  defaultTone: 'friendly',
  sttProvider: 'openai',
  llmProvider: 'anthropic',
  apiKeys: {},
  enableOcr: false,
  syncEnabled: true,
  launchAtLogin: false,
  settingsUpdatedAt: 0,
  onboardingComplete: false
}

/**
 * Credit tier a reply consumed. Standard = fast model (1 credit), Premium =
 * top-quality model (8 credits), BYO = user's own key (0 credits, unmetered).
 */
export type ReplyTier = 'standard' | 'premium' | 'byo'

/** Credits each tier costs — single source of truth (matches the pricing model). */
export const CREDIT_COST: Record<ReplyTier, number> = { standard: 1, premium: 8, byo: 0 }

/** One past reply, shown in the Home activity list. */
export interface ReplyHistoryItem {
  id: string
  time: number // epoch ms
  app: string
  transcript: string
  reply: string
  /** Which model tier produced it (drives the usage breakdown). */
  tier?: ReplyTier
  /** Credits this reply consumed (0/1/8). */
  credits?: number
}

export interface DashboardStats {
  totalReplies: number
  totalWords: number
  dayStreak: number
}

export interface Dashboard {
  name: string
  stats: DashboardStats
  history: ReplyHistoryItem[]
}

/** Authoritative credit balance, read from Supabase (written by the billing gateway). */
export interface CreditAccount {
  plan: 'trial' | 'pro' | 'pro_plus'
  balance: number
  monthlyGrant: number
  periodEnd: string | null // ISO date the credits reset
}

/** Usage breakdown for the "Usage & Credits" dashboard (computed from local history). */
export interface UsageTier {
  count: number
  credits: number
}
export interface UsageByApp {
  app: string
  count: number
  credits: number
}
export interface UsageDay {
  day: string // dayKey, e.g. "2026-6-3"
  credits: number
}
export interface Usage {
  standard: UsageTier
  premium: UsageTier
  byApp: UsageByApp[] // top apps by credits spent
  daily: UsageDay[] // last 30 days, oldest → newest
  recent: ReplyHistoryItem[] // most recent consuming replies
  totalCredits: number // credits spent across stored history
}

/** IPC channel names — single source of truth shared by preload + main. */
export const IPC = {
  // renderer -> main (invoke)
  GET_SETTINGS: 'settings:get',
  SET_SETTINGS: 'settings:set',
  OVERLAY_INSERT: 'overlay:insert',
  OVERLAY_DISMISS: 'overlay:dismiss',
  OVERLAY_REGENERATE: 'overlay:regenerate',
  AUDIO_SUBMIT: 'audio:submit',
  GET_PERMISSIONS: 'permissions:get',
  REQUEST_PERMISSION: 'permissions:request',
  OPEN_MAIN: 'window:open-main',
  START_HOTKEY_CAPTURE: 'hotkey:capture',
  CANCEL_HOTKEY_CAPTURE: 'hotkey:capture-cancel',
  RESIZE_OVERLAY: 'overlay:resize',
  GET_DASHBOARD: 'dashboard:get',
  GET_USAGE: 'usage:get',
  OPEN_EXTERNAL: 'system:open-external',
  AUTH_CALLBACK: 'auth:callback',
  OAUTH_BEGIN: 'auth:oauth-begin',
  GET_AUTH_PORT: 'auth:get-port',
  MERGE_HISTORY: 'history:merge',
  REPLY_RECORDED: 'history:recorded',
  CLEAR_HISTORY: 'history:clear',
  TEST_API_KEY: 'providers:test-key',
  SET_AUTHED: 'auth:set-authed',
  SET_CREDIT_BALANCE: 'credits:set-balance',
  // main -> renderer (send)
  SESSION_UPDATE: 'session:update',
  HOTKEY_PRESSED: 'hotkey:pressed',
  RECORDING_START: 'recording:start',
  RECORDING_STOP: 'recording:stop'
} as const
