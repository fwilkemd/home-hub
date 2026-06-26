/*
  The Tasks section of the legible layer — Skylight's chores, in our type-led
  world. Grouped by person (Forrest / Katie / Both / Anyone), each group a quiet
  heading in that person's identity color over a column of one-line tasks. No
  boxes-on-a-grid; legibility and one-tap check-off are the whole job.

  It shows the tasks that occur on the layer's current day (the calendar cursor),
  so stepping the day with ‹ Today › reveals exactly the chores due then — which
  is how a weekly chore stays legible. Overdue styling only applies to *today*.
*/
import { Plus } from 'lucide-react'
import TaskRow from './TaskRow.jsx'
import { useTasksStore } from './useTasksStore.js'
import { occursOn, isCompleteOn, isOverdue, dueMinutes } from './recurrence.js'
import { GROUP_ORDER, ASSIGNEE_BY_ID } from './tasksConfig.js'
import { dateKey, isToday } from '../calendar/dateUtils.js'

// Within a group: open before done; timed before untimed; earlier time first.
function compare(a, b, key) {
  const ad = isCompleteOn(a, key)
  const bd = isCompleteOn(b, key)
  if (ad !== bd) return ad ? 1 : -1
  const am = dueMinutes(a)
  const bm = dueMinutes(b)
  if ((am == null) !== (bm == null)) return am == null ? 1 : -1
  if (am != null && bm != null && am !== bm) return am - bm
  return a.title.localeCompare(b.title)
}

export default function TasksView({ cursor, clock, onCreate, onPickTask }) {
  const { tasks, toggleComplete } = useTasksStore()
  const key = dateKey(cursor)
  const todayView = isToday(cursor, clock)

  const dayTasks = tasks.filter((t) => occursOn(t, cursor))
  const groups = GROUP_ORDER.map((gid) => ({
    meta: ASSIGNEE_BY_ID[gid],
    items: dayTasks.filter((t) => t.assignee === gid).sort((a, b) => compare(a, b, key)),
  })).filter((g) => g.items.length)

  const total = dayTasks.length
  const doneCount = dayTasks.filter((t) => isCompleteOn(t, key)).length

  return (
    <div className="tasks" data-scroll>
      {groups.length === 0 ? (
        <div className="tasks-empty">
          <p className="tasks-empty-line">Nothing on the list{todayView ? ' today' : ''}.</p>
          <button type="button" className="tasks-add tasks-add-empty" onClick={() => onCreate()}>
            <Plus strokeWidth={2} /> Add a task
          </button>
        </div>
      ) : (
        <>
          {total > 0 && (
            <p className="tasks-summary">
              {doneCount === total ? 'All done' : `${total - doneCount} to go`}
              {doneCount > 0 && <span className="tasks-summary-dim"> · {doneCount} done</span>}
            </p>
          )}

          {groups.map((g) => (
            <section className="task-group" key={g.meta.id}>
              <header className="task-group-head">
                <span className="task-group-dot" style={{ '--chip': g.meta.color }} />
                <h3 className="task-group-name">{g.meta.name}</h3>
                <span className="task-group-count">{g.items.filter((t) => !isCompleteOn(t, key)).length || '✓'}</span>
              </header>
              <ul className="task-list">
                {g.items.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    done={isCompleteOn(t, key)}
                    overdue={todayView && isOverdue(t, clock)}
                    onToggle={() => toggleComplete(t.id, key)}
                    onEdit={() => onPickTask(t)}
                  />
                ))}
              </ul>
            </section>
          ))}

          <button type="button" className="tasks-add" onClick={() => onCreate()}>
            <Plus strokeWidth={2} /> Add a task
          </button>
        </>
      )}
    </div>
  )
}
