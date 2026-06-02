import { describe, it, expect } from 'vitest'
import { buildUserMessage, SYSTEM_PROMPT, REPLY_SCHEMA } from './prompt'

describe('buildUserMessage', () => {
  it('includes app, on-screen content, transcript, and tone', () => {
    const msg = buildUserMessage({
      context: {
        app: 'Twitter/X',
        appProcess: '',
        content: 'We just launched our startup today.',
        source: 'selection',
        hadSelection: true
      },
      transcript: 'congratulate him and ask how it went',
      defaultTone: 'friendly'
    })
    expect(msg).toContain('Twitter/X')
    expect(msg).toContain('We just launched our startup today.')
    expect(msg).toContain('congratulate him and ask how it went')
    expect(msg).toContain('friendly')
  })

  it('falls back to compose-from-voice when no content is captured', () => {
    const msg = buildUserMessage({
      context: { app: '', appProcess: '', content: '', source: 'none', hadSelection: false },
      transcript: 'tell my landlord rent is late',
      defaultTone: 'professional'
    })
    expect(msg.toLowerCase()).toContain('compose from the spoken intent')
    expect(msg).toContain('Unknown app')
    expect(msg).toContain('rent is late')
  })
})

describe('SYSTEM_PROMPT', () => {
  it('encodes the product principles', () => {
    expect(SYSTEM_PROMPT).toMatch(/intent, not dictation/i)
    expect(SYSTEM_PROMPT).toMatch(/ChatGPT|corporate/i)
    expect(SYSTEM_PROMPT).toMatch(/hope this email finds you/i)
    expect(SYSTEM_PROMPT).toMatch(/Twitter\/X[\s\S]*LinkedIn[\s\S]*Slack/i)
  })
})

describe('REPLY_SCHEMA', () => {
  it('requires the four structured fields', () => {
    expect(REPLY_SCHEMA.required).toEqual(['intent', 'tone', 'goal', 'reply'])
    expect(REPLY_SCHEMA.properties.reply.type).toBe('string')
  })
})
