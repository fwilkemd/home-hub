/* DAY — a single wide column over the shared time grid, airier (8cqh/hour). */
import TimeGrid from './TimeGrid.jsx'

export default function DayView({ cursor, events, visible, clock, onCreate, onPickEvent }) {
  return (
    <TimeGrid
      days={[cursor]}
      events={events}
      visible={visible}
      clock={clock}
      hourCqh={8}
      dense
      onCreate={onCreate}
      onPickEvent={onPickEvent}
    />
  )
}
