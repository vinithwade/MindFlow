import { ReplyHistoryItem, ReplyTier, Usage, CREDIT_COST } from '../shared/types'

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

/** Tier of a reply, defaulting legacy items (no tier recorded) to standard. */
export const tierOf = (item: ReplyHistoryItem): ReplyTier => item.tier ?? 'standard'

/** Credits a reply consumed — explicit value if present, else derived from tier. */
export const creditsFor = (item: ReplyHistoryItem): number =>
  typeof item.credits === 'number' ? item.credits : CREDIT_COST[tierOf(item)]

/** Compute the usage breakdown (tiers, by-app, 30-day trend, recent) from history. */
export function computeUsage(items: ReplyHistoryItem[], now: Date, recentN = 12): Usage {
  const standard: { count: number; credits: number } = { count: 0, credits: 0 }
  const premium: { count: number; credits: number } = { count: 0, credits: 0 }
  const byAppMap = new Map<string, { count: number; credits: number }>()
  const byDay = new Map<string, number>()
  let totalCredits = 0

  for (const it of items) {
    const c = creditsFor(it)
    totalCredits += c
    const tier = tierOf(it)
    if (tier === 'premium') {
      premium.count += 1
      premium.credits += c
    } else if (tier === 'standard') {
      standard.count += 1
      standard.credits += c
    }
    const app = it.app || 'Unknown'
    const a = byAppMap.get(app) ?? { count: 0, credits: 0 }
    a.count += 1
    a.credits += c
    byAppMap.set(app, a)
    byDay.set(dayKey(new Date(it.time)), (byDay.get(dayKey(new Date(it.time))) ?? 0) + c)
  }

  const byApp = Array.from(byAppMap.entries())
    .map(([app, v]) => ({ app, ...v }))
    .sort((a, b) => b.credits - a.credits)
    .slice(0, 5)

  // Last 30 days, oldest → newest, zero-filled so the trend chart is continuous.
  const daily: Usage['daily'] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const k = dayKey(d)
    daily.push({ day: k, credits: byDay.get(k) ?? 0 })
  }

  const recent = [...items].sort((a, b) => b.time - a.time).slice(0, recentN)

  return { standard, premium, byApp, daily, recent, totalCredits }
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
