/*
  The music, named quietly at the foot of the scene. The album already owns the
  whole room's color; here it simply says its name. The equaliser is built from
  form — four thin bars — never an emoji, and pauses when playback is paused.
*/
export default function NowPlayingCaption({ album, isPlaying }) {
  return (
    <div className="flex items-end gap-4" style={{ textShadow: '0 2px 22px rgba(0,0,0,0.5)' }}>
      {/* Equaliser. */}
      <div
        className="flex items-end"
        style={{ height: 30, gap: 5, paddingBottom: 7 }}
        aria-hidden="true"
      >
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            style={{
              width: 3,
              height: 30,
              borderRadius: 3,
              transformOrigin: 'bottom',
              background: 'linear-gradient(to top, var(--a1), var(--a2))',
              animation: `eq-bar ${900 + i * 230}ms ease-in-out infinite`,
              animationDelay: `${i * 120}ms`,
              animationPlayState: isPlaying ? 'running' : 'paused',
              opacity: 0.92,
            }}
          />
        ))}
      </div>

      <div>
        <div
          className="font-mono"
          style={{ fontSize: 12.5, letterSpacing: '0.32em', color: 'var(--ink-faint)' }}
        >
          NOW PLAYING · KITCHEN
        </div>
        <div style={{ marginTop: 4 }}>
          <span
            className="font-display"
            style={{
              fontSize: 30,
              fontStyle: 'italic',
              fontVariationSettings: '"opsz" 72, "wght" 440',
              color: 'color-mix(in srgb, var(--a2) 82%, white)',
            }}
          >
            {album.title}
          </span>
          <span className="font-body" style={{ fontSize: 22, color: 'var(--ink-dim)' }}>
            {'   —   '}
            {album.artist}
          </span>
        </div>
      </div>
    </div>
  )
}
