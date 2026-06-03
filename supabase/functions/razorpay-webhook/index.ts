// Supabase Edge Function: receive Razorpay webhooks and credit the user.
// Deploy:  supabase functions deploy razorpay-webhook --no-verify-jwt
// (--no-verify-jwt because Razorpay calls this, not a logged-in user.)
//
// Verifies the HMAC-SHA256 signature over the RAW body, then on a paid
// payment-link applies the credit grant from the link's notes (set by our own
// create-payment-link function, so the client can't tamper with amounts).
// Idempotent via the billing_events table so retries don't double-credit.
//
// Secrets: RAZORPAY_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from 'jsr:@supabase/supabase-js@2'

async function validSignature(raw: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw))
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('')
  // Constant-time-ish compare.
  if (hex.length !== signature.length) return false
  let diff = 0
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ signature.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req) => {
  const raw = await req.text()
  const signature = req.headers.get('x-razorpay-signature') ?? ''
  const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')!

  if (!(await validSignature(raw, signature, secret))) {
    return new Response('invalid signature', { status: 400 })
  }

  type RzpEvent = {
    event?: string
    id?: string
    payload?: {
      payment_link?: { entity?: { notes?: Record<string, string>; id?: string } }
      payment?: { entity?: { id?: string } }
    }
  }
  let event: RzpEvent
  try {
    event = JSON.parse(raw) as RzpEvent
  } catch {
    return new Response('bad json', { status: 400 })
  }

  // We act on a successfully paid payment link.
  if (event.event !== 'payment_link.paid') {
    return new Response('ignored', { status: 200 })
  }

  const link = event.payload?.payment_link?.entity
  const payment = event.payload?.payment?.entity
  const notes = link?.notes ?? {}
  const eventId: string = payment?.id ?? link?.id ?? event.id ?? ''
  const userId: string = notes.user_id ?? ''
  const credits = parseInt(notes.credits ?? '0', 10)
  const kind: string = notes.kind ?? ''
  const plan: string = notes.plan ?? 'pro'

  if (!eventId || !userId || !credits) return new Response('missing data', { status: 200 })

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Idempotency: insert the event id; if it already exists, we've processed it.
  const { error: dupErr } = await admin.from('billing_events').insert({ id: eventId })
  if (dupErr) return new Response('already processed', { status: 200 })

  try {
    if (kind === 'topup') {
      await admin.rpc('apply_topup', { uid: userId, add_credits: credits })
    } else {
      await admin.rpc('apply_plan', { uid: userId, p: plan, grant_credits: credits, days: 30 })
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 })
  }

  return new Response('ok', { status: 200 })
})
