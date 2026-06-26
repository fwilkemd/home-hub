/*
  The catch. When you press-and-hold the room, the light gathers at your finger
  (catch-pool, positioned at the press point) and a small card blooms to hold the
  thought. Type it, release to catch; empty or Escape lets it go.

  Position comes in as % of the stage so it's resolution-independent and lives in
  the same cq context as everything else. The card is centered for reliable
  legibility; the pool marks where you touched.
*/
import { useEffect, useRef, useState } from 'react'
import { useVoiceCapture } from './useVoiceCapture.js'

export default function CatchInput({ xPct, yPct, onCommit, onCancel }) {
  const [text, setText] = useState('')
  const inputRef = useRef(null)
  // Dictate instead of type — fills the field with the transcript as you speak.
  const { supported: voiceOk, listening, start: startVoice, stop: stopVoice } = useVoiceCapture({ onText: setText })

  useEffect(() => {
    // Best-effort autofocus; on touch the card is right there to tap if blocked.
    inputRef.current?.focus()
  }, [])

  const commit = () => {
    const t = text.trim()
    if (t) onCommit(t)
    else onCancel()
  }
  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      commit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
    e.stopPropagation() // don't let the room see these keys
  }

  return (
    <div
      className="catch"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="catch-pool" style={{ left: `${xPct}%`, top: `${yPct}%` }} aria-hidden="true" />
      <div className="catch-card" role="dialog" aria-label="Catch a thought" onPointerDown={(e) => e.stopPropagation()}>
        <div className="catch-head">
          <span className="catch-label">catch a thought</span>
          {voiceOk && (
            <button
              type="button"
              className={`catch-speak${listening ? ' is-on' : ''}`}
              onClick={listening ? stopVoice : startVoice}
              aria-pressed={listening}
              aria-label={listening ? 'Stop dictation' : 'Dictate a thought'}
            >
              <span className="catch-speak-dot" aria-hidden="true" />
              {listening ? 'listening…' : 'speak'}
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          className="catch-field"
          type="text"
          value={text}
          placeholder="what's on your mind?"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="catch-actions">
          <button type="button" className="catch-btn catch-btn-go" onClick={commit}>
            Catch
          </button>
          <button type="button" className="catch-btn catch-btn-let" onClick={onCancel}>
            Let go
          </button>
        </div>
      </div>
    </div>
  )
}
