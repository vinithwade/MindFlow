import { supabase } from './supabase'
import type { CreditAccount } from '@shared/types'

/**
 * Read the signed-in user's authoritative credit balance from Supabase.
 * The app only ever READS this — the balance is written server-side by the
 * billing gateway (service role). Returns null if not signed in / no row yet.
 */
export async function fetchCredits(): Promise<CreditAccount | null> {
  if (!supabase) return null
  const { data: u } = await supabase.auth.getUser()
  const userId = u.user?.id
  if (!userId) return null

  const { data, error } = await supabase
    .from('credits')
    .select('plan, balance, monthly_grant, period_end')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return null
  return {
    plan: (data.plan as CreditAccount['plan']) ?? 'trial',
    balance: data.balance ?? 0,
    monthlyGrant: data.monthly_grant ?? 0,
    periodEnd: data.period_end ?? null
  }
}

/**
 * Ask the backend (Razorpay Edge Function) for a hosted payment-link URL to buy
 * a plan or top-up. Returns { url } to open in the browser, or { error }.
 */
export async function createPaymentLink(
  planId: string
): Promise<{ url?: string; error?: string }> {
  if (!supabase) return { error: 'Not signed in.' }
  const { data, error } = await supabase.functions.invoke('create-payment-link', {
    body: { planId }
  })
  if (error) {
    console.warn('[billing] create-payment-link failed:', error.message)
    // The most common cause in dev is the function not being deployed yet.
    return {
      error:
        'Checkout is not available yet — the payment function isn’t deployed. ' +
        'Finish the Razorpay setup (deploy the Edge Functions), then try again.'
    }
  }
  const url = (data as { url?: string })?.url
  return url ? { url } : { error: (data as { error?: string })?.error ?? 'No payment link returned.' }
}

/**
 * Spend `amount` credits for the signed-in user (atomic, server-side, own-row
 * only). Returns the new balance, or null if not signed in / failed.
 */
export async function spendCredits(amount: number): Promise<number | null> {
  if (!supabase || !amount || amount <= 0) return null
  const { data, error } = await supabase.rpc('spend_credits', { amount })
  if (error) {
    console.warn('[credits] spend failed:', error.message)
    return null
  }
  return typeof data === 'number' ? data : null
}
