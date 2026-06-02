import Store from 'electron-store'
import { safeStorage } from 'electron'
import { AppSettings, DEFAULT_SETTINGS } from '../shared/types'

/**
 * Persistent settings backed by electron-store (JSON on disk in userData).
 *
 * API keys are encrypted at rest with the OS keychain via Electron `safeStorage`
 * (an `enc:` prefix marks ciphertext). getSettings() returns decrypted values to
 * the app; setSettings() encrypts before writing. Legacy plaintext keys are
 * migrated transparently on the next save.
 */
const store = new Store<AppSettings>({
  name: 'settings',
  defaults: DEFAULT_SETTINGS
})

const ENC_PREFIX = 'enc:'

function encryptKey(value?: string): string | undefined {
  if (!value) return value
  if (value.startsWith(ENC_PREFIX)) return value // already encrypted
  if (!safeStorage.isEncryptionAvailable()) return value // rare fallback
  return ENC_PREFIX + safeStorage.encryptString(value).toString('base64')
}

function decryptKey(value?: string): string | undefined {
  if (!value || !value.startsWith(ENC_PREFIX)) return value // legacy plaintext passthrough
  try {
    return safeStorage.decryptString(Buffer.from(value.slice(ENC_PREFIX.length), 'base64'))
  } catch {
    return undefined
  }
}

function mapKeys(
  keys: AppSettings['apiKeys'],
  fn: (v?: string) => string | undefined
): AppSettings['apiKeys'] {
  return {
    openai: fn(keys.openai),
    anthropic: fn(keys.anthropic),
    deepgram: fn(keys.deepgram)
  }
}

export function getSettings(): AppSettings {
  // Merge to guard against older configs missing newly-added keys.
  const merged = { ...DEFAULT_SETTINGS, ...store.store }
  // Migration: hotkey was once an Electron accelerator string → default to Fn.
  if (typeof (merged.hotkey as unknown) === 'string') {
    merged.hotkey = DEFAULT_SETTINGS.hotkey
  }
  merged.apiKeys = mapKeys(merged.apiKeys ?? {}, decryptKey)
  return merged
}

export function setSettings(partial: Partial<AppSettings>): AppSettings {
  const next = { ...getSettings(), ...partial }
  // Stamp the modification time for sync LWW — unless the caller supplied one
  // (e.g. when applying newer settings pulled from the cloud).
  if (!('settingsUpdatedAt' in partial)) next.settingsUpdatedAt = Date.now()
  // Encrypt API keys before persisting; return the plaintext view to the app.
  store.set({ ...next, apiKeys: mapKeys(next.apiKeys, encryptKey) })
  return next
}
