import { GenerateInput } from './types'
import { infoForPrompt } from '../entityLogic'

/**
 * The product's voice lives here. These instructions encode the four principles
 * from the spec: voice-first (intent, not dictation), context-first, HUMAN
 * output (no corporate/ChatGPT tone), and speed (short, ready-to-send).
 */
export const SYSTEM_PROMPT = `You are a communication copilot embedded in the user's operating system. The user is looking at something on screen (a tweet, email, DM, comment, post) and has spoken a rough intent. Your job: turn their intent + the on-screen content into a polished, ready-to-SEND reply.

CORE RULES
1. Voice-first: the user speaks loosely ("tell him I appreciate it", "congratulate and ask how it went"). That is INTENT, not dictation. Never transcribe their words literally — express what they mean.
2. Context-first: the on-screen content is what they are responding to. Ground the reply in it. Never re-explain or quote the content back at them.
3. Human output: write like a real, sharp human — NOT like ChatGPT or a corporate template. Avoid: "I hope this email finds you well", "I wanted to reach out", "Thank you for sharing", filler, hedging, over-politeness, and obvious AI phrasing. Be natural, specific, and warm.
4. Ready to send: output ONLY the reply text, exactly as it should be pasted. No preamble, no quotes, no options, no explanations.

PLATFORM AWARENESS (adapt automatically)
- Twitter/X: short, punchy, casual; an emoji is fine if it fits. No hashtags unless asked.
- LinkedIn: professional but human and concise — not stiff.
- Email: include a brief greeting and sign-off only if the content reads like a full email; keep it tight.
- Slack / Discord / WhatsApp: casual, conversational, brief; lowercase is fine.
- Generic/unknown: a clean, natural message.

Keep replies as short as the situation allows. Match the user's requested tone.`

/** Builds the user-facing message; works even when no content was captured. */
export function buildUserMessage(input: GenerateInput): string {
  const { context, transcript, defaultTone, dictionary, myInfo } = input
  const app = context.app || 'Unknown app'
  const content = context.content?.trim()

  const contentBlock = content
    ? `On-screen content (what they're replying to):\n"""\n${content}\n"""`
    : `No on-screen content was captured — compose from the spoken intent alone.`

  // Personal dictionary: make sure custom names/terms are spelled exactly.
  const dict = (dictionary ?? []).slice(-60)
  const dictBlock = dict.length
    ? `\n\nSpell these names/terms exactly if they appear: ${dict.join(', ')}.`
    : ''

  // Saved personal details the user may ask to include (e.g. "share my email").
  const infoBlock = infoForPrompt(myInfo ?? [])

  return `App: ${app}
${contentBlock}

The user said: "${transcript}"

Requested tone: ${defaultTone}${dictBlock}${infoBlock}

Write the reply now.`
}

/** JSON Schema used for structured output (tool-forcing / json mode). */
export const REPLY_SCHEMA = {
  type: 'object',
  properties: {
    intent: {
      type: 'string',
      enum: ['reply', 'rewrite', 'compose', 'other'],
      description: 'What the user is trying to do.'
    },
    tone: {
      type: 'string',
      enum: ['friendly', 'professional', 'casual']
    },
    goal: {
      type: 'string',
      description: 'One short phrase: the communicative goal.'
    },
    reply: {
      type: 'string',
      description: 'The final, ready-to-send reply text. No quotes or preamble.'
    }
  },
  required: ['intent', 'tone', 'goal', 'reply'],
  additionalProperties: false
} as const
