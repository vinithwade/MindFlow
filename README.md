# Voice Reply Assistant

A desktop **communication copilot**. Read a tweet / email / DM, **hold a shortcut, speak your intent**, and a polished, human-sounding reply appears in a floating overlay — ready to insert. No copy-paste into ChatGPT, no prompt engineering.

> Wispr Flow converts voice → text. This converts **voice + screen context → an intelligent reply.**

## How it works — the 5 layers

| Layer | Module | What it does |
|---|---|---|
| **1 · Voice** | `src/main/hotkey.ts`, `src/renderer/src/useRecorder.ts`, `src/main/stt/` | Hold-to-talk hotkey → mic capture → speech-to-text (OpenAI Whisper / Deepgram). |
| **2 · Context** | `src/main/context/` | Detects the active app and extracts what's on screen via a fallback chain: **selected text → Accessibility → OCR**. Produces `{ app, content }`. |
| **3+4 · Intent + Generation** | `src/main/llm/` | One structured LLM call (Claude / OpenAI) turns `{context, transcript}` into a ready-to-send reply tuned to be **human, not corporate**. |
| **5 · Insertion** | `src/main/insert.ts` | Pastes the reply back into the source app (replaces the selection when there was one). |

The overlay (`src/renderer/src/OverlayApp.tsx`) is the surface: `listening → transcribing → thinking → ready`, with Insert / Regenerate / Copy / Edit.

## Run it (dev)

```bash
npm install
npm run dev
```

1. In the **Settings** window, paste an API key:
   - **OpenAI** key (covers both Whisper STT and GPT replies), or
   - **Anthropic** key for Claude replies (+ a Whisper/Deepgram key for STT).
   Pick your STT and reply providers, set a tone, **Save**.
2. **Hold `Ctrl+Shift+Space`**, speak your intent (e.g. *"congratulate him and ask how the launch went"*), release.
3. The reply appears in the overlay near your cursor → **Insert**.

## macOS permissions (first run)

The app needs three permissions — grant them in **System Settings → Privacy & Security**:
- **Microphone** — to hear you.
- **Accessibility** — for the global hold-to-talk hook and to send copy/paste keystrokes.
- **Screen Recording** — only for the OCR fallback (optional).

## Scripts
- `npm run dev` — run in development.
- `npm run build` — build main/preload/renderer bundles.
- `npm run typecheck` — full TypeScript check.
- `npm run package` — package a macOS app (unsigned, `--dir`).

## Scope
**V1 = reply generation only.** Not a chatbot, not a note-taker, no memory. Personal memory / writing-style learning is a future version (the `{app, content}` context object and provider interfaces are designed so it can layer on without rework).

## Stack
Electron + Vite + React + TypeScript + Tailwind. STT: OpenAI Whisper / Deepgram. LLM: Claude (`claude-sonnet-4-6`) / OpenAI (`gpt-4o-mini`). Hold-to-talk via `uiohook-napi`; context via AppleScript + `screencapture` + `tesseract.js`.
