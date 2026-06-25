/*
  The world — the only thing on the resting screen that isn't type.

  The current album's palette (--a1 / --a2 / --a3, inherited from the scene root)
  becomes LIGHT filling the room: a few enormous soft glows that drift on long
  offset cycles, a luminous "sun" that is the music's physical presence bleeding
  off the top-right, film grain for dimension, and a wide vignette that seats the
  type. There are no panels here — only light. Because every layer is built from
  the registered --a colors, the entire room crossfades when the album changes.
*/
export default function SceneAtmosphere() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Drifting colored light — the room is never quite still. */}
      <div
        className="absolute"
        style={{
          width: 1200,
          height: 1120,
          left: -240,
          top: 140,
          background:
            'radial-gradient(circle, color-mix(in srgb, var(--a1) 60%, transparent) 0%, transparent 62%)',
          filter: 'blur(26px)',
          animation: 'drift-a 54s ease-in-out infinite alternate',
        }}
      />
      <div
        className="absolute"
        style={{
          width: 1120,
          height: 1020,
          right: -280,
          top: -300,
          background:
            'radial-gradient(circle, color-mix(in srgb, var(--a2) 54%, transparent) 0%, transparent 60%)',
          filter: 'blur(28px)',
          animation: 'drift-b 66s ease-in-out infinite alternate',
        }}
      />
      <div
        className="absolute"
        style={{
          width: 860,
          height: 860,
          right: 40,
          top: 380,
          background:
            'radial-gradient(circle, color-mix(in srgb, var(--a3) 42%, transparent) 0%, transparent 60%)',
          filter: 'blur(24px)',
          animation: 'drift-c 48s ease-in-out infinite alternate',
        }}
      />

      {/* The album "sun" — the music as a light source, bleeding off the top-right.
          Pure album color; its edges dissolve into the atmosphere via the mask. */}
      <div
        className="absolute"
        style={{
          width: 620,
          height: 620,
          left: 790,
          top: -250,
          borderRadius: '50%',
          background: `
            radial-gradient(circle at 38% 34%, color-mix(in srgb, var(--a2) 90%, white) 0%, transparent 50%),
            radial-gradient(circle at 72% 70%, color-mix(in srgb, var(--a3) 82%, transparent) 0%, transparent 58%),
            radial-gradient(circle at 50% 50%, var(--a1) 0%, color-mix(in srgb, var(--a1) 28%, transparent) 64%, transparent 100%)
          `,
          filter: 'blur(6px)',
          WebkitMaskImage: 'radial-gradient(circle, #000 46%, transparent 70%)',
          maskImage: 'radial-gradient(circle, #000 46%, transparent 70%)',
          boxShadow: '0 0 240px 64px color-mix(in srgb, var(--a2) 24%, transparent)',
          animation: 'sun-breathe 15s ease-in-out infinite',
        }}
      />

      {/* Grain. */}
      <div className="scene-grain absolute inset-0" style={{ opacity: 0.05 }} />

      {/* Vignette + a soft floor that grounds the type. No edges — only shade. */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(132% 122% at 50% 36%, transparent 42%, rgba(9,7,13,0.64) 100%),
            linear-gradient(to top, rgba(9,7,13,0.58) 0%, transparent 26%)
          `,
        }}
      />
    </div>
  )
}
