import Anthropic from '@anthropic-ai/sdk'
import { GenerationResult, ReplyTone } from '../../shared/types'
import { GenerateInput, LLMProvider, LLMError } from './types'
import { SYSTEM_PROMPT, buildUserMessage, REPLY_SCHEMA } from './prompt'

/**
 * Claude adapter. Uses forced tool-use to get reliable structured output
 * ({intent, tone, goal, reply}) in a single call.
 */
export class AnthropicLLM implements LLMProvider {
  readonly name = 'anthropic'
  private client: Anthropic
  private model = 'claude-sonnet-4-6' // fast + high quality for short replies

  constructor(apiKey: string) {
    if (!apiKey) throw new LLMError('Missing Anthropic API key.')
    this.client = new Anthropic({ apiKey })
  }

  async generate(input: GenerateInput): Promise<GenerationResult> {
    try {
      const res = await this.client.messages.create({
        model: this.model,
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        tools: [
          {
            name: 'emit_reply',
            description: 'Return the structured reply.',
            input_schema: REPLY_SCHEMA as unknown as Anthropic.Tool.InputSchema
          }
        ],
        tool_choice: { type: 'tool', name: 'emit_reply' },
        messages: [{ role: 'user', content: buildUserMessage(input) }]
      })

      const block = res.content.find((c) => c.type === 'tool_use')
      if (!block || block.type !== 'tool_use') {
        throw new LLMError('Claude returned no structured reply.')
      }
      const out = block.input as {
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
      throw new LLMError(`Claude generation failed: ${(err as Error).message}`)
    }
  }
}
