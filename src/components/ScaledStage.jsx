import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/*
  Renders children at a fixed logical size (baseW x baseH) and scales the whole
  thing as ONE unit to fit its parent — so the hub looks pixel-identical at any
  size, on the desktop preview or the real tablet. This is the layout guarantee
  from CLAUDE.md: design once at 1280x800, scale uniformly.
*/
export default function ScaledStage({ baseW, baseH, children }) {
  const ref = useRef(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const { width, height } = el.getBoundingClientRect()
      setScale(Math.min(width / baseW, height / baseH))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [baseW, baseH])

  // Center explicitly with the absolute + translate idiom rather than grid/flex
  // alignment: when the fixed-size child is larger than the stage (every
  // downscale case), container alignment aligns it to the start instead of
  // centering, which spills the hub off-screen. translate(-50%,-50%) centers
  // it regardless of size; scale() then shrinks it around that center.
  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden">
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: baseW,
          height: baseH,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        {children}
      </div>
    </div>
  )
}
