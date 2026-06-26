/* WEEK — 7 day-columns over the shared time grid (5cqh/hour). */
import { weekDays } from './dateUtils.js'
import TimeGrid from './TimeGrid.jsx'

export default function WeekView({ cursor, events, visible, clock, onCreate, onPickEvent, onReschedule }) {
  return (
    <TimeGrid
      days={weekDays(cursor)}
      events={events}
      visible={visible}
      clock={clock}
      hourCqh={5}
      onCreate={onCreate}
      onPickEvent={onPickEvent}
      onReschedule={onReschedule}
    />
  )
}
