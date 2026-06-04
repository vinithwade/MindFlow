import { describe, it, expect } from 'vitest'
import { extractCandidates, learnFromEdit, mergeDict, spellingGuide, keywordsFor } from './dictionaryLogic'

describe('extractCandidates', () => {
  it('keeps proper nouns, acronyms, CamelCase, and hyphenated terms', () => {
    const got = extractCandidates('We deploy Kubernetes via the GitHub API on GPT-4 with Erik.')
    expect(got).toContain('Kubernetes')
    expect(got).toContain('GitHub')
    expect(got).toContain('API')
    expect(got).toContain('GPT-4')
    expect(got).toContain('Erik')
  })

  it('ignores common words and sentence-opening capitals', () => {
    const got = extractCandidates('Today we met. The meeting was good and we will reply soon.')
    expect(got).toEqual([]) // "Today"/"The" are sentence-start / common
  })

  it('ignores pure numbers and very short tokens', () => {
    expect(extractCandidates('It cost 4500 and I is a.')).toEqual([])
  })

  it('dedupes case-insensitively', () => {
    expect(extractCandidates('met Anthropic; later anthropic again (Anthropic).')).toEqual(['Anthropic'])
  })
})

describe('learnFromEdit', () => {
  it('returns terms the user added that were not in the original reply', () => {
    const original = 'Sounds good, I will send it over.'
    const final = 'Sounds good, I will send it to Priya at Acme.'
    const learned = learnFromEdit(original, final)
    expect(learned).toContain('Priya')
    expect(learned).toContain('Acme')
  })
  it('does not re-learn terms already in the original', () => {
    expect(learnFromEdit('Ping Priya now', 'Ping Priya now please')).toEqual([])
  })
})

describe('mergeDict', () => {
  it('dedupes case-insensitively and appends new', () => {
    expect(mergeDict(['Erik'], ['erik', 'Acme'])).toEqual(['Erik', 'Acme'])
  })
  it('caps to the most recent N', () => {
    const dict = Array.from({ length: 5 }, (_, i) => 'W' + i)
    expect(mergeDict(dict, ['New'], 3)).toEqual(['W3', 'W4', 'New'])
  })
})

describe('provider views', () => {
  it('spellingGuide builds a prompt string (empty when no terms)', () => {
    expect(spellingGuide([])).toBe('')
    expect(spellingGuide(['Erik', 'Acme'])).toMatch(/Erik, Acme/)
  })
  it('keywordsFor returns the capped tail', () => {
    expect(keywordsFor(['a', 'b', 'c'], 2)).toEqual(['b', 'c'])
    expect(keywordsFor(undefined)).toEqual([])
  })
})
