import { CalendarDays, Moon, BedDouble, Briefcase, Home, LogOut, Sun } from 'lucide-react'
import GlassCard from './GlassCard.jsx'
import { todayEvents, todayMeta } from '../data/mock.js'

// Per-event icon. The "arrival" event (Forrest home from night shift) is the
// one that will drive an automation later, so it reads as the accent moment.
const ICONS = {
  arrival: Moon,
  rest: BedDouble,
  work: Briefcase,
  home: Home,
  shift: LogOut,
}

export default function TodayPanel() {
  return (
    <GlassCard className="flex h-full w-full flex-col p-6">
      <div className="flex items-center gap-3">
        <CalendarDays size={22} strokeWidth={2} className="text-[var(--ink-dim)]" />
        <span className="font-display" style={{ fontSize: 30, fontWeight: 500 }}>
          Today
        </span>
        <span className="ml-auto flex items-center gap-2 font-body text-[var(--ink-dim)]" style={{ fontSize: 20 }}>
          <Sun size={18} strokeWidth={2} />
          {todayMeta.weather.tempF}° {todayMeta.weather.label}
        </span>
      </div>

      <div className="mt-3 flex flex-1 flex-col justify-between gap-1">
        {todayEvents.map((ev) => {
          const Icon = ICONS[ev.kind] ?? CalendarDays
          const accent = ev.kind === 'arrival'
          return (
            <div
              key={ev.id}
              className="flex items-center gap-3.5 rounded-2xl px-3 py-1"
              style={accent ? { background: 'rgba(255,255,255,0.07)' } : undefined}
            >
              <span className="w-[62px] shrink-0 font-mono text-[var(--ink-dim)]" style={{ fontSize: 17 }}>
                {ev.time}
              </span>
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
                style={{
                  color: accent ? '#141019' : 'var(--ink)',
                  background: accent
                    ? 'linear-gradient(135deg, var(--a2), var(--a1))'
                    : 'rgba(255,255,255,0.08)',
                }}
              >
                <Icon size={20} strokeWidth={2} />
              </span>
              <span className="flex min-w-0 flex-col">
                <span
                  className="truncate font-body"
                  style={{ fontSize: 20, fontWeight: accent ? 600 : 500 }}
                >
                  {ev.title}
                </span>
                <span className="truncate font-body text-[var(--ink-faint)]" style={{ fontSize: 15 }}>
                  {ev.sub}
                </span>
              </span>
            </div>
          )
        })}
      </div>
    </GlassCard>
  )
}
