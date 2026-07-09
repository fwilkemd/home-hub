/**
 * Fullscreen zoom of a device screen: a rAF loop blits the device's offscreen
 * canvas into a display canvas (no React re-render per frame) and forwards
 * pointer events back in source-canvas coordinates.
 */
import { useEffect, useRef } from 'react';
import type { MouseEvent as RMouseEvent, PointerEvent as RPointerEvent } from 'react';
import type { DeviceId } from '../contracts/ids';
import { getScreens } from '../bridge/session';
import { hubActions } from '../bridge/store';
import { IconX } from './icons';

const SCREEN_KEYS: Partial<Record<DeviceId, 'monitor' | 'vent' | 'pump' | 'us'>> = {
  monitor: 'monitor',
  vent: 'vent',
  pump: 'pump',
  us_machine: 'us',
};

const DEVICE_LABELS: Record<DeviceId, string> = {
  monitor: 'Patient monitor',
  vent: 'Ventilator',
  pump: 'Infusion pumps',
  us_machine: 'Ultrasound',
  workstation: 'Workstation',
};

export function ZoomOverlay({ device }: { device: DeviceId }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef({ active: false, moved: false, x0: 0, y0: 0 });

  const key = SCREEN_KEYS[device];
  const screen = key ? (getScreens()?.[key] ?? null) : null;

  // Blit loop: copy the source canvas every animation frame. The session's
  // own frame loop keeps redrawing the offscreen screens; we only copy.
  useEffect(() => {
    if (!screen) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let raf = 0;
    const blit = () => {
      const src = screen.canvas;
      if (src.width > 0 && src.height > 0) {
        if (canvas.width !== src.width || canvas.height !== src.height) {
          canvas.width = src.width;
          canvas.height = src.height;
        }
        ctx.drawImage(src, 0, 0);
      }
      raf = requestAnimationFrame(blit);
    };
    raf = requestAnimationFrame(blit);
    return () => cancelAnimationFrame(raf);
  }, [screen]);

  /** Display-space -> source-canvas coords (CSS scales the canvas). */
  const toSource = (e: { clientX: number; clientY: number }, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width;
    const sy = ((e.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height;
    return { sx, sy };
  };

  const onPointerDown = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (!screen?.drag) return;
    const canvas = e.currentTarget;
    dragRef.current = { active: true, moved: false, x0: e.clientX, y0: e.clientY };
    canvas.setPointerCapture(e.pointerId);
    const { sx, sy } = toSource(e, canvas);
    screen.drag(sx, sy, 'start');
  };
  const onPointerMove = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (!screen?.drag || !dragRef.current.active) return;
    if (Math.hypot(e.clientX - dragRef.current.x0, e.clientY - dragRef.current.y0) > 4) {
      dragRef.current.moved = true;
    }
    const { sx, sy } = toSource(e, e.currentTarget);
    screen.drag(sx, sy, 'move');
  };
  const onPointerUp = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (!screen?.drag || !dragRef.current.active) return;
    dragRef.current.active = false;
    const { sx, sy } = toSource(e, e.currentTarget);
    screen.drag(sx, sy, 'end');
  };
  const onClick = (e: RMouseEvent<HTMLCanvasElement>) => {
    if (!screen) return;
    if (dragRef.current.moved) {
      dragRef.current.moved = false; // a real drag shouldn't also click
      return;
    }
    const { sx, sy } = toSource(e, e.currentTarget);
    screen.click(sx, sy);
  };

  return (
    <div className="zoom-veil" onClick={() => hubActions.closeZoom()}>
      <div className="zoom-frame" onClick={(e) => e.stopPropagation()}>
        <div className="zoom-title">
          <strong>{DEVICE_LABELS[device]}</strong>
          <span className="dim small">
            <span className="kc">Esc</span> close
          </span>
          <button className="iconbtn" onClick={() => hubActions.closeZoom()} aria-label="Close device view">
            <IconX />
          </button>
        </div>
        {screen ? (
          <canvas
            ref={canvasRef}
            className="zoom-canvas"
            onClick={onClick}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        ) : (
          <div className="zoom-missing">Device screen not wired up yet (screens module pending).</div>
        )}
      </div>
    </div>
  );
}
