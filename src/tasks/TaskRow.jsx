/*
  One task, one line — the legible-layer atom. Skylight-simple: a big round
  check on the left (one tap = done), the title, and quiet metadata (due time +
  how it repeats). Tapping the body opens the editor. Completed rows dim and
  strike so the eye slides past them. No artistry that gets in the way of "check
  it and move on" — function wins here.
*/
import { Check } from 'lucide-react'
import { recurrenceLabel, formatDue } from './recurrence.js'

export default function TaskRow({ task, done, overdue, onToggle, onEdit }) {
  const due = formatDue(task.dueTime)
  const repeat = recurrenceLabel(task)

  return (
    <li className={`task-row${done ? ' is-done' : ''}${overdue ? ' is-overdue' : ''}`}>
      <button
        type="button"
        className="task-check"
        onClick={onToggle}
        aria-pressed={done}
        aria-label={done ? `Mark “${task.title}” not done` : `Check off “${task.title}”`}
      >
        {done && <Check strokeWidth={3} />}
      </button>

      <button type="button" className="task-main" onClick={onEdit} aria-label={`Edit “${task.title}”`}>
        <span className="task-title">{task.title}</span>
        {(due || repeat) && (
          <span className="task-meta">
            {due && <span className={`task-due${overdue ? ' is-overdue' : ''}`}>{due}</span>}
            {due && repeat && <span className="task-meta-sep">·</span>}
            {repeat && <span className="task-repeat">{repeat}</span>}
          </span>
        )}
      </button>
    </li>
  )
}
