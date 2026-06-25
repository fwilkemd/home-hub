/*
  The mock family calendar — seeded RELATIVE TO REAL TODAY (via day offsets, not
  hardcoded dates) so there is always content around "now" whenever the hub is
  first opened. After the first run this is persisted and edits are sacred; the
  seed never re-anchors (see store.js).

  Includes Forrest's night-float rotation (overnight shifts straddling today),
  the signature "Forrest home — off night float" arrival, and a normal week of
  Forrest / Katie / Home events plus a multi-day all-day event.
*/
import { addDays, dateKey, startOfDay } from './dateUtils.js'

const pad = (n) => String(n).padStart(2, '0')

export function buildSeed(today = startOfDay(new Date())) {
  let n = 0
  const id = () => `seed_${pad(n++)}`
  const day = (off) => addDays(today, off)
  const stamp = (off, h, m) => `${dateKey(day(off))}T${pad(h)}:${pad(m)}`

  const ev = []
  const push = (o) =>
    ev.push({
      id: id(),
      allDay: false,
      important: false,
      shift: false,
      note: '',
      kind: 'home',
      ...o,
    })

  // ── Night-float rotation: overnight 9p→7a shifts, straddling today ──────────
  // (today-1 ended this morning at 7a — hence the "off night float" arrival.)
  for (const off of [-1, 0, 1, 4, 5]) {
    push({
      calendarId: 'rotation',
      title: 'Night float',
      note: '9p–7a · MICU',
      kind: 'work',
      shift: true,
      start: stamp(off, 21, 0),
      end: stamp(off + 1, 7, 0),
    })
  }

  // ── Today ───────────────────────────────────────────────────────────────────
  push({ calendarId: 'forrest', title: 'Forrest home', note: 'off night float', kind: 'arrival', important: true, start: stamp(0, 7, 12), end: stamp(0, 7, 42) })
  push({ calendarId: 'forrest', title: 'Sleep block', note: 'do not wake', kind: 'rest', start: stamp(0, 9, 0), end: stamp(0, 15, 0) })
  push({ calendarId: 'katie', title: 'Vinyasa', note: 'studio', kind: 'home', start: stamp(0, 8, 0), end: stamp(0, 9, 0) })
  push({ calendarId: 'katie', title: 'Design review', note: '45 min', kind: 'work', start: stamp(0, 13, 30), end: stamp(0, 14, 15) })
  push({ calendarId: 'shared', title: 'Grocery pickup', note: 'curbside', kind: 'errand', start: stamp(0, 13, 30), end: stamp(0, 14, 0) }) // overlaps the review on purpose
  push({ calendarId: 'shared', title: 'Dinner', note: 'both home', kind: 'home', start: stamp(0, 18, 0), end: stamp(0, 19, 0) })

  // ── The week around today ────────────────────────────────────────────────────
  push({ calendarId: 'shared', title: 'Date night', note: 'patio', kind: 'home', start: stamp(1, 19, 0), end: stamp(1, 21, 0) })
  push({ calendarId: 'forrest', title: 'Post-call sleep', kind: 'rest', start: stamp(2, 8, 0), end: stamp(2, 13, 0) })
  push({ calendarId: 'katie', title: 'Client shoot', note: 'downtown', kind: 'work', start: stamp(2, 10, 0), end: stamp(2, 12, 30) })
  push({ calendarId: 'forrest', title: 'Clinic', note: 'continuity', kind: 'work', start: stamp(3, 9, 0), end: stamp(3, 12, 0) })
  push({ calendarId: 'shared', title: 'Farmers market', kind: 'errand', start: stamp(6, 9, 30), end: stamp(6, 11, 0) })
  push({ calendarId: 'katie', title: 'Gallery opening', kind: 'home', start: stamp(-3, 19, 30), end: stamp(-3, 22, 0) })

  // ── A multi-day all-day event (exercises the all-day row + month spanning) ──
  push({ calendarId: 'shared', title: 'Katie’s parents visiting', allDay: true, kind: 'home', start: dateKey(day(4)), end: dateKey(day(6)) })

  return ev
}
