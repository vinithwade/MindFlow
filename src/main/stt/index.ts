import { AppSettings } from '../../shared/types'
import { STTProvider, STTError } from './types'
import { OpenAISTT } from './openai'
import { DeepgramSTT } from './deepgram'

export { STTError } from './types'
export type { STTProvider } from './types'

/** Build the STT provider selected in settings, using the matching API key. */
export function createSTTProvider(settings: AppSettings): STTProvider {
  switch (settings.sttProvider) {
    case 'deepgram':
      return new DeepgramSTT(settings.apiKeys.deepgram ?? '')
    case 'openai':
    default:
      return new OpenAISTT(settings.apiKeys.openai ?? '')
  }
}

export function assertSTTConfigured(settings: AppSettings): void {
  const key =
    settings.sttProvider === 'deepgram' ? settings.apiKeys.deepgram : settings.apiKeys.openai
  if (!key) {
    throw new STTError(
      `No API key set for speech-to-text provider "${settings.sttProvider}". Add it in Settings.`
    )
  }
}
