import { useEffect, useState } from 'react'
import TabletFrame from './components/TabletFrame.jsx'
import ScaledStage from './components/ScaledStage.jsx'
import Hub from './components/Hub.jsx'
import { theme } from './theme.js'
import { nowPlayingQueue } from './data/mock.js'

export default function App() {
  const [trackIdx, setTrackIdx] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)

  const album = nowPlayingQueue[trackIdx]
  const next = () => setTrackIdx((i) => (i + 1) % nowPlayingQueue.length)
  const prev = () => setTrackIdx((i) => (i - 1 + nowPlayingQueue.length) % nowPlayingQueue.length)

  // Slowly auto-advance the album to demo the signature screen-wide recolor.
  // Paused when the user pauses playback; reduced-motion users get no churn.
  useEffect(() => {
    if (!isPlaying) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    const id = setInterval(next, 9000)
    return () => clearInterval(id)
  }, [isPlaying])

  return (
    <TabletFrame>
      <ScaledStage baseW={theme.screen.w} baseH={theme.screen.h}>
        <Hub
          album={album}
          isPlaying={isPlaying}
          onPrev={prev}
          onNext={next}
          onTogglePlay={() => setIsPlaying((p) => !p)}
        />
      </ScaledStage>
    </TabletFrame>
  )
}
