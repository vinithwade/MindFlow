import { describe, it, expect } from 'vitest'
import { detectEntities, labelForUrl, newEntities, infoForPrompt } from './entityLogic'
import type { MyInfoEntry } from '../shared/types'

describe('detectEntities', () => {
  it('detects email, link (labeled), handle, and phone', () => {
    const text =
      'Reach me at devshooked@gmail.com, my work is at https://github.com/dev, ping @devshooked or call +1 415 555 0199.'
    const got = detectEntities(text)
    const byKind = (k: string): string[] => got.filter((e) => e.kind === k).map((e) => e.value)
    expect(byKind('email')).toContain('devshooked@gmail.com')
    expect(got.find((e) => e.kind === 'link')?.label).toBe('GitHub')
    expect(byKind('handle')).toContain('@devshooked')
    expect(byKind('phone').length).toBe(1)
  })

  it("doesn't mistake an email's @ for a handle", () => {
    const got = detectEntities('email me: a@b.com')
    expect(got.filter((e) => e.kind === 'handle')).toEqual([])
    expect(got.filter((e) => e.kind === 'email').length).toBe(1)
  })

  it('labels links by domain', () => {
    expect(labelForUrl('https://www.linkedin.com/in/you')).toBe('LinkedIn')
    expect(labelForUrl('calendly.com/you/30min')).toBe('Calendly')
    expect(labelForUrl('https://acme.io/about')).toBe('Website')
  })

  it('ignores short digit strings as phone', () => {
    expect(detectEntities('it costs 4500 dollars').filter((e) => e.kind === 'phone')).toEqual([])
  })
})

describe('newEntities', () => {
  it('skips values already saved (normalized)', () => {
    const existing: MyInfoEntry[] = [
      { id: '1', label: 'Email', value: 'A@B.com', kind: 'email', confirmed: true }
    ]
    const detected = detectEntities('a@b.com and new@x.com')
    expect(newEntities(existing, detected).map((e) => e.value)).toEqual(['new@x.com'])
  })
})

describe('infoForPrompt', () => {
  it('lists only confirmed entries', () => {
    const entries: MyInfoEntry[] = [
      { id: '1', label: 'Email', value: 'a@b.com', kind: 'email', confirmed: true },
      { id: '2', label: 'Phone', value: '+1 415 555 0199', kind: 'phone', confirmed: false }
    ]
    const out = infoForPrompt(entries)
    expect(out).toMatch(/Email: a@b.com/)
    expect(out).not.toMatch(/Phone/)
  })
  it('is empty when nothing confirmed', () => {
    expect(infoForPrompt([])).toBe('')
  })
})
