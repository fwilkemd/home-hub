import { useEffect, useState } from 'react'
import TabletFrame from './components/TabletFrame.jsx'
import ScaledStage from './components/ScaledStage.jsx'
import LivingScene from './components/LivingScene.jsx'
import { theme } from './theme.js'
import { nowPlayingQueue } from './data/mock.js'

export default function App() {
  const [idx, setIdx] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)

  const album = nowPlayingQueue[idx]
  const advance = () => setIdx((i) => (i + 1) % nowPlayingQueue.length)
  const back = () => setIdx((i) => (i - 1 + nowPlayingQueue.length) % nowPlayingQueue.length)

  // The album's world slowly changes itself, so the signature whole-room recolor
  // is always on show at rest. Paused for reduced-motion (no churn) and on pause.
  useEffect(() => {
    if (!isPlaying) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(advance, 12000)
    return () => clearInterval(id)
  }, [isPlaying])

  // Quiet controls for the demo — no on-screen chrome. Arrows move between
  // worlds; space pauses the drift.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') advance()
      else if (e.key === 'ArrowLeft') back()
      else if (e.key === ' ') {
        e.preventDefault()
        setIsPlaying((p) => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <TabletFrame>
      <ScaledStage baseW={theme.screen.w} baseH={theme.screen.h}>
        <LivingScene album={album} isPlaying={isPlaying} onAdvance={advance} />
      </ScaledStage>
    </TabletFrame>
  )
}
