# Privacy Policy — MindFlow

_Last updated: 2026-06-02_

> **Template notice:** This is a good‑faith starting draft. Have it reviewed for
> your jurisdiction before publishing as your official policy. Replace
> `support@mindflow.app` and the company name with your details.

MindFlow ("the app", "we") is a macOS desktop app that turns your
voice plus what's on your screen into a polished, ready‑to‑send reply. This
policy explains what data the app handles and where it goes.

## What the app processes

- **Microphone audio (transient).** When you hold the shortcut, audio is
  recorded and sent to your selected speech‑to‑text provider for transcription.
  The app does not store raw audio after transcription.
- **On‑screen content (transient).** To ground a reply, the app reads the text
  you're replying to — via your text selection, macOS Accessibility, or (only if
  you enable it) a screenshot run through on‑device OCR. This content is sent to
  your selected AI model to generate the reply.
- **Generated replies & transcripts.** Stored locally on your device, and — only
  if you sign in — synced to your account so they're available across devices.
- **Account information.** If you create an account, we store your email and
  (optionally) name via our authentication provider.
- **Settings.** Your preferences (shortcut, tone, providers) are stored locally
  and, if signed in, synced to your account. **API keys are encrypted on your
  device** and are not transmitted to our servers.

## Third‑party services

Depending on your configuration, your audio / screen content / text is sent to:

- **OpenAI** and/or **Anthropic** — reply generation (and OpenAI Whisper for
  transcription).
- **Deepgram** — transcription (if selected).
- **Supabase** — authentication and cloud sync of your replies/settings.
- **Google** — only if you choose "Sign in with Google" (email + basic profile).

These providers process data under their own privacy policies. We send only what
is needed to perform the requested action.

## Storage & retention

- Local data lives in the app's storage on your Mac until you clear it or delete
  the app.
- Synced data is retained in your account until you delete it or delete your
  account. Deleting your account removes your synced replies, settings, and
  profile.

## Your choices

- Use the app **without signing in** (no cloud sync).
- **Disable screenshot OCR** (off by default).
- **Clear local history**, **export your data**, or **delete your account** from
  the app's Account settings.

## Security

API keys are encrypted at rest using the operating system keychain. Network
requests use HTTPS. Per‑user data is isolated with row‑level security.

## Contact

Questions or data requests: **support@mindflow.app**.
