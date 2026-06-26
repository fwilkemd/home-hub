/*
  The one unmet need, surfaced on the ambient Now wall — the room responding to
  something, not a corner badge. When a timed task slips past its due time
  unchecked, it takes the place of the "next" glow as the single bright thing:
    "Roo · unfed · 5:12"
  Tap it to open the task list; check it off right here to clear the glow. If
  more than one is overdue we show the most urgent and a quiet "+N more".

  It swallows its own pointer events so touching it never also turns the room —
  the room's tap-to-turn never sees the gesture (gesture grammar stays disjoint).
*/
import { Check } from 'lucide-react'

const stop = (e) => e.stopPropagation()

export default function NowConcern({ concern, timeLabel, extra, onCheck, onOpen }) {
  return (
    <aside
      className="now-concern"
      aria-label="Needs attention"
      onPointerDown={stop}
      onPointerUp={stop}
      onPointerCancel={stop}
    >
      <span className="now-concern-kicker">needs you</span>

      <button type="button" className="now-concern-main" onClick={onOpen}>
        <span className="now-concern-label">{concern}</span>
        <span className="now-concern-when" aria-hidden="true">
          {timeLabel}
        </span>
      </button>

      <div className="now-concern-row">
        <button type="button" className="now-concern-check" onClick={onCheck} aria-label={`Check off ${concern}`}>
          <Check strokeWidth={3} />
          <span>done</span>
        </button>
        {extra > 0 && <span className="now-concern-more">+{extra} more</span>}
      </div>
    </aside>
  )
}
