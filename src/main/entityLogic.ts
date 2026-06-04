/**
 * Pure helpers for "My Info" — detect reusable personal details (email, links,
 * phone, social handles) in text, so they can be confirmed and later inserted
 * into replies. No Electron deps → unit-testable.
 */
import { MyInfoEntry, MyInfoKind } from '../shared/types'

export interface DetectedEntity {
  kind: MyInfoKind
  label: string
  value: string
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi
// Bare known-domain links without http/www (e.g. linkedin.com/in/you).
const BARE_RE =
  /\b(?:[a-z0-9-]+\.)*(?:linkedin|github|calendly|twitter|instagram|youtube|youtu|medium|substack|notion|figma|dribbble|behance)\.(?:com|be|io|so|site)\/[^\s<>"')\]]+/gi
const HANDLE_RE = /(?<![\w@./])@([A-Za-z0-9_]{2,30})\b/g
const PHONE_RE = /(?<![\w])\+?\d[\d\s().-]{6,}\d(?![\w])/g

/** Friendly label for a URL based on its host. */
export function labelForUrl(url: string): string {
  const host = url
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0]
    .toLowerCase()
  if (host.includes('linkedin')) return 'LinkedIn'
  if (host.includes('github')) return 'GitHub'
  if (host.includes('calendly')) return 'Calendly'
  if (host.includes('twitter') || host === 'x.com') return 'X'
  if (host.includes('instagram')) return 'Instagram'
  if (host.includes('youtube') || host.includes('youtu.be')) return 'YouTube'
  if (host.includes('medium') || host.includes('substack')) return 'Blog'
  return 'Website'
}

const trimEdge = (s: string): string => s.replace(/[.,;:!?)\]]+$/, '')

/** Detect personal entities in text. Order matters: emails first so @handle/phone don't double-match. */
export function detectEntities(text: string): DetectedEntity[] {
  if (!text) return []
  const out: DetectedEntity[] = []

  for (const m of text.matchAll(EMAIL_RE)) {
    out.push({ kind: 'email', label: 'Email', value: m[0] })
  }
  // Strip emails so their domains/@ don't get re-detected as links/handles.
  const noEmail = text.replace(EMAIL_RE, ' ')

  for (const m of noEmail.matchAll(URL_RE)) {
    const value = trimEdge(m[0])
    out.push({ kind: 'link', label: labelForUrl(value), value })
  }
  for (const m of noEmail.matchAll(BARE_RE)) {
    const value = trimEdge(m[0])
    out.push({ kind: 'link', label: labelForUrl(value), value })
  }

  for (const m of noEmail.matchAll(HANDLE_RE)) {
    out.push({ kind: 'handle', label: 'Handle', value: '@' + m[1] })
  }

  // Phone: scan with links removed; require 8–15 digits total.
  const noLinks = noEmail.replace(URL_RE, ' ').replace(BARE_RE, ' ')
  for (const m of noLinks.matchAll(PHONE_RE)) {
    const digits = m[0].replace(/\D/g, '')
    if (digits.length >= 8 && digits.length <= 15) {
      out.push({ kind: 'phone', label: 'Phone', value: m[0].trim() })
    }
  }

  return dedupe(out)
}

/** Detected entities whose value isn't already in the user's saved list. */
export function newEntities(existing: MyInfoEntry[], detected: DetectedEntity[]): DetectedEntity[] {
  const seen = new Set(existing.map((e) => norm(e.value)))
  const out: DetectedEntity[] = []
  for (const d of detected) {
    if (!seen.has(norm(d.value))) {
      seen.add(norm(d.value))
      out.push(d)
    }
  }
  return out
}

/** Prompt block listing confirmed details for the LLM to insert on request. */
export function infoForPrompt(entries: MyInfoEntry[]): string {
  const confirmed = entries.filter((e) => e.confirmed)
  if (!confirmed.length) return ''
  const lines = confirmed.map((e) => `- ${e.label}: ${e.value}`).join('\n')
  return `\n\nThe user's saved details — insert the EXACT value only if the user explicitly asks for it (e.g. "share my email"):\n${lines}`
}

const norm = (v: string): string => v.trim().toLowerCase().replace(/\/+$/, '')

function dedupe(items: DetectedEntity[]): DetectedEntity[] {
  const seen = new Set<string>()
  const out: DetectedEntity[] = []
  for (const it of items) {
    const k = it.kind + ':' + norm(it.value)
    if (!seen.has(k)) {
      seen.add(k)
      out.push(it)
    }
  }
  return out
}
