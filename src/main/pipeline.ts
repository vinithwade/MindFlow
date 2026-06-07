import { IPC, ReplySession, ScreenContext, ReplyTier, CREDIT_COST, AppSettings } from '../shared/types'
import {
  getOverlayWindow,
  showOverlayNearCursor,
  setOverlayMode,
  relinquishFocus,
  getMainWindow,
  createMainWindow
} from './windows'
import { getSettings, setSettings } from './settings'
import { extractCandidates, mergeDict } from './dictionaryLogic'
import { detectEntities, newEntities } from './entityLogic'
import { createSTTProvider, assertSTTConfigured } from './stt'
import { captureContext } from './context'
import { randomUUID } from 'crypto'
import { createLLMProvider, assertLLMConfigured } from './llm'
import { insertText } from './insert'
import { activateProcess } from './context/platform'
import { recordReply } from './history'

/**
 * Orchestrates one end-to-end reply session and keeps the overlay in sync.
 * M1 implements: listening → transcribing → (transcript ready). Context capture
 * (M2) and generation (M3) hook into `onTranscript` as those layers land.
 */

let current: ReplySession | null = null
/** The app is locked until the user signs in (set from the renderer). */
let authed = false
/** Latest known credit balance (from the renderer). null = unknown → fail open. */
let creditBalance: number | null = null

/** Renderer reports auth state so the hotkey is gated behind sign-in. */
export function setAuthed(v: boolean): void {
  authed = v
}

/** Renderer reports the current credit balance so we can gate when it runs out. */
export function setCreditBalance(v: number | null): void {
  creditBalance = v
}
/** Screen context is captured in parallel with recording; awaited at generation. */
let contextPromise: Promise<ScreenContext> | null = null

function emit(): void {
  if (!current) return
  const win = getOverlayWindow()
  if (!win.isDestroyed()) win.webContents.send(IPC.SESSION_UPDATE, current)
}

function patch(p: Partial<ReplySession>): void {
  if (!current) return
  const prevStatus = current.status
  current = { ...current, ...p }
  // Grow to the card when there's something to read; stay a pill while capturing.
  if (current.status !== prevStatus) {
    setOverlayMode(current.status === 'ready' || current.status === 'error' ? 'card' : 'pill')
  }
  emit()
}

const EMPTY_CONTEXT: ScreenContext = {
  app: '',
  appProcess: '',
  content: '',
  source: 'none',
  hadSelection: false
}

/** Hotkey pressed (or hold started): open overlay and begin recording. */
export function beginSession(): void {
  // Locked until the user signs in — surface the login window instead.
  if (!authed) {
    const mw = getMainWindow() ?? createMainWindow()
    mw.show()
    mw.focus()
    return
  }

  current = {
    id: randomUUID(), // unique per session, stable across restarts
    transcript: '',
    context: EMPTY_CONTEXT,
    status: 'listening'
  }

  // Validate config up front so the user gets a clear message instead of a silent fail.
  try {
    const settings = getSettings()
    assertSTTConfigured(settings)
    assertLLMConfigured(settings)
  } catch (err) {
    showOverlayNearCursor()
    patch({ status: 'error', error: (err as Error).message })
    return
  }

  // Out of credits → block and prompt to buy more. null balance = unknown
  // (not signed in / credits not set up) → fail open so the app still works.
  const cost =
    getSettings().llmProvider === 'anthropic' ? CREDIT_COST.premium : CREDIT_COST.standard
  if (creditBalance !== null && creditBalance < cost) {
    showOverlayNearCursor()
    patch({
      status: 'error',
      error: 'Out of credits — open MindFlow to buy more and keep replying.'
    })
    return
  }

  // Capture screen context NOW (before the user's selection can change),
  // in parallel with recording — protects the <3s latency budget.
  contextPromise = captureContext({ enableOcr: getSettings().enableOcr }).catch(() => EMPTY_CONTEXT)

  showOverlayNearCursor()
  emit()
  getOverlayWindow().webContents.send(IPC.RECORDING_START)
}

/** Hold released / toggle off: ask the renderer to stop and hand back audio. */
export function endRecording(): void {
  if (!current || current.status !== 'listening') return
  getOverlayWindow().webContents.send(IPC.RECORDING_STOP)
}

