/*
  Centralized design tokens. Katie can restyle the whole hub from here.
  Colors that drive the live recolor live per-album in data/mock.js; the
  static base palette and spacing scale live here.
*/

export const theme = {
  canvas: '#141019',
  ink: '#f7f4ef',
  inkDim: 'rgba(247, 244, 239, 0.66)',
  inkFaint: 'rgba(247, 244, 239, 0.40)',

  // The hub is authored at this fixed logical resolution (Fire HD 10, 16:10)
  // and scaled as one unit to whatever space it's given.
  screen: { w: 1280, h: 800 },

  // Glass surface recipe, reused by every card.
  glass: {
    bg: 'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.14)',
    radius: 28,
  },
}

export default theme
