import { useEffect, useState } from 'react'
import { todayMeta } from '../data/mock.js'

// Greeting tuned to the real hour — the screen "happens to know" the time.
function greeting(h) {
  if (h < 5) return 'Still night'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 21) return 'Good evening'
  return 'Late evening'
}

/*
  Time as part of the space — enormous Fraunces, no container around it. The
  greeting, weekday, date and weather settle beneath it as one quiet human
  cluster. The clock is real and ticks; the date is mock (a planned day).
*/
export default function TimeBlock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const h = now.getHours()
  const h12 = ((h + 11) % 12) + 1
  const mm = String(now.getMinutes()).padStart(2, '0')
  const meridiem = h < 12 ? 'AM' : 'PM'

  return (
    <div style={{ textShadow: '0 2px 34px rgba(0,0,0,0.45)' }}>
      <div
        className="font-mono"
        style={{
          fontSize: 17,
          letterSpacing: '0.34em',
          color: 'var(--ink-dim)',
          animation: 'rise-in 1100ms ease both',
        }}
      >
        {greeting(h).toUpperCase()}
      </div>

      <div
        className="flex items-baseline"
        style={{ marginTop: 12, animation: 'rise-in 1100ms ease both', animationDelay: '90ms' }}
      >
        <span
          className="font-display leading-none"
          style={{
            fontSize: 262,
            color: 'var(--ink)',
            fontVariationSettings: '"opsz" 144, "wght" 430, "SOFT" 0, "WONK" 0',
            letterSpacing: '-0.04em',
          }}
        >
          {h12}
          <span style={{ animation: 'colon-pulse 2.6s ease-in-out infinite' }}>:</span>
          {mm}
        </span>
        <span
          className="font-mono"
          style={{ marginLeft: 22, fontSize: 30, color: 'var(--ink-faint)', letterSpacing: '0.1em' }}
        >
          {meridiem}
        </span>
      </div>

      <div
        className="font-display"
        style={{
          marginTop: 10,
          fontSize: 42,
          fontStyle: 'italic',
          color: 'var(--ink)',
          fontVariationSettings: '"opsz" 72, "wght" 360',
          animation: 'rise-in 1100ms ease both',
          animationDelay: '180ms',
        }}
      >
        {todayMeta.weekday}
      </div>
      <div
        className="font-body"
        style={{
          marginTop: 4,
          fontSize: 22,
          color: 'var(--ink-dim)',
          animation: 'rise-in 1100ms ease both',
          animationDelay: '240ms',
        }}
      >
        {todayMeta.date} · {todayMeta.weather.tempF}° {todayMeta.weather.label}
      </div>
    </div>
  )
}
