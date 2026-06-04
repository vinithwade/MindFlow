import { GenerationResult, ReplyTone, ScreenContext, MyInfoEntry } from '../../shared/types'

export interface GenerateInput {
  context: ScreenContext
  transcript: string
  defaultTone: ReplyTone
  /** Personal-dictionary terms to spell exactly in the reply. */
  dictionary?: string[]
  /** Saved personal details the model may insert on request (confirmed only used). */
  myInfo?: MyInfoEntry[]
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
