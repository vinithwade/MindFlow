import { ReplyHistoryItem } from '../shared/types'

/**
 * Pure history helpers (no Electron / store deps) so they're unit-testable.
 */

export const dayKey = (d: Date): string => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`

export const wordCount = (s: string): number => (s.trim() ? s.trim().split(/\s+/).length : 0)

/** Merge incoming items into existing, dedup by id, newest first, capped. */
export function mergeById(
  existing: ReplyHistoryItem[],
  incoming: ReplyHistoryItem[],
  max: number
): ReplyHistoryItem[] {
  const byId = new Map<string, ReplyHistoryItem>()
  for (const it of existing) byId.set(it.id, it)
  for (const it of incoming) if (!byId.has(it.id)) byId.set(it.id, it)
  return Array.from(byId.values())
    .sort((a, b) => b.time - a.time)
    .slice(0, max)
}

/** New day-streak given the last active day (consecutive-days logic). */
export function nextStreak(
  lastActiveDay: string,
  now: Date,
  currentStreak: number
): { streak: number; today: string } {
  const today = dayKey(now)
  if (lastActiveDay === today) return { streak: currentStreak, today }
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const streak = lastActiveDay === dayKey(yesterday) ? (currentStreak || 0) + 1 : 1
  return { streak, today }
}
