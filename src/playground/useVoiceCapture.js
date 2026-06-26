/*
  Voice capture for catch-a-thought — dictate instead of type (hands-free, great
  for an ADHD brain mid-thought). A thin wrapper over the browser Web Speech API
  (SpeechRecognition / webkitSpeechRecognition).

  Additive and forgiving: if the API isn't available (or a session has no mic),
  `supported` is false and the UI simply doesn't offer the affordance — typing
  still works exactly as before. Every call is try/caught so a denied mic or a
  flaky engine can never throw into the room.
*/
import { useEffect, useRef, useState } from 'react'

function getCtor() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

export function useVoiceCapture({ onText } = {}) {
  const [supported] = useState(() => !!getCtor())
  const [listening, setListening] = useState(false)
  const recRef = useRef(null)
  const onTextRef = useRef(onText)
  onTextRef.current = onText

  useEffect(
    () => () => {
      try {
        recRef.current?.stop()
      } catch {
        /* no-op */
      }
    },
    [],
  )

  const start = () => {
    const Ctor = getCtor()
    if (!Ctor || listening) return
    let rec
    try {
      rec = new Ctor()
    } catch {
      return
    }
    rec.lang = 'en-US'
    rec.interimResults = true
    rec.continuous = false
    rec.maxAlternatives = 1
    rec.onresult = (e) => {
      let t = ''
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript
      onTextRef.current?.(t)
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    recRef.current = rec
    try {
      rec.start()
      setListening(true)
    } catch {
      setListening(false)
    }
  }

  const stop = () => {
    try {
      recRef.current?.stop()
    } catch {
      /* no-op */
    }
    setListening(false)
  }

  return { supported, listening, start, stop }
}

export default useVoiceCapture
