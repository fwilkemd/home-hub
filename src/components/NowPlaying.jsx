import { Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react'
import GlassCard from './GlassCard.jsx'

function fmt(sec) {
  const m = Math.floor(sec / 60)
  const s = String(Math.floor(sec % 60)).padStart(2, '0')
  return `${m}:${s}`
}

/*
  The signature card. Its album art is the source of the screen-wide accent
  recolor (handled by the parent). Tapping prev / next changes the album and
  the whole screen crossfades to the new palette.
*/
export default function NowPlaying({ album, isPlaying, onPrev, onNext, onTogglePlay }) {
  const pct = Math.min(100, (album.progressSec / album.durationSec) * 100)

  return (
    <GlassCard className="flex h-full w-full items-center gap-8 p-8">
      {/* Album art — recolors the screen. */}
      <div
        className="relative shrink-0 rounded-[22px]"
        style={{
          width: 248,
          height: 248,
          background: album.art,
          boxShadow: '0 22px 50px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.25)',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-[22px]"
          style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.25), rgba(255,255,255,0) 40%)' }}
        />
      </div>

      {/* Track meta + controls. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 font-mono text-[var(--ink-faint)]" style={{ fontSize: 13, letterSpacing: '0.18em' }}>
          <Volume2 size={15} strokeWidth={2} />
          NOW PLAYING · KITCHEN
        </div>

        <div className="mt-2 truncate font-display" style={{ fontSize: 46, fontWeight: 500, letterSpacing: '-0.01em' }}>
          {album.title}
        </div>
        <div className="truncate font-body text-[var(--ink-dim)]" style={{ fontSize: 24 }}>
          {album.artist} — {album.album}
        </div>

        {/* Progress. */}
        <div className="mt-6">
          <div className="h-[6px] w-full overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.14)' }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--a1), var(--a2))' }}
            />
          </div>
          <div className="mt-2 flex justify-between font-mono text-[var(--ink-faint)]" style={{ fontSize: 13 }}>
            <span>{fmt(album.progressSec)}</span>
            <span>{fmt(album.durationSec)}</span>
          </div>
        </div>

        {/* Transport controls. */}
        <div className="mt-5 flex items-center gap-5">
          <ControlButton label="Previous track" onClick={onPrev}>
            <SkipBack size={26} strokeWidth={2} fill="currentColor" />
          </ControlButton>
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="grid place-items-center rounded-full transition-transform active:scale-95"
            style={{
              width: 68,
              height: 68,
              color: '#141019',
              background: 'linear-gradient(135deg, var(--a2), var(--a1))',
              boxShadow: '0 14px 30px rgba(0,0,0,0.35)',
            }}
          >
            {isPlaying ? <Pause size={30} strokeWidth={2} fill="currentColor" /> : <Play size={30} strokeWidth={2} fill="currentColor" />}
          </button>
          <ControlButton label="Next track" onClick={onNext}>
            <SkipForward size={26} strokeWidth={2} fill="currentColor" />
          </ControlButton>
        </div>
      </div>
    </GlassCard>
  )
}

function ControlButton({ children, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid place-items-center rounded-full text-[var(--ink)] transition-colors active:scale-95"
      style={{ width: 52, height: 52, background: 'rgba(255,255,255,0.08)' }}
    >
      {children}
    </button>
  )
}
