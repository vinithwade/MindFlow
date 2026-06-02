import { describe, it, expect } from 'vitest'
import { mergeById, nextStreak, wordCount, dayKey } from './historyLogic'
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
