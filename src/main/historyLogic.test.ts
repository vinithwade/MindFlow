import { describe, it, expect } from 'vitest'
import {
  mergeById,
  nextStreak,
  wordCount,
  dayKey,
  computeUsage,
  creditsFor,
  tierOf
} from './historyLogic'
import type { ReplyHistoryItem } from '../shared/types'

const item = (id: string, time: number): ReplyHistoryItem => ({
  id,
  time,
  app: 'X',
  transcript: 't',
  reply: 'r'
})

describe('wordCount', () => {
  it('counts words, handles blanks', () => {
    expect(wordCount('hello there world')).toBe(3)
    expect(wordCount('   ')).toBe(0)
    expect(wordCount('one')).toBe(1)
  })
})

describe('mergeById', () => {
  it('dedups by id (existing wins), sorts newest-first', () => {
    const existing = [item('a', 100)]
    const incoming = [item('a', 999), item('b', 200), item('c', 50)]
    expect(mergeById(existing, incoming, 10).map((m) => m.id)).toEqual(['b', 'a', 'c'])
  })
  it('respects the max cap', () => {
    const items = Array.from({ length: 5 }, (_, i) => item('x' + i, i))
    expect(mergeById(items, [], 3)).toHaveLength(3)
  })
})

describe('creditsFor / tierOf', () => {
  it('defaults legacy items (no tier) to standard / 1 credit', () => {
    expect(tierOf(item('a', 1))).toBe('standard')
    expect(creditsFor(item('a', 1))).toBe(1)
  })
  it('uses explicit credits when set, else derives from tier', () => {
    expect(creditsFor({ ...item('a', 1), tier: 'premium' })).toBe(8)
    expect(creditsFor({ ...item('a', 1), tier: 'premium', credits: 8 })).toBe(8)
    expect(creditsFor({ ...item('a', 1), tier: 'byo', credits: 0 })).toBe(0)
  })
})

describe('computeUsage', () => {
  const now = new Date('2026-06-03T10:00:00')
  const mk = (id: string, app: string, tier: 'standard' | 'premium', daysAgo: number): ReplyHistoryItem => ({
    id,
    time: new Date(now).setDate(now.getDate() - daysAgo),
    app,
    transcript: 't',
    reply: 'r',
    tier,
    credits: tier === 'premium' ? 8 : 1
  })

  it('splits tiers, totals credits, groups by app, builds a 30-day trend', () => {
    const items = [
      mk('a', 'WhatsApp', 'premium', 0),
      mk('b', 'WhatsApp', 'standard', 0),
      mk('c', 'Slack', 'standard', 1),
      mk('d', 'Slack', 'premium', 40) // outside the 30-day window
    ]
    const u = computeUsage(items, now)

    expect(u.premium).toEqual({ count: 2, credits: 16 })
    expect(u.standard).toEqual({ count: 2, credits: 2 })
    expect(u.totalCredits).toBe(18)
    expect(u.byApp[0]).toEqual({ app: 'WhatsApp', count: 2, credits: 9 })
    expect(u.daily).toHaveLength(30)
    // today's bucket = premium(8) + standard(1) from WhatsApp
    expect(u.daily[29].credits).toBe(9)
    // the 40-days-ago item is excluded from the 30-day trend
    expect(u.daily.reduce((s, d) => s + d.credits, 0)).toBe(10)
    expect(u.recent[0].id).toBe('a')
  })

  it('handles empty history', () => {
    const u = computeUsage([], now)
    expect(u.totalCredits).toBe(0)
    expect(u.byApp).toEqual([])
    expect(u.daily).toHaveLength(30)
    expect(u.recent).toEqual([])
  })
})

describe('nextStreak', () => {
  const now = new Date('2026-06-02T10:00:00')
  it('same day → unchanged', () => {
    expect(nextStreak(dayKey(now), now, 5)).toEqual({ streak: 5, today: '2026-6-2' })
  })
  it('yesterday → increments', () => {
    expect(nextStreak('2026-6-1', now, 5).streak).toBe(6)
  })
  it('gap → resets to 1', () => {
    expect(nextStreak('2026-5-20', now, 5).streak).toBe(1)
  })
  it('first ever (empty) → 1', () => {
    expect(nextStreak('', now, 0).streak).toBe(1)
  })
})
