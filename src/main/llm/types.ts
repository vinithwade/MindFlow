import { GenerationResult, ReplyTone, ScreenContext } from '../../shared/types'

export interface GenerateInput {
  context: ScreenContext
  transcript: string
  defaultTone: ReplyTone
}

/** Layers 3 + 4: understand intent and generate the reply in one call. */
export interface LLMProvider {
  readonly name: string
  generate(input: GenerateInput): Promise<GenerationResult>
}

export class LLMError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LLMError'
  }
}
