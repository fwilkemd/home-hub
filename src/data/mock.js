/*
  Mock data only — no real APIs. Every "real data" source (Spotify, calendar,
  Home Assistant) will later sit behind an interface shaped like the exports
  here, so the UI keeps working with no network.
*/

// Now-playing queue. Each album hardcodes the palette its art recolors the
// screen to: [a1, a2, a3]. art is a CSS gradient so we need no network images.
export const nowPlayingQueue = [
  {
    id: 'aurora-drift',
    title: 'Aurora Drift',
    artist: 'Solunar',
    album: 'Halcyon',
    durationSec: 247,
    progressSec: 86,
    palette: ['#7C5CFF', '#B98CFF', '#33E0C4'],
    art: 'linear-gradient(135deg, #7C5CFF 0%, #B98CFF 48%, #33E0C4 100%)',
  },
  {
    id: 'paper-boats',
    title: 'Paper Boats',
    artist: 'June Wilder',
    album: 'Tideline',
    durationSec: 203,
    progressSec: 134,
    palette: ['#FF7E5F', '#FFB36B', '#FF4D6D'],
    art: 'linear-gradient(140deg, #FF4D6D 0%, #FF7E5F 50%, #FFB36B 100%)',
  },
  {
    id: 'glasshouse',
    title: 'Glasshouse',
    artist: 'Kestrel',
    album: 'Northern Lines',
    durationSec: 268,
    progressSec: 42,
    palette: ['#3AA0FF', '#5ED7FF', '#9B7CFF'],
    art: 'linear-gradient(150deg, #3AA0FF 0%, #5ED7FF 55%, #9B7CFF 100%)',
  },
  {
    id: 'velvet-hours',
    title: 'Velvet Hours',
    artist: 'Mara Lune',
    album: 'After Dark',
    durationSec: 224,
    progressSec: 171,
    palette: ['#E84393', '#FD79A8', '#A55EEA'],
    art: 'linear-gradient(145deg, #A55EEA 0%, #E84393 55%, #FD79A8 100%)',
  },
]

// Today's shared schedule. `kind` lets the UI accent the key resident event,
// which is also the one that will drive an automation in a later phase.
export const todayEvents = [
  { id: 'e1', time: '07:10', title: 'Forrest home — night shift', sub: 'Pulling in from the hospital', kind: 'arrival' },
  { id: 'e2', time: '09:00', title: 'Forrest — rest window', sub: 'Do not disturb · blackout', kind: 'rest' },
  { id: 'e3', time: '13:30', title: 'Katie — design review', sub: 'Studio · 45 min', kind: 'work' },
  { id: 'e4', time: '18:30', title: 'Dinner at home', sub: 'Both home', kind: 'home' },
]

export const todayMeta = {
  weekday: 'Thursday',
  date: 'June 25',
  weather: { tempF: 71, label: 'Clear' },
}

// Smart-home room states.
export const rooms = [
  { id: 'kitchen', name: 'Kitchen', icon: 'CookingPot', state: 'Lights 60%', tempF: 72, on: true },
  { id: 'living', name: 'Living room', icon: 'Sofa', state: 'Lamp · warm', tempF: 71, on: true },
  { id: 'office', name: 'Office', icon: 'Briefcase', state: 'Off', tempF: 70, on: false },
  { id: 'bedroom', name: 'Bedroom', icon: 'BedDouble', state: 'Blackout · quiet', tempF: 68, on: false },
]
