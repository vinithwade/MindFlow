/**
 * A tiny singleton that shares the live microphone AnalyserNode between the
 * recorder (which owns the mic stream) and the Waveform component (which draws
 * it). Decouples them so the waveform stays purely presentational.
 */
let analyser: AnalyserNode | null = null
let freq: Uint8Array<ArrayBuffer> | null = null

export function setAnalyser(node: AnalyserNode | null): void {
  analyser = node
  freq = node ? new Uint8Array(new ArrayBuffer(node.frequencyBinCount)) : null
}

/**
 * Returns `bars` amplitude values in [0, 1], bucketed from the low/mid spectrum
 * (where speech energy lives). Returns zeros when nothing is being captured.
 */
export function getLevels(bars: number): number[] {
  if (!analyser || !freq) return new Array(bars).fill(0)
  analyser.getByteFrequencyData(freq)
  // Use the lower ~60% of bins — voice sits there; highs are mostly noise.
  const usable = Math.floor(freq.length * 0.6)
  const out: number[] = []
  const size = Math.max(1, Math.floor(usable / bars))
  for (let i = 0; i < bars; i++) {
    let sum = 0
    for (let j = 0; j < size; j++) sum += freq[i * size + j] ?? 0
    const avg = sum / size / 255 // 0..1
    // Gentle curve so quiet speech still shows movement.
    out.push(Math.min(1, Math.pow(avg, 0.7) * 1.4))
  }
  return out
}
