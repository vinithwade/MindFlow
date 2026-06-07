import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  IPC,
  AppSettings,
  ReplySession,
  PermissionKind,
  PermissionStatus,
  Hotkey,
  Dashboard,
  ReplyHistoryItem,
  Usage
} from '../shared/types'

/**
 * Preload: exposes a minimal, typed `window.api` to the renderer over the
 * contextBridge. The renderer never touches ipcRenderer directly.
 */
const api = {
  /** OS the app is running on — lets the renderer adapt labels/permission UI. */
  platform: process.platform as string,

  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.GET_SETTINGS),
  setSettings: (partial: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC.SET_SETTINGS, partial),

  // Dashboard (Home) data
  getDashboard: (): Promise<Dashboard> => ipcRenderer.invoke(IPC.GET_DASHBOARD),
  // Usage & credits breakdown (computed from local history)
  getUsage: (): Promise<Usage> => ipcRenderer.invoke(IPC.GET_USAGE),

  // Auth / sync helpers
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke(IPC.OPEN_EXTERNAL, url),
  oauthBegin: (): Promise<void> => ipcRenderer.invoke(IPC.OAUTH_BEGIN),
  getAuthPort: (): Promise<number> => ipcRenderer.invoke(IPC.GET_AUTH_PORT),
  setAuthed: (authed: boolean): Promise<void> => ipcRenderer.invoke(IPC.SET_AUTHED, authed),
  // Report the user's current credit balance so main can gate when it hits 0.
  setCreditBalance: (balance: number | null): Promise<void> =>
    ipcRenderer.invoke(IPC.SET_CREDIT_BALANCE, balance),
  mergeHistory: (items: ReplyHistoryItem[]): Promise<void> =>
    ipcRenderer.invoke(IPC.MERGE_HISTORY, items),
  clearHistory: (): Promise<void> => ipcRenderer.invoke(IPC.CLEAR_HISTORY),
  testApiKey: (
    provider: 'openai' | 'anthropic' | 'deepgram',
    key: string
  ): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC.TEST_API_KEY, { provider, key }),
  onAuthCallback: (cb: (url: string) => void): (() => void) => {
    const listener = (_e: unknown, url: string): void => cb(url)
    ipcRenderer.on(IPC.AUTH_CALLBACK, listener)
    return () => ipcRenderer.removeListener(IPC.AUTH_CALLBACK, listener)
  },
  onReplyRecorded: (cb: (item: ReplyHistoryItem) => void): (() => void) => {
    const listener = (_e: unknown, item: ReplyHistoryItem): void => cb(item)
    ipcRenderer.on(IPC.REPLY_RECORDED, listener)
    return () => ipcRenderer.removeListener(IPC.REPLY_RECORDED, listener)
  },
  // Main pushes updated settings (e.g. after auto-learning dictionary words).
  onSettingsUpdated: (cb: (settings: AppSettings) => void): (() => void) => {
    const listener = (_e: unknown, settings: AppSettings): void => cb(settings)
    ipcRenderer.on(IPC.SETTINGS_UPDATED, listener)
    return () => ipcRenderer.removeListener(IPC.SETTINGS_UPDATED, listener)
  },

  // Permissions (macOS)
  getPermissions: (): Promise<PermissionStatus> => ipcRenderer.invoke(IPC.GET_PERMISSIONS),
  requestPermission: (kind: PermissionKind): Promise<PermissionStatus> =>
    ipcRenderer.invoke(IPC.REQUEST_PERMISSION, kind),
  openMainWindow: (): Promise<void> => ipcRenderer.invoke(IPC.OPEN_MAIN),

  // Shortcut recorder: resolves with the captured combo (or null if cancelled).
  startHotkeyCapture: (): Promise<Hotkey | null> =>
    ipcRenderer.invoke(IPC.START_HOTKEY_CAPTURE),
  cancelHotkeyCapture: (): Promise<void> => ipcRenderer.invoke(IPC.CANCEL_HOTKEY_CAPTURE),

  // Overlay actions
  dismissOverlay: (): Promise<void> => ipcRenderer.invoke(IPC.OVERLAY_DISMISS),
  regenerate: (): Promise<{ ok: boolean }> => ipcRenderer.invoke(IPC.OVERLAY_REGENERATE),
  insert: (text: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(IPC.OVERLAY_INSERT, text),

  // Audio: renderer captures the mic, then hands the clip back to main for STT.
  submitAudio: (buffer: ArrayBuffer, mimeType: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(IPC.AUDIO_SUBMIT, { buffer, mimeType }),

  // Ask main to size the overlay window to the measured content height.
  resizeOverlay: (height: number): void => ipcRenderer.send(IPC.RESIZE_OVERLAY, height),

  // Subscriptions (main -> renderer)
  onSessionUpdate: (cb: (session: ReplySession) => void): (() => void) => {
    const listener = (_e: unknown, session: ReplySession): void => cb(session)
    ipcRenderer.on(IPC.SESSION_UPDATE, listener)
    return () => ipcRenderer.removeListener(IPC.SESSION_UPDATE, listener)
  },
  onHotkeyPressed: (cb: () => void): (() => void) => {
    const listener = (): void => cb()
    ipcRenderer.on(IPC.HOTKEY_PRESSED, listener)
    return () => ipcRenderer.removeListener(IPC.HOTKEY_PRESSED, listener)
  },
  onRecordingStart: (cb: () => void): (() => void) => {
    const listener = (): void => cb()
    ipcRenderer.on(IPC.RECORDING_START, listener)
    return () => ipcRenderer.removeListener(IPC.RECORDING_START, listener)
  },
  onRecordingStop: (cb: () => void): (() => void) => {
    const listener = (): void => cb()
    ipcRenderer.on(IPC.RECORDING_STOP, listener)
    return () => ipcRenderer.removeListener(IPC.RECORDING_STOP, listener)
  }
}

export type Api = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // No context isolation: attach to the global object directly.
  const g = globalThis as unknown as { electron: typeof electronAPI; api: Api }
  g.electron = electronAPI
  g.api = api
}
