/*
  A realistic tablet device frame (Fire HD 10 proportions: 16:10 landscape)
  sitting on a soft wall. The frame sizes itself to the viewport while keeping
  its aspect ratio; the screen surface inside hosts the scaled hub.
*/
export default function TabletFrame({ children }) {
  return (
    // Soft wall background.
    <div
      className="grid h-full w-full place-items-center p-[3vmin]"
      style={{
        background:
          'radial-gradient(120% 120% at 50% 18%, #2a2730 0%, #211e26 38%, #181620 100%)',
      }}
    >
      {/* Device body — bezel. Aspect is the screen's 16:10 plus an even bezel. */}
      <div
        className="relative"
        style={{
          width: 'min(96vw, calc(94vh * 1.6))',
          aspectRatio: '16 / 10',
          padding: '2.1%',
          borderRadius: '2.4vmin',
          background: 'linear-gradient(160deg, #2c2c30 0%, #161618 60%, #0e0e10 100%)',
          boxShadow:
            '0 2.6vmin 6vmin rgba(0,0,0,0.55), 0 0.4vmin 1vmin rgba(0,0,0,0.4), inset 0 0 0 0.18vmin rgba(255,255,255,0.05)',
        }}
      >
        {/* Front camera dot, centered on the top long edge. */}
        <div
          className="absolute left-1/2 top-[0.95%] -translate-x-1/2 rounded-full"
          style={{
            width: '0.7vmin',
            height: '0.7vmin',
            background: 'radial-gradient(circle at 35% 35%, #3a3a44, #0a0a0c 70%)',
            boxShadow: 'inset 0 0 0.2vmin rgba(255,255,255,0.12)',
          }}
        />

        {/* Screen surface — the hub lives here. */}
        <div
          className="relative h-full w-full overflow-hidden"
          style={{ borderRadius: '1vmin', background: 'var(--canvas)' }}
        >
          {children}
          {/* Faint glass glare across the panel. */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(125deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 22%)',
            }}
          />
        </div>
      </div>
    </div>
  )
}
