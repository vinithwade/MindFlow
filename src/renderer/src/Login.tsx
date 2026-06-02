import { useState } from 'react'
import { useAuth } from './auth'
import { PRIVACY_URL, TERMS_URL } from './legal'

/**
 * Login / Sign-up screen (white theme). Email + password and "Continue with
 * Google". Shown in the Account section when signed out.
 */
export function Login(): JSX.Element {
  const {
    configured,
    signInEmail,
    signUpEmail,
    resendConfirmation,
    signInWithGoogle,
    completing,
    authError
  } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [needsConfirm, setNeedsConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!configured) {
    return (
      <div className="mx-auto mt-10 max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        <div className="mb-1 font-semibold">Sign-in isn't configured yet</div>
        Add your Supabase credentials (a <code>.env</code> with{' '}
        <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>) and restart. See{' '}
        <span className="font-medium">SUPABASE_SETUP.md</span> for the full steps.
      </div>
    )
  }

  const signup = mode === 'signup'

  async function submit(): Promise<void> {
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      if (signup) {
        const res = await signUpEmail(email, password, name || undefined)
        if (res.needsConfirm) {
          setNeedsConfirm(true)
          setInfo('Check your email to confirm your account, then sign in.')
        }
      } else {
        await signInEmail(email, password)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function google(): Promise<void> {
    setError(null)
    try {
      await signInWithGoogle()
      setInfo('Continue in your browser, then come back here.')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="mx-auto mt-6 max-w-sm">
      <h1 className="text-xl font-semibold text-gray-900">
        {signup ? 'Create your account' : 'Welcome back'}
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        {signup ? 'Sign up to sync your replies across devices.' : 'Sign in to sync your replies.'}
      </p>

      <button
        onClick={() => void google()}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 shadow-sm transition hover:bg-gray-50"
      >
        <GoogleMark />
        Continue with Google
      </button>

      <div className="my-4 flex items-center gap-3 text-xs text-gray-400">
        <div className="h-px flex-1 bg-gray-200" />
        or
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      <div className="space-y-3">
        {signup && (
          <input
            className="login-input"
            placeholder="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
        <input
          className="login-input"
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="login-input"
          type="password"
          placeholder="Password"
          autoComplete={signup ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
        />
      </div>

      {completing && (
        <p className="mt-3 text-sm text-gray-500">Completing sign-in…</p>
      )}
      {(error || authError) && (
        <p className="mt-3 text-sm text-rose-600">{error || authError}</p>
      )}
      {info && <p className="mt-3 text-sm text-emerald-600">{info}</p>}
      {needsConfirm && (
        <button
          onClick={async () => {
            try {
              await resendConfirmation(email)
              setInfo('Confirmation email re-sent.')
            } catch (e) {
              setError((e as Error).message)
            }
          }}
          className="mt-1 text-xs font-medium text-accent hover:underline"
        >
          Resend confirmation email
        </button>
      )}

      <button
        onClick={() => void submit()}
        disabled={busy || !email || !password}
        className="mt-4 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-105 disabled:opacity-40"
      >
        {busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}
      </button>

      <p className="mt-4 text-center text-sm text-gray-500">
        {signup ? 'Already have an account?' : "Don't have an account?"}{' '}
        <button
          className="font-medium text-accent hover:underline"
          onClick={() => {
            setMode(signup ? 'signin' : 'signup')
            setError(null)
            setInfo(null)
          }}
        >
          {signup ? 'Sign in' : 'Sign up'}
        </button>
      </p>

      <p className="mt-4 text-center text-[11px] leading-relaxed text-gray-400">
        By continuing you agree to our{' '}
        <button className="underline hover:text-gray-600" onClick={() => void window.api.openExternal(TERMS_URL)}>
          Terms
        </button>{' '}
        &{' '}
        <button className="underline hover:text-gray-600" onClick={() => void window.api.openExternal(PRIVACY_URL)}>
          Privacy Policy
        </button>
        .
      </p>

      <style>{`
        .login-input { width: 100%; border: 1px solid #e5e7eb; border-radius: 12px;
          padding: 10px 14px; font-size: 14px; color: #111827; outline: none; background: #fff; }
        .login-input:focus { border-color: #2f7ff0; box-shadow: 0 0 0 3px rgba(47,127,240,0.15); }
      `}</style>
    </div>
  )
}

function GoogleMark(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}
