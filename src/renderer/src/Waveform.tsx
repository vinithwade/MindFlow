import { useEffect, useRef } from 'react'
import { getLevels } from './audioBus'

/**
 * Live mic-amplitude waveform. Reads the shared AnalyserNode each frame and
 * sets bar scale directly on the DOM (no React re-render per frame). When idle
 * (no analyser), bars settle into a gentle resting shimmer.
 *
 * orientation: "horizontal" → bars side by side, height oscillates.
 *              "vertical"   → bars stacked, width oscillates (a vertical meter).
 */
export function Waveform({
  bars = 28,
  active,
  orientation = 'horizontal'
}: {
  bars?: number
  active: boolean
  orientation?: 'horizontal' | 'vertical'
}): JSX.Element {
  const refs = useRef<(HTMLSpanElement | null)[]>([])
  const vertical = orientation === 'vertical'

  useEffect(() => {
    let raf = 0
    let t = 0
    const tick = (): void => {
      t += 0.08
      const levels = getLevels(bars)
      for (let i = 0; i < bars; i++) {
        const el = refs.current[i]
        if (!el) continue
        // Gentle resting wave so the bars are always clearly visible.
        const idle = 0.32 + 0.14 * Math.sin(t + i * 0.5)
        const v = active ? Math.max(idle, levels[i]) : idle
        const scale = 0.2 + v * 0.8
        el.style.transform = vertical ? `scaleX(${scale})` : `scaleY(${scale})`
        el.style.opacity = `${0.55 + v * 0.45}`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [bars, active, vertical])

  return (
    <div
      className={
        vertical
          ? 'flex w-6 flex-col items-center justify-center gap-[5px]'
          : 'flex h-6 items-center gap-[3px]'
      }
    >
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          ref={(el) => (refs.current[i] = el)}
          className={`origin-center rounded-full bg-accent ${
            vertical ? 'h-[3px] w-full' : 'h-full w-[3px]'
          }`}
          style={{ transform: vertical ? 'scaleX(0.2)' : 'scaleY(0.12)' }}
        />
      ))}
    </div>
  )
}
