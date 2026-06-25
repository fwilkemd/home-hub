/*
  The family calendars. Centralized so Katie can edit people and colors in ONE
  place. These colors are IDENTITY — deliberately independent of the album
  palette (--a1/--a2/--a3), so a person's color never shifts when the music
  recolors the room. Music owns the room's mood; these own who-an-event-is.
*/
export const CALENDARS = [
  { id: 'forrest', name: 'Forrest', color: '#5b8cff' },
  { id: 'katie', name: 'Katie', color: '#ff6fae' },
  { id: 'shared', name: 'Home', color: '#36c9a8' },
  { id: 'rotation', name: 'Rotation', color: '#a98bff' },
]

export const CALENDAR_BY_ID = Object.fromEntries(CALENDARS.map((c) => [c.id, c]))

export const KINDS = ['work', 'rest', 'errand', 'home', 'arrival']
