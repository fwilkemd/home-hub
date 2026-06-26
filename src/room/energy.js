/*
  The room's energy — the single scalar behind the calm↔lively dial. One number
  (0 = deep calm, 1 = lively) scales the whole room at once: motion speed, glow
  brightness, and how closed-in the frame feels (density). It's the explicit
  resolution of the ADHD↔autism tension — calm wind-down vs. novelty/stimulation —
  and each person can turn it.

  Pure + tiny so it's testable and lives in one place. The dial has three stops:
   - 'auto'   → energy follows the time of day (calmer at night).
   - 'calm'   → a held low energy.
   - 'lively' → a held high energy.
  Reduced motion forces calm regardless (and the room's animations are off anyway).
*/

// Auto: calmest overnight, brightest midday, gentle shoulders at dawn/dusk.
export function energyForHour(h) {
  if (h >= 22 || h < 6) return 0.22 // night — wind-down (post-shift calm)
  if (h < 9) return 0.5 // early morning, easing up
  if (h < 17) return 0.85 // daytime — most alive
  if (h < 20) return 0.6 // evening
  return 0.4 // late evening, settling
}

export function energyFor(mode, date, reduced) {
  if (reduced) return 0.18 // reduced motion → forced calm, no auto-liveliness
  if (mode === 'calm') return 0.2
  if (mode === 'lively') return 1.0
  return energyForHour(date.getHours()) // 'auto'
}

// Map energy → the CSS custom properties the atmosphere/poster styles read.
//  --motion: a duration multiplier (calm = slower/larger, lively = faster/smaller)
//  --lum:    a glow-brightness multiplier (calm dimmer, lively brighter)
//  --veil:   vignette strength (calm closes the frame in; lively opens it up)
export function energyVars(energy) {
  const motion = +(1.6 - energy * 0.95).toFixed(3) // ≈1.41 calm … ≈0.65 lively
  const lum = +(0.66 + energy * 0.46).toFixed(3) // ≈0.70 calm … ≈1.12 lively
  const veil = +(1.08 - energy * 0.4).toFixed(3) // ≈1.04 calm … ≈0.68 lively
  return { '--motion': String(motion), '--lum': String(lum), '--veil': String(veil) }
}

// Auto-turn cadence scales with energy: calm lingers, lively turns sooner.
export function turnMsFor(energy, baseMs) {
  return Math.round(baseMs * (1.6 - energy * 0.95))
}

export const MOOD_STOPS = ['calm', 'auto', 'lively']
