# Accounts & Cloud Sync (Supabase) — Setup

Login/sign-up (email + Google) and cloud sync of your replies & settings are
powered by Supabase. The app runs fine without it (sign-in is optional); these
steps turn it on.

## 1. Create a Supabase project
1. Go to <https://supabase.com> → New project (free tier is fine).
2. Project Settings → **API**: copy the **Project URL** and the **anon / public** key.

## 2. Point the app at your project
Create a `.env` file in the project root (it's git-ignored):

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_your-publishable-key
```

Restart `npm run dev`. Use the **publishable** key (`sb_publishable_…`) or the
legacy **anon/public** JWT — these are safe in a client app. **Never** put the
`sb_secret_…` / `service_role` key here: it bypasses Row-Level Security and would
expose your entire database to anyone who has the app.

## 3. Create the database tables
Open the project's **SQL Editor** and run the contents of
[`supabase/schema.sql`](supabase/schema.sql). This creates `profiles`,
`settings`, and `replies` with Row Level Security (each user sees only their own
rows) and a trigger that creates a profile on sign-up.

## 4. Enable Google sign-in
1. **Google Cloud Console** → APIs & Services → Credentials → **Create OAuth client ID**
   → *Web application*.
   - Authorized redirect URI:
     `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
   - Copy the **Client ID** and **Client secret**.
2. **Supabase** → Authentication → **Providers → Google** → enable, paste the
   Client ID + secret, save.

## 5. Allow the desktop redirect
Supabase → Authentication → **URL Configuration → Redirect URLs** → add:

```
http://localhost:8765/auth-callback
```

The desktop app runs a tiny local server on port 8765. The Google flow opens
your system browser, then redirects to this local address, which hands the
session back into the app. (This loopback approach is the reliable desktop
pattern and works in both dev and the packaged app.)

## 6. Email confirmation (optional)
Authentication → **Providers → Email**: if "Confirm email" is on, new sign-ups
must click the emailed link before they can sign in. Turn it off for a smoother
first run while testing.

## 7. Deploy the account-deletion function
The "Delete account" button calls a Supabase Edge Function that removes the auth
user (cascading to their data). Deploy it once:

```bash
supabase functions deploy delete-account
```

(The function uses the service-role key, which is injected automatically in the
Supabase Functions runtime — you do not put it in the app.)

## Try it
- `npm run dev` → open the app → **Account** in the sidebar.
- Sign up with email, or **Continue with Google** (browser opens → approve →
  returns to the app).
- Once signed in, your settings and new replies sync to your account; signing in
  on another machine pulls them back.

## Notes
- The OAuth deep link (`mindflow://`) is most reliable in the **packaged app**
  (the scheme is registered via electron-builder `protocols`). In `npm run dev`
  it usually works, but if the browser can't reopen the app, use email sign-in
  while developing.
- Data model & RLS live in `supabase/schema.sql`. Auth/sync code: `src/renderer/src/auth.tsx`, `supabase.ts`, `sync.ts`.
