/**
 * Lightweight API-key validation by hitting each provider's cheapest auth'd
 * endpoint. Runs in main (the renderer's CSP blocks these hosts).
 */
type Provider = 'openai' | 'anthropic' | 'deepgram'

export async function validateApiKey(
  provider: Provider,
  key: string
): Promise<{ ok: boolean; error?: string }> {
  if (!key) return { ok: false, error: 'No key provided.' }
  try {
    let res: Response
    if (provider === 'openai') {
      res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` }
      })
    } else if (provider === 'anthropic') {
      res = await fetch('https://api.anthropic.com/v1/models', {
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' }
      })
    } else {
      res = await fetch('https://api.deepgram.com/v1/projects', {
        headers: { Authorization: `Token ${key}` }
      })
    }
    if (res.ok) return { ok: true }
    if (res.status === 401 || res.status === 403) return { ok: false, error: 'Invalid key.' }
    return { ok: false, error: `Unexpected response (${res.status}).` }
  } catch (e) {
    return { ok: false, error: `Network error: ${(e as Error).message}` }
  }
}
