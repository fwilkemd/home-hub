/*
  Mock data only. Everything the room breathes through lives here.

  The signature idea: each track carries the album's palette (--a1/--a2/--a3).
  That palette IS the room's light. When the track changes, the whole
  atmosphere crossfades to the new palette — so the light is "the music."
*/

// Now-playing rotation. The room advances through these on its own, so the
// light slowly recolors even when you're not touching anything.
export const TRACKS = [
  {
    id: 'violet-hour',
    title: 'Violet Hour',
    artist: 'Maren Vale',
    album: 'Low Country',
    lenSec: 20, // demo cadence — how long before the room drifts to the next
    palette: { a1: '#8b5cff', a2: '#c79bff', a3: '#36e6c0' },
  },
  {
    id: 'nightfloat',
    title: 'Nightfloat',
    artist: 'Couris',
    album: 'Resident',
    lenSec: 23,
    palette: { a1: '#2f6dff', a2: '#46c8ff', a3: '#ff4d9d' },
  },
  {
    id: 'amber-room',
    title: 'Amber Room',
    artist: 'Hale & Sound',
    album: 'Warm Front',
    lenSec: 18,
    palette: { a1: '#ff8a3d', a2: '#ffd166', a3: '#ef476f' },
  },
  {
    id: 'slow-tide',
    title: 'Slow Tide',
    artist: 'Oceana',
    album: 'Reef',
    lenSec: 21,
    palette: { a1: '#10d9a0', a2: '#5ee7d0', a3: '#1f8bd0' },
  },
]

// Today, for the Now + Day states. Exactly one event is "important" — that's
// the single glowing element the room emphasizes (Forrest off night float).
export const TODAY = {
  weekday: 'Thursday',
  dateNum: 25,
  dateLong: 'June 25',
  weather: { tempF: 71, sky: 'clearing' },
  events: [
    { time: '6:30a', label: 'Pre-rounds', sub: 'sign-out', kind: 'work' },
    { time: '7:12a', label: 'Forrest home', sub: 'off night float', kind: 'arrival', important: true },
    { time: '9:00a', label: 'Sleep block', sub: 'do not wake', kind: 'rest' },
    { time: '1:30p', label: 'Grocery pickup', sub: 'Katie', kind: 'errand' },
    { time: '6:00p', label: 'Dinner', sub: 'with Katie', kind: 'home' },
    { time: '8:40p', label: 'Back on at 9', sub: 'night float', kind: 'work' },
  ],
}
