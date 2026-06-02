import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from './supabase'
import { syncOnSignIn } from './sync'

interface AuthValue {
  configured: boolean
  loading: boolean
  completing: boolean
  authError: string | null
  session: Session | null
  user: User | null
  signInEmail: (email: string, password: string) => Promise<void>
  signUpEmail: (email: string, password: string, name?: string) => Promise<{ needsConfirm: boolean }>
  resendConfirmation: (email: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  deleteAccount: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)


export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const processed = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      void window.api.setAuthed(!!data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      void window.api.setAuthed(!!s) // lock/unlock the Fn feature in main
      if (event === 'SIGNED_IN' && s) void syncOnSignIn()
    })

    // OAuth deep-link callback (mindflow://auth-callback?code=…) from main.
    const offCb = window.api.onAuthCallback((url) => void handleCallback(url))

    return () => {
      sub.subscription.unsubscribe()
      offCb()
    }
  }, [])

  async function handleCallback(rawUrl: string): Promise<void> {
    if (!supabase) return
    try {
      const u = new URL(rawUrl)
      const errParam = u.searchParams.get('error_description') || u.searchParams.get('error')
      if (errParam) {
        setAuthError(errParam)
        return
      }

      const code = u.searchParams.get('code')
      if (code) {
        if (processed.current.has(code)) return // ignore duplicate callbacks
        processed.current.add(code)
        setCompleting(true)
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        setAuthError(error ? error.message : null)
        setCompleting(false)
        return
      }

      // Fallback: implicit tokens in the fragment (deep-link path).
      const frag = new URLSearchParams(u.hash.replace(/^#/, ''))
      const access_token = frag.get('access_token')
      const refresh_token = frag.get('refresh_token')
      if (access_token && refresh_token) {
        setCompleting(true)
        const { error } = await supabase.auth.setSession({ access_token, refresh_token })
        if (error) setAuthError(error.message)
        setCompleting(false)
      }
    } catch (err) {
      setAuthError((err as Error).message)
      setCompleting(false)
    }
  }

  const value: AuthValue = {
    configured: isSupabaseConfigured,
    loading,
    completing,
    authError,
    session,
    user: session?.user ?? null,

    signInEmail: async (email, password) => {
      if (!supabase) throw new Error('Supabase not configured.')
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    },

    signUpEmail: async (email, password, name) => {
      if (!supabase) throw new Error('Supabase not configured.')
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: name ? { name } : undefined }
      })
      if (error) throw error
      // If email confirmation is on, there's no session yet.
      return { needsConfirm: !data.session }
    },

    resendConfirmation: async (email) => {
      if (!supabase) throw new Error('Supabase not configured.')
      const { error } = await supabase.auth.resend({ type: 'signup', email })
      if (error) throw error
    },

    signInWithGoogle: async () => {
      if (!supabase) throw new Error('Supabase not configured.')
      setAuthError(null)
      // Arm the loopback listener and target the port main is actually on.
      await window.api.oauthBegin()
      const port = await window.api.getAuthPort()
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `http://localhost:${port}/auth-callback`, skipBrowserRedirect: true }
      })
      if (error) throw error
      if (data?.url) await window.api.openExternal(data.url)
    },

    signOut: async () => {
      if (!supabase) return
      await supabase.auth.signOut()
    },

    deleteAccount: async () => {
      if (!supabase) return
      const { error } = await supabase.functions.invoke('delete-account')
      if (error) throw error
      await supabase.auth.signOut()
    }
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
