// Supabase Edge Function: delete the signed-in user's account + all their data.
// Deploy:  supabase functions deploy delete-account
//
// The caller passes their access token; we verify it, then use the service-role
// key (available only inside the function) to delete the auth user. The FKs on
// profiles/settings/replies are ON DELETE CASCADE, so their rows go too.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Resolve the user from their token, then delete them.
    const { data: userData, error: userErr } = await admin.auth.getUser(token)
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(userData.user.id)
    if (delErr) throw delErr

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }
})
