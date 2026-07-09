/**
 * Fullscreen laryngoscope view: a rAF loop pumps the procedural painter and
 * blits its canvas (ZoomOverlay pattern — no React re-render per frame).
 * When the active step is a 'slider' interaction it adds the tube-depth
 * slider (drag + arrow keys) with a marked "good depth" band gating
 * [Advance]. Esc closes the view WITHOUT aborting the procedure (captured
 * before the global handler); the transparent veil swallows stray clicks so
 * the world canvas can't grab pointer lock mid-slider.
 */
import { useEffect, useRef, useState } from 'react';
import type { ProcedureRuntimeStep } from '../../contracts/runtime';
import { dispatch } from '../../bridge/session';
import type { LaryngoscopyPainter } from '../../screens/laryngoscopy';
import { IconX } from '../icons';

/** Good tube depth band (fraction of slider travel). */
export const TUBE_GOOD_LO = 0.62;
export const TUBE_GOOD_HI = 0.78;
/** Display mapping: 0..1 -> cm at the lips. TODO(MEDICAL): depth-by-height. */
const CM_LO = 14;
const CM_SPAN = 12;

export function LaryngoscopyOverlay({
  painter,
  sliderStep,
  onClose,
}: {
  painter: LaryngoscopyPainter;
  sliderStep: ProcedureRuntimeStep | null;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [depth, setDepth] = useState(() => painter.getTubeDepth());

  // pump + blit: the painter self-throttles to 30 fps internally
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let raf = 0;
    const blit = () => {
      painter.update(performance.now() / 1000);
      const src = painter.canvas;
      if (canvas.width !== src.width || canvas.height !== src.height) {
        canvas.width = src.width;
        canvas.height = src.height;
      }
      ctx.drawImage(src, 0, 0);
      raf = requestAnimationFrame(blit);
    };
    raf = requestAnimationFrame(blit);
    return () => cancelAnimationFrame(raf);
  }, [painter]);

  // Esc: close the view only — never abort. Capture beats the global handler.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const setTube = (v01: number): void => {
    painter.setTubeDepth(v01);
    setDepth(painter.getTubeDepth());
  };
  const inBand = depth >= TUBE_GOOD_LO && depth <= TUBE_GOOD_HI;

  return (
    <div className="laryng-veil" onClick={(e) => e.stopPropagation()}>
      <div className="laryng-frame">
        <div className="zoom-title">
          <strong>Laryngoscope</strong>
          <span className="dim small">
            <span className="kc">Esc</span> lower the blade view
          </span>
          <button className="iconbtn" onClick={onClose} aria-label="Close laryngoscope view">
            <IconX />
          </button>
        </div>
        <canvas ref={canvasRef} className="laryng-canvas" />
        {sliderStep ? (
          <div className="laryng-controls">
            <span className="laryng-depth mono">{(CM_LO + depth * CM_SPAN).toFixed(1)} cm</span>
            <div className="laryng-slider">
              <div
                className="laryng-band"
                style={{
                  left: `${TUBE_GOOD_LO * 100}%`,
                  width: `${(TUBE_GOOD_HI - TUBE_GOOD_LO) * 100}%`,
                }}
                aria-hidden="true"
              />
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(depth * 100)}
                onChange={(e) => setTube(Number(e.currentTarget.value) / 100)}
                aria-label="Tube depth"
                autoFocus
              />
            </div>
            <button
              className="btn acc sm laryng-advance"
              disabled={!inBand}
              title={inBand ? undefined : 'Advance to the marked depth band first'}
              onClick={() => dispatch({ type: 'AdvanceProcedureStep', stepId: sliderStep.id })}
            >
              Advance
            </button>
          </div>
        ) : (
          <div className="laryng-controls">
            <span className="dim small">
              Lift along the handle axis — hold <span className="kc">E</span> at the bedside, or use
              the procedure panel.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
