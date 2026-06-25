/*
  NOW — this moment. Time is the hero, set huge and pushed into the lower-left
  so it leans on the frame. Date + weather are whispered as a mono line up top.
  The ONE glowing element is the next important thing (Forrest off night float),
  emphasized in the album's light over on the right. Everything else is absent.
*/
export default function Now({ clock, today }) {
  const h = clock.getHours()
  const m = clock.getMinutes()
  const hour12 = ((h + 11) % 12) + 1
  const minutes = String(m).padStart(2, '0')
  const meridiem = h < 12 ? 'am' : 'pm'
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

      {next && (
        <aside className="now-next" aria-label="Next">
          <span className="now-next-kicker">next</span>
          <span className="now-next-label">{next.label}</span>
          <span className="now-next-when">
            {next.time} · {next.sub}
          </span>
        </aside>
      )}
    </section>
  )
}
