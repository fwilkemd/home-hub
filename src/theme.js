/*
  The few non-album tokens. The album palette (--a1/--a2/--a3) is the light and
  lives per-track in data/mock.js. Everything else that's worth tuning lives in
  index.css as CSS variables, so the look can be restyled in one place later.

  Aesthetic is deliberately downstream of behavior in this pass — keep it thin.
*/
export const theme = {
  // Authored at the Fire HD 10 logical resolution, then scaled as one unit.
  screen: { w: 1280, h: 800 },

  // How long the room rests on a state before it turns on its own (ms).
  turnMs: 9000,
}

export default theme