/** The renderer returns the recorded audio; run STT. */
export async function handleAudio(audio: Buffer, mimeType: string): Promise<void> {
  if (!current) return
  if (audio.length === 0) {
    patch({
      status: 'error',
      error:
        process.platform === 'win32'
          ? 'No audio captured. Hold the shortcut while speaking — and check Settings → Privacy & security → Microphone allows desktop apps.'
          : 'No audio captured. Hold the shortcut while speaking.'
    })
    return
  }

  patch({ status: 'transcribing' })
  try {
    const settings = getSettings()
    const stt = createSTTProvider(settings)
    const transcript = await stt.transcribe(audio, mimeType, settings.dictionary)
    if (!transcript) {
      patch({ status: 'error', error: "Didn't catch that — try again." })
      return
    }
    patch({ transcript, status: 'thinking' })

    // Merge in the screen context captured at invocation time, then generate.
    const context = (await contextPromise) ?? EMPTY_CONTEXT
    patch({ context })
    await generate(transcript, context)
  } catch (err) {
    patch({ status: 'error', error: (err as Error).message })
  }
}

/** Layers 3+4: turn transcript + context into a ready-to-send reply. */
async function generate(transcript: string, context: ScreenContext): Promise<void> {
  const settings = getSettings()
  const llm = createLLMProvider(settings)
  const result = await llm.generate({
    context,
    transcript,
    defaultTone: settings.defaultTone,
    dictionary: settings.dictionary,
    myInfo: settings.myInfo
  })
  patch({ status: 'ready', result })
  if (current) {
    // Premium model (Claude) = 8 credits, fast model (GPT) = 1 credit.
    const tier: ReplyTier = settings.llmProvider === 'anthropic' ? 'premium' : 'standard'
    const entry = recordReply({
      id: current.id,
      app: context.app,
      transcript,
      reply: result.reply,
      tier,
      credits: CREDIT_COST[tier]
    })
    // Notify the renderer so it can sync the new reply to the cloud (if signed in).
    getMainWindow()?.webContents.send(IPC.REPLY_RECORDED, entry)
  }
}

/** Re-run generation for the current session (overlay "Regenerate"). */
export async function regenerateCurrent(): Promise<void> {
  if (!current || !current.transcript) return
  patch({ status: 'thinking' })
  try {
    await generate(current.transcript, current.context)
  } catch (err) {
    patch({ status: 'error', error: (err as Error).message })
  }
}

/** Insert a reply into the source app, then end the session. */
export async function insertReply(text?: string): Promise<void> {
  const reply = (text ?? current?.result?.reply ?? '').trim()
  if (!reply) return
  // Learn the user's unique words from the message they're actually sending.
  learnFromReply(reply)
  await insertText(reply, current?.context.appProcess)
  current = null
}

/**
 * Auto-learn proper-noun-like terms from the final sent reply (silent, Wispr-
 * style). The reply is user-approved text, so it's a clean signal. Persists the
 * dictionary and notifies the renderer so the UI updates + syncs.
 */
function learnFromReply(finalText: string): void {
  const settings = getSettings()
  const patch: Partial<AppSettings> = {}

  // Dictionary: learn proper-noun-like words (silent).
  if (settings.autoLearnDictionary) {
    const next = mergeDict(settings.dictionary, extractCandidates(finalText))
    if (next.length !== settings.dictionary.length) patch.dictionary = next
  }

  // My Info: detect email/links/phone/handles → add as PENDING (confirm-gated),
  // never auto-trusted for use until the user confirms in the My Info tab.
  if (settings.autoDetectMyInfo) {
    const fresh = newEntities(settings.myInfo, detectEntities(finalText))
    if (fresh.length) {
      patch.myInfo = [
        ...settings.myInfo,
        ...fresh.map((e) => ({
          id: randomUUID(),
          label: e.label,
          value: e.value,
          kind: e.kind,
          confirmed: false
        }))
      ]
    }
  }

  if (!('dictionary' in patch) && !('myInfo' in patch)) return
  const updated = setSettings(patch)
  getMainWindow()?.webContents.send(IPC.SETTINGS_UPDATED, updated)
}

export function dismissSession(): void {
  const proc = current?.context.appProcess
  current = null
  // Hide the whole app (overlay + dashboard) so our Settings window doesn't pop
  // forward when the overlay closes, then pin focus back to the source app.
  relinquishFocus()
  if (proc) void activateProcess(proc).catch(() => undefined)
}

export function getCurrentSession(): ReplySession | null {
  return current
}
