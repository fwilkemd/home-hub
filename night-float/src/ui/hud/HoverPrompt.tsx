/**
 * Center-dot crosshair + the hover prompt for whatever the player is looking
 * at. Display-only: the world itself listens for E/F/C/V.
 */
import { useHub } from '../../bridge/store';

const ACTION_KEYS = ['E', 'F', 'C', 'V'] as const;

export function CrosshairHover() {
  const hover = useHub((s) => s.hover);
  const pointerLocked = useHub((s) => s.pointerLocked);
  const overlayOpen = useHub(
    (s) => s.workstationOpen || s.zoomDevice !== null || s.radialOpen || s.settingsOpen,
  );
  const show = pointerLocked && !overlayOpen;
  if (!show) return null;
  return (
    <>
      <div className="crosshair" aria-hidden="true" />
      {hover && (
        <div className="hoverbox">
          <div className="hover-label">{hover.label}</div>
          {hover.actions.length > 0 && (
            <div className="hover-actions">
              {hover.actions.slice(0, 4).map((a, i) => (
                <span key={a.id} className="hover-action">
                  <span className="kc">{ACTION_KEYS[i]}</span> {a.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
