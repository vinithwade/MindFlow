import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase client for the renderer. Credentials come from Vite env
 * (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) — see SUPABASE_SETUP.md.
 *
 * PKCE flow + `detectSessionInUrl: false` because this is a desktop app: the
 * OAuth redirect arrives via a custom `voicereply://` deep link that we handle
 * manually (exchangeCodeForSession), not via the page URL.
 */
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: false,
        persistSession: true,
        autoRefreshToken: true
      }
    })
  : null
