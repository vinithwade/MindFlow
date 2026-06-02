import OpenAI, { toFile } from 'openai'
import { STTProvider, STTError } from './types'

/** OpenAI Whisper (whisper-1) transcription. */
export class OpenAISTT implements STTProvider {
  readonly name = 'openai'
  private client: OpenAI

  constructor(apiKey: string) {
    if (!apiKey) throw new STTError('Missing OpenAI API key.')
    this.client = new OpenAI({ apiKey })
  }

  async transcribe(audio: Buffer, mimeType: string): Promise<string> {
    const ext = mimeType.includes('wav') ? 'wav' : 'webm'
    const file = await toFile(audio, `speech.${ext}`, { type: mimeType })
    try {
      const res = await this.client.audio.transcriptions.create({
        file,
        model: 'whisper-1',
        // Bias toward verbatim intent capture, not auto-formatting.
        response_format: 'text'
      })
      // With response_format 'text' the SDK returns a string.
      return (typeof res === 'string' ? res : (res as { text?: string }).text ?? '').trim()
    } catch (err) {
      throw new STTError(`OpenAI transcription failed: ${(err as Error).message}`)
    }
  }
}
