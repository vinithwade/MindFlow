import { AppSettings } from '../../shared/types'
import { LLMProvider, LLMError } from './types'
import { AnthropicLLM } from './anthropic'
import { OpenAILLM } from './openai'

export { LLMError } from './types'
export type { LLMProvider, GenerateInput } from './types'

export function createLLMProvider(settings: AppSettings): LLMProvider {
  switch (settings.llmProvider) {
    case 'openai':
      return new OpenAILLM(settings.apiKeys.openai ?? '')
    case 'anthropic':
    default:
      return new AnthropicLLM(settings.apiKeys.anthropic ?? '')
  }
}

export function assertLLMConfigured(settings: AppSettings): void {
  const key =
    settings.llmProvider === 'openai' ? settings.apiKeys.openai : settings.apiKeys.anthropic
  if (!key) {
    throw new LLMError(
      `No API key set for reply model "${settings.llmProvider}". Add it in Settings.`
    )
  }
}
