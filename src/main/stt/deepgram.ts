import { createClient, DeepgramClient } from '@deepgram/sdk'
import { STTProvider, STTError } from './types'
import { keywordsFor } from '../dictionaryLogic'

/** Deepgram pre-recorded transcription (Nova). */
export class DeepgramSTT implements STTProvider {
  readonly name = 'deepgram'
  private client: DeepgramClient

  constructor(apiKey: string) {
    if (!apiKey) throw new STTError('Missing Deepgram API key.')
    this.client = createClient(apiKey)
  }

  async transcribe(audio: Buffer, _mimeType: string, dictionary?: string[]): Promise<string> {
    const keywords = keywordsFor(dictionary)
    try {
      const { result, error } = await this.client.listen.prerecorded.transcribeFile(audio, {
        model: 'nova-2',
        smart_format: true,
        punctuate: true,
        // Personal-dictionary terms boost recognition of names/jargon (Deepgram keywords).
        ...(keywords.length ? { keywords } : {})
      })
      if (error) throw error
      const transcript =
        result?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? ''
      return transcript.trim()
    } catch (err) {
      throw new STTError(`Deepgram transcription failed: ${(err as Error).message}`)
    }
  }
}
