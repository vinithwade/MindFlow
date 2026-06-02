import OpenAI from 'openai'
import { GenerationResult, ReplyTone } from '../../shared/types'
import { GenerateInput, LLMProvider, LLMError } from './types'
import { SYSTEM_PROMPT, buildUserMessage, REPLY_SCHEMA } from './prompt'

/** OpenAI adapter using structured outputs (json_schema) in a single call. */
export class OpenAILLM implements LLMProvider {
  readonly name = 'openai'
  private client: OpenAI
  private model = 'gpt-4o-mini' // fast + cheap for short replies

  constructor(apiKey: string) {
    if (!apiKey) throw new LLMError('Missing OpenAI API key.')
    this.client = new OpenAI({ apiKey })
  }

  async generate(input: GenerateInput): Promise<GenerationResult> {
    try {
      const res = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 600,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserMessage(input) }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'reply', strict: true, schema: REPLY_SCHEMA }
        }
      })

      const raw = res.choices[0]?.message?.content
      if (!raw) throw new LLMError('OpenAI returned an empty response.')
      const out = JSON.parse(raw) as {
        intent: GenerationResult['intent']['intent']
        tone: ReplyTone
        goal: string
        reply: string
      }
      return {
        reply: out.reply.trim(),
        intent: { intent: out.intent, tone: out.tone, goal: out.goal }
      }
    } catch (err) {
      if (err instanceof LLMError) throw err
      throw new LLMError(`OpenAI generation failed: ${(err as Error).message}`)
    }
  }
}
