import { CookingPot, Sofa, Briefcase, BedDouble, Thermometer } from 'lucide-react'
import GlassCard from './GlassCard.jsx'
import { rooms } from '../data/mock.js'

// Icon names in mock data map to lucide components here (data stays serializable).
const ICONS = { CookingPot, Sofa, Briefcase, BedDouble }

export default function RoomStates() {
  return (
    <div className="grid h-full w-full grid-cols-4 gap-5">
      {rooms.map((room) => {
        const Icon = ICONS[room.icon] ?? Sofa
        return (
          <GlassCard key={room.id} className="flex h-full flex-col justify-between p-5">
            <div className="flex items-center justify-between">
              <span
                className="grid h-12 w-12 place-items-center rounded-2xl"
                style={{
                  color: room.on ? '#141019' : 'var(--ink-dim)',
                  background: room.on
                    ? 'linear-gradient(135deg, var(--a2), var(--a1))'
                    : 'rgba(255,255,255,0.08)',
                }}
              >
                <Icon size={24} strokeWidth={2} />
              </span>
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: room.on ? 'var(--a3)' : 'rgba(255,255,255,0.18)' }}
              />
            </div>

            <div className="mt-3">
              <div className="font-body" style={{ fontSize: 21, fontWeight: 600 }}>
                {room.name}
              </div>
              <div className="font-body text-[var(--ink-dim)]" style={{ fontSize: 16 }}>
                {room.state}
              </div>
            </div>

            <div className="mt-3 flex items-center gap-1.5 font-mono text-[var(--ink-faint)]" style={{ fontSize: 14 }}>
              <Thermometer size={14} strokeWidth={2} />
              {room.tempF}°F
            </div>
          </GlassCard>
        )
      })}
    </div>
  )
}
