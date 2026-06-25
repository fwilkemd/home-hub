import { todayEvents } from '../data/mock.js'

// "07:10" -> "7:10am" — soft, spoken, not a 24h timestamp.
function softTime(t) {
  const [hh, mm] = t.split(':')
  const h = Number(hh)
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${mm}${h < 12 ? 'am' : 'pm'}`
}

/*
  The day's arc — the schedule as soft text that drifts into the space, never a
  list inside a box. The night-shift arrival (the soul of Forrest's day, and the
  future automation trigger) is the one bright moment; everything else whispers.
  The whole arc floats as one and rises in on first paint.
*/
export default function DayArc() {
  return (
    <div
      className="flex flex-col items-end"
      style={{
        textAlign: 'right',
        textShadow: '0 2px 26px rgba(0,0,0,0.5)',
        animation: 'float-soft 17s ease-in-out infinite',
      }}
    >
      {todayEvents.map((ev, i) => {
        const key = ev.kind === 'arrival'
        const accent = 'color-mix(in srgb, var(--a2) 76%, white)'
        return (
          <div
            key={ev.id}
            style={{
              marginTop: i === 0 ? 0 : 30,
              maxWidth: 470,
              animation: 'rise-in 1200ms ease both',
              animationDelay: `${280 + i * 130}ms`,
            }}
          >
            <div
              className="font-mono"
              style={{
                fontSize: key ? 15 : 13,
                letterSpacing: '0.2em',
                color: key ? accent : 'var(--ink-faint)',
              }}
            >
              {softTime(ev.time).toUpperCase()}
            </div>
            <div
              className="font-display"
              style={{
                marginTop: 3,
                fontSize: key ? 39 : 27,
                lineHeight: 1.05,
                fontVariationSettings: key ? '"opsz" 96, "wght" 460' : '"opsz" 56, "wght" 370',
                color: key ? accent : 'var(--ink)',
                textShadow: key
                  ? '0 0 36px color-mix(in srgb, var(--a2) 42%, transparent)'
                  : undefined,
              }}
            >
              {ev.title}
            </div>
            <div
              className="font-body"
              style={{ marginTop: 3, fontSize: key ? 17 : 15, color: 'var(--ink-dim)' }}
            >
              {ev.sub}
            </div>
          </div>
        )
      })}
    </div>
  )
}
