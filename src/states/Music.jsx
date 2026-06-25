/*
  MUSIC — the album's world brought fully forward. With no real art, the art IS
  the palette: a huge luminous disc in the album's colors bleeds off the right
  edge. The track is named as the image, big in the lower-left. Color floods.
  A thin line shows position and keeps moving, so the state is visibly alive.
*/
export default function Music({ track, progress }) {
  return (
    <section className="poster poster-music" aria-label="Music">
      <div className="music-disc" aria-hidden="true">
        <div className="music-disc-core" />
      </div>

      <p className="music-kicker">now playing</p>

      <h1 className="music-title">{track.title}</h1>

      <p className="music-by">
        {track.artist} <span className="music-dot">·</span> {track.album}
      </p>

      <div
        className="music-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <span className="music-progress-fill" style={{ width: `${progress * 100}%` }} />
      </div>
    </section>
  )
}
