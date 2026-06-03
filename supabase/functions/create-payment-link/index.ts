// Supabase Edge Function: create a Razorpay Payment Link for a plan or top-up.
// Deploy:  supabase functions deploy create-payment-link
//
// The signed-in user calls this with { planId }. We verify their token, map the
// planId to a SERVER-AUTHORITATIVE amount + credit grant (the client can't set
// the price), create a Razorpay Payment Link tagged with notes, and return its
// short_url. The app opens that URL in the system browser to pay.
//
// Secrets (Supabase → Edge Function secrets):
//   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

// Server-authoritative catalog. amount is in paise (₹799 = 79900).
// 'plan' purchases set a 30-day pass + full refill; 'topup' adds credits.
const CATALOG: Record<
  string,
  { kind: 'plan' | 'topup'; amount: number; credits: number; plan?: string; label: string }
> = {
  pro: { kind: 'plan', amount: 79900, credits: 2000, plan: 'pro', label: 'MindFlow Pro — 30 days' },
  pro_plus: {
    kind: 'plan',
    amount: 159900,
    credits: 5000,
    plan: 'pro_plus',
    label: 'MindFlow Pro+ — 30 days'
  },
  topup_1000: { kind: 'topup', amount: 39900, credits: 1000, label: '1,000 MindFlow credits' },
  topup_2500: { kind: 'topup', amount: 79900, credits: 2500, label: '2,500 MindFlow credits' },
  topup_6000: { kind: 'topup', amount: 159900, credits: 6000, label: '6,000 MindFlow credits' }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' }
    })

  try {
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    if (!token) return json({ error: 'Not authenticated' }, 401)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const { data: userData, error: userErr } = await admin.auth.getUser(token)
    if (userErr || !userData.user) return json({ error: 'Invalid session' }, 401)
    const user = userData.user

    const { planId } = await req.json().catch(() => ({}))
    const item = CATALOG[planId]
    if (!item) return json({ error: 'Unknown plan' }, 400)

    const keyId = Deno.env.get('RAZORPAY_KEY_ID')!
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!
    const auth = 'Basic ' + btoa(`${keyId}:${keySecret}`)

    const res = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: item.amount,
        currency: 'INR',
        description: item.label,
        // Notes are echoed back on the webhook — the source of truth for crediting.
        notes: {
          user_id: user.id,
          plan_id: planId,
          kind: item.kind,
          credits: String(item.credits),
          plan: item.plan ?? ''
        },
        customer: { email: user.email ?? undefined },
        notify: { email: false, sms: false },
        reminder_enable: false
      })
    })

    const data = await res.json()
    if (!res.ok) return json({ error: data?.error?.description ?? 'Razorpay error' }, 502)
    return json({ url: data.short_url })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
