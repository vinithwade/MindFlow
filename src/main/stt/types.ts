/** Layer 1 contract: turn recorded audio into text. */
export interface STTProvider {
  readonly name: string
  /**
   * Transcribe an audio clip.
   * @param audio Raw audio bytes (WebM/Opus from the renderer's MediaRecorder).
   * @param mimeType e.g. "audio/webm".
   */
  transcribe(audio: Buffer, mimeType: string): Promise<string>
}

export class STTError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'STTError'
  }
}
