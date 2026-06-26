/*
  NOW — this moment. Time is the hero, set huge and pushed into the lower-left
  so it leans on the frame. Date + weather are whispered as a mono line up top.

  The ONE glowing element is whatever most needs the room right now:
   - if a timed task has slipped past its due time unchecked, that overdue
     concern surfaces (the room responding to an unmet need);
   - otherwise, the next important thing (Forrest off night float).
  Withholding holds: exactly one bright thing, never both.
*/
import { useTasksStore } from '../tasks/useTasksStore.js'
import { overdueList } from '../tasks/recurrence.js'
import { dateKey, formatTimeCompact } from '../calendar/dateUtils.js'
import NowConcern from '../tasks/NowConcern.jsx'

export default function Now({ clock, today, onOpenTasks }) {
  const { tasks, toggleComplete } = useTasksStore()
  const h = clock.getHours()
  const m = clock.getMinutes()
  const hour12 = ((h + 11) % 12) + 1
  const minutes = String(m).padStart(2, '0')
  const meridiem = h < 12 ? 'am' : 'pm'

  const overdue = overdueList(tasks, clock)
  const concernTask = overdue[0]?.task
  const next = today.events.find((e) => e.important)

  return (
    <section className="poster poster-now" aria-label="Now">
      <p className="now-meta">
        {today.weekday} · {today.dateLong} · {today.weather.tempF}° {today.weather.sky}
      </p>

      <h1 className="now-time">
        <span className="now-time-digits">
          {hour12}
          <span className="now-colon">:</span>
          {minutes}
        </span>
        <span className="now-meridiem">{meridiem}</span>
      </h1>

      {concernTask ? (
        <NowConcern
          concern={concernTask.concern || concernTask.title}
          timeLabel={formatTimeCompact(clock)}
          extra={overdue.length - 1}
          onCheck={() => toggleComplete(concernTask.id, dateKey(clock))}
          onOpen={() => onOpenTasks?.()}
        />
      ) : (
        next && (
          <aside className="now-next" aria-label="Next">
            <span className="now-next-kicker">next</span>
            <span className="now-next-label">{next.label}</span>
            <span className="now-next-when">
              {next.time} · {next.sub}
            </span>
          </aside>
        )
      )}
    </section>
  )
}
