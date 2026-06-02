import { useEffect, useRef } from 'react'
import { setAnalyser } from './audioBus'

/**
 * Captures microphone audio in the overlay renderer while the push-to-talk
 * hotkey is held. Main signals start/stop; on stop we bundle the recorded
 * chunks and hand them back to main (over IPC) for transcription.
 *
 * getUserMedia works even though the overlay is shown without focus
 * (showInactive), so the user keeps focus in their source app.
 */
export function useRecorder(): void {
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    let cancelled = false

    async function start(): Promise<void> {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true
          }
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        chunksRef.current = []

        // Tap the stream for the live waveform (separate from recording).
        try {
          const ctx = new AudioContext()
          const sourceNode = ctx.createMediaStreamSource(stream)
          const analyser = ctx.createAnalyser()
          analyser.fftSize = 256
          analyser.smoothingTimeConstant = 0.7
          sourceNode.connect(analyser)
          audioCtxRef.current = ctx
          setAnalyser(analyser)
        } catch {
          /* waveform is cosmetic — ignore if AudioContext fails */
        }

        const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm'
        const recorder = new MediaRecorder(stream, { mimeType: mime })
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data)
        }
        recorder.onstop = async () => {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
          streamRef.current?.getTracks().forEach((t) => t.stop())
          streamRef.current = null
          // Tear down the waveform tap.
          setAnalyser(null)
          void audioCtxRef.current?.close().catch(() => undefined)
          audioCtxRef.current = null
          const buf = await blob.arrayBuffer()
          await window.api.submitAudio(buf, 'audio/webm')
        }
        recorder.start()
        recorderRef.current = recorder
      } catch (err) {
        console.error('[recorder] getUserMedia failed:', err)
        // Submit empty audio so main surfaces a clear "no audio" error.
        await window.api.submitAudio(new ArrayBuffer(0), 'audio/webm')
      }
    }

    function stop(): void {
      const rec = recorderRef.current
      if (rec && rec.state !== 'inactive') rec.stop()
      recorderRef.current = null
    }

    const offStart = window.api.onRecordingStart(() => void start())
    const offStop = window.api.onRecordingStop(() => stop())

    return () => {
      cancelled = true
      offStart()
      offStop()
      streamRef.current?.getTracks().forEach((t) => t.stop())
      setAnalyser(null)
      void audioCtxRef.current?.close().catch(() => undefined)
    }
  }, [])
}
