import Store from 'electron-store'
import os from 'os'
import { Dashboard, ReplyHistoryItem } from '../shared/types'
import { mergeById, nextStreak, wordCount } from './historyLogic'

/**
 * Persists recent replies + lightweight usage stats for the Home dashboard.
 * Backed by electron-store (JSON in userData).
 */
interface HistoryData {
  items: ReplyHistoryItem[]
  totalReplies: number
  totalWords: number
  dayStreak: number
  lastActiveDay: string // YYYY-M-D
}

const store = new Store<HistoryData>({
  name: 'history',
  defaults: { items: [], totalReplies: 0, totalWords: 0, dayStreak: 0, lastActiveDay: '' }
})

const MAX_ITEMS = 200

/**
 * Record a generated reply. Upserts by session id so a "Regenerate" updates the
 * same entry (and doesn't double-count stats).
 */
export function recordReply(item: {
  id: string
  app: string
  transcript: string
  reply: string
}): ReplyHistoryItem {
  const data = store.store
  const entry: ReplyHistoryItem = { ...item, time: Date.now() }
  const idx = data.items.findIndex((i) => i.id === item.id)

  if (idx >= 0) {
    data.items[idx] = entry // regenerate: refresh text, keep counts
  } else {
    data.items = mergeById([entry], data.items, MAX_ITEMS)
    data.totalReplies += 1
    data.totalWords += wordCount(item.reply)
    const { streak, today } = nextStreak(data.lastActiveDay, new Date(), data.dayStreak)
    data.dayStreak = streak
    data.lastActiveDay = today
  }
  store.set(data)
  return entry
}

/** Wipe all locally-stored replies + stats. */
export function clearHistory(): void {
  store.set({ items: [], totalReplies: 0, totalWords: 0, dayStreak: 0, lastActiveDay: '' })
}

/** Merge cloud replies into the local list (dedup by id, newest first). */
export function mergeReplies(incoming: ReplyHistoryItem[]): void {
  const data = store.store
  data.items = mergeById(data.items, incoming, MAX_ITEMS)
  store.set(data)
}

export function getDashboard(): Dashboard {
  const data = store.store
  return {
    name: deriveName(),
    stats: {
      totalReplies: data.totalReplies,
      totalWords: data.totalWords,
      dayStreak: data.dayStreak
    },
    history: data.items
  }
}

function deriveName(): string {
  try {
    const u = os.userInfo().username || ''
    return u ? u.charAt(0).toUpperCase() + u.slice(1) : ''
  } catch {
    return ''
  }
}
