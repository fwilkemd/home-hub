import ClockDate from './ClockDate.jsx'
import NowPlaying from './NowPlaying.jsx'
import TodayPanel from './TodayPanel.jsx'
import RoomStates from './RoomStates.jsx'

// Greeting tuned to the real time of day.
function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Late night'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

/*
  The hub screen, authored at a fixed 1280x800 (Fire HD 10, 16:10). The current
  album's palette is written into --a1/--a2/--a3 here; because those are
  registered <color> properties, changing them crossfades the whole screen.
*/
export default function Hub({ album, isPlaying, onPrev, onNext, onTogglePlay }) {
  const [a1, a2, a3] = album.palette

  return (
    <div
      className="relative h-full w-full"
      style={{
        '--a1': a1,
        '--a2': a2,
        '--a3': a3,
        transition: 'background 1.6s ease, --a1 1.6s ease, --a2 1.6s ease, --a3 1.6s ease',
        background: 'var(--canvas)',
      }}
    >
      {/* Screen-wide recolor: soft accent glows over the charcoal canvas. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          transition: 'background 1.6s ease',
          background: `
            radial-gradient(80% 70% at 16% 0%, color-mix(in srgb, var(--a1) 42%, transparent) 0%, transparent 60%),
            radial-gradient(70% 70% at 100% 8%, color-mix(in srgb, var(--a2) 34%, transparent) 0%, transparent 58%),
            radial-gradient(90% 90% at 88% 100%, color-mix(in srgb, var(--a3) 26%, transparent) 0%, transparent 60%)
          `,
        }}
      />

      {/* Content. */}
      <div className="relative flex h-full w-full flex-col p-14">
        {/* Header. */}
        <header className="flex items-start justify-between">
          <ClockDate />
          <div className="text-right">
            <div className="font-display text-[var(--ink-dim)]" style={{ fontSize: 30, fontWeight: 500 }}>
              {greeting()}
            </div>
            <div className="font-mono text-[var(--ink-faint)]" style={{ fontSize: 14, letterSpacing: '0.2em' }}>
              FORREST &amp; KATIE
            </div>
          </div>
        </header>

        {/* Main row: now-playing + today. */}
        <main className="mt-6 flex min-h-0 flex-1 gap-6">
          <div className="flex-[1.35]">
            <NowPlaying
              album={album}
              isPlaying={isPlaying}
              onPrev={onPrev}
              onNext={onNext}
              onTogglePlay={onTogglePlay}
            />
          </div>
          <div className="flex-1">
            <TodayPanel />
          </div>
        </main>

        {/* Room states. */}
        <footer className="mt-6" style={{ height: 158 }}>
          <RoomStates />
        </footer>
      </div>
    </div>
  )
}
