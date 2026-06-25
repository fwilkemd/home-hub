import { useEffect, useState } from 'react'
import { todayMeta } from '../data/mock.js'

// Live clock + date. Time is real and ticks each second; the date label is
// mock (so the demo always reads as a planned day).
export default function ClockDate() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const hours = now.getHours()
  const h12 = ((hours + 11) % 12) + 1
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const meridiem = hours < 12 ? 'AM' : 'PM'

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline gap-3">
        <span
          className="font-display leading-none"
          style={{ fontSize: 94, fontWeight: 500, letterSpacing: '-0.02em' }}
        >
          {h12}:{minutes}
        </span>
        <span className="font-mono text-[var(--ink-faint)]" style={{ fontSize: 22 }}>
          {meridiem}
        </span>
      </div>
      <div
        className="mt-1 font-body text-[var(--ink-dim)]"
        style={{ fontSize: 26, fontWeight: 500 }}
      >
        {todayMeta.weekday}, {todayMeta.date}
      </div>
    </div>
  )
}
