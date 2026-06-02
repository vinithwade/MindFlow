import { supabase } from './supabase'
import type { AppSettings, ReplyHistoryItem } from '@shared/types'

/**
 * Cloud sync of settings + reply history to Supabase (per-user, RLS-protected).
 *  - On sign-in: pull cloud settings (or push local if none), and merge replies
 *    both directions.
 *  - Going forward: pushSettings on change, pushReply per new reply.
 */

async function uid(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

export async function syncOnSignIn(): Promise<void> {
  if (!supabase) return
  const userId = await uid()
  if (!userId) return

  try {
    // --- Settings (last-write-wins by settingsUpdatedAt) ---
    const local = await window.api.getSettings()
    if (!local.syncEnabled) return // local-only mode
    const { data: row } = await supabase
      .from('settings')
      .select('data')
      .eq('user_id', userId)
      .maybeSingle()

    const cloudSettings = row?.data as AppSettings | undefined
    if (
      cloudSettings &&
      (cloudSettings.settingsUpdatedAt ?? 0) > (local.settingsUpdatedAt ?? 0)
    ) {
      // Cloud is newer → apply it locally, preserving its timestamp. Never let an
      // empty cloud API key clobber a key entered locally.
      await window.api.setSettings({
        ...cloudSettings,
        apiKeys: { ...local.apiKeys, ...cloudSettings.apiKeys }
      })
    } else {
      // Local is newer (or no cloud yet) → push local up.
      await pushSettings(local)
    }

    // --- Replies (push local up, then pull cloud down + merge) ---
    const localHistory = (await window.api.getDashboard()).history
    if (localHistory.length) {
      const { error: upErr } = await supabase.from('replies').upsert(
        localHistory.map((r) => ({
          id: r.id,
          user_id: userId,
          app: r.app,
          transcript: r.transcript,
          reply: r.reply,
          created_at: new Date(r.time).toISOString()
        })),
        { onConflict: 'id' }
      )
      if (upErr) console.warn('[sync] push replies failed:', upErr.message)
    }

    const { data: cloud } = await supabase
      .from('replies')
      .select('id, app, transcript, reply, created_at')
      .order('created_at', { ascending: false })
      .limit(200)

    if (cloud?.length) {
      const items: ReplyHistoryItem[] = cloud.map((r) => ({
        id: r.id,
        app: r.app ?? '',
        transcript: r.transcript ?? '',
        reply: r.reply ?? '',
        time: new Date(r.created_at).getTime()
      }))
      await window.api.mergeHistory(items)
    }
  } catch (err) {
    console.warn('[sync] sign-in sync failed:', (err as Error).message)
  }
}

export async function pushSettings(settings: AppSettings): Promise<void> {
  if (!supabase) return
  const userId = await uid()
  if (!userId) return
  await supabase
    .from('settings')
    .upsert({ user_id: userId, data: settings, updated_at: new Date().toISOString() })
}

export async function pushReply(item: ReplyHistoryItem): Promise<void> {
  if (!supabase) return
  const userId = await uid()
  if (!userId) return
  const { error } = await supabase.from('replies').upsert(
    {
      id: item.id,
      user_id: userId,
      app: item.app,
      transcript: item.transcript,
      reply: item.reply,
      created_at: new Date(item.time).toISOString()
    },
    { onConflict: 'id' }
  )
  if (error) console.warn('[sync] pushReply failed:', error.message)
}
