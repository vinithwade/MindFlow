/**
 * Pure helpers for the personal dictionary (no Electron/store deps → testable).
 *
 * Goal: spot the user's "unique" words — proper nouns, brand/product names,
 * acronyms, jargon — while ignoring everyday words, so we can auto-learn them
 * and bias transcription + reply spelling toward them.
 */

/** Everyday words we never want in the dictionary (lowercased). */
const COMMON = new Set(
  (
    'the a an and or but if then else of to in on at by for with from into over under as is are was ' +
    'were be been being am do does did done has have had having i you he she it we they me him her us them ' +
    'my your his its our their this that these those there here what which who whom whose when where why how ' +
    'not no yes ok okay so just very really too also can could will would should shall may might must ' +
    'about above after again against all any because before below between both during each few more most ' +
    'other some such only own same than that once now today tonight tomorrow yesterday day week month year ' +
    'hi hey hello thanks thank please sure yeah yep nope let lets get got go going get make made want need ' +
    'good great nice cool sounds works work let me know reply send message email call meeting time'
  ).split(/\s+/)
)

const isCommon = (w: string): boolean => COMMON.has(w.toLowerCase())

/** Strip leading/trailing punctuation, keep internal hyphens/apostrophes. */
const clean = (tok: string): string => tok.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '')

/**
 * Extract proper-noun-like terms from free text. Keeps ALL-CAPS acronyms,
 * CamelCase, hyphenated terms with a capital, and capitalized words that are
 * NOT at the start of a sentence (so generic sentence openers aren't learned).
 */
export function extractCandidates(text: string): string[] {
  if (!text) return []
  const words = text.split(/\s+/)
  const out: string[] = []
  let atSentenceStart = true

  for (const raw of words) {
    const tok = clean(raw)
    const startsHere = atSentenceStart
    atSentenceStart = /[.!?]["')\]]*$/.test(raw) // next token begins a sentence
    if (tok.length < 2 || /^\d+$/.test(tok) || isCommon(tok)) continue

    const isAcronym = /^[A-Z0-9]{2,6}$/.test(tok) && /[A-Z]/.test(tok) // API, GPT, NASA
    const isCamel = /[a-z][A-Z]/.test(tok) // MindFlow, iPhone, GitHub
    const isHyphenTerm = tok.includes('-') && /[A-Z]/.test(tok) // GPT-4, Nova-Pro
    const isProperNoun = /^[A-Z][a-z'’]{2,}$/.test(tok) && !startsHere // Erik, Kubernetes (mid-sentence)

    if (isAcronym || isCamel || isHyphenTerm || isProperNoun) out.push(tok)
  }
  return dedupe(out)
}

/** Terms the user added when editing the draft (present in final, absent in the original reply). */
export function learnFromEdit(originalReply: string, finalText: string): string[] {
  const orig = new Set(
    (originalReply || '').split(/\s+/).map((w) => clean(w).toLowerCase()).filter(Boolean)
  )
  return extractCandidates(finalText).filter((t) => !orig.has(t.toLowerCase()))
}

/** Merge new terms into the dictionary (case-insensitive dedupe, newest-capped). */
export function mergeDict(dict: string[], newTerms: string[], cap = 200): string[] {
  const seen = new Set(dict.map((d) => d.toLowerCase()))
  const merged = [...dict]
  for (const t of newTerms) {
    const key = t.toLowerCase()
    if (!seen.has(key)) {
      merged.push(t)
      seen.add(key)
    }
  }
  return merged.length > cap ? merged.slice(merged.length - cap) : merged
}

/** Whisper `prompt` string — a short spelling guide (most-recent terms). */
export function spellingGuide(dict: string[] | undefined, max = 60): string {
  const terms = (dict ?? []).slice(-max)
  return terms.length ? `Spell these names and terms correctly: ${terms.join(', ')}.` : ''
}

/** Deepgram `keywords` array (most-recent terms, capped). */
export function keywordsFor(dict: string[] | undefined, max = 50): string[] {
  return (dict ?? []).slice(-max)
}

function dedupe(arr: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of arr) {
    const k = t.toLowerCase()
    if (!seen.has(k)) {
      seen.add(k)
      out.push(t)
    }
  }
  return out
}
