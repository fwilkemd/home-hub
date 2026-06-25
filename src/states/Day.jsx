/*
  DAY — the schedule as an editorial spread, never a list. A giant faint date
  number anchors the poster as texture. Events are hand-placed type at deliberate
  scales and positions with real whitespace; the one important thing (Forrest off
  night float) is large and glowing, everything else whispers around it.

  Positions are authored per slot (mock data is fixed) so the composition is
  art-directed, not a grid. The `hero` slot is aligned to the important event.
*/

// Authored placement, one per event index in TODAY.events. Asymmetric on purpose.
const SLOTS = [
  { left: '7cqw', top: '14cqh', size: 'whisper' },
  { left: '10cqw', top: '32cqh', size: 'hero' }, // Forrest home — the focal point
  { left: '14cqw', top: '64cqh', size: 'whisper' },
  { left: '58cqw', top: '20cqh', size: 'faint' },
  { left: '63cqw', top: '46cqh', size: 'whisper' },
  { left: '52cqw', top: '70cqh', size: 'faint' },
]

export default function Day({ today }) {
  return (
    <section className="poster poster-day" aria-label="The day ahead">
      <span className="day-anchor" aria-hidden="true">
        {today.dateNum}
      </span>

      <p className="day-kicker">
        {today.weekday} — the day ahead
      </p>

      {today.events.map((e, i) => {
        const slot = SLOTS[i] || SLOTS[0]
        return (
          <div
            key={e.time + e.label}
            className={`day-event day-${slot.size}${e.important ? ' is-hero' : ''}`}
            style={{ left: slot.left, top: slot.top }}
          >
            <span className="day-time">{e.time}</span>
            <span className="day-label">{e.label}</span>
            <span className="day-sub">{e.sub}</span>
          </div>
        )
      })}
    </section>
  )
}
