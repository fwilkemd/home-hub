/**
 * Media tab: saved ultrasound stills + CXRs as a thumbnail grid with a
 * lightbox (large image + findings text).
 */
import { useState } from 'react';
import { useHub } from '../../bridge/store';
import type { MediaItem } from '../../contracts/runtime';
import { wallClock } from '../format';
import { IconX } from '../icons';

export function MediaTab() {
  const media = useHub((s) => s.media);
  const clockStart = useHub((s) => s.clockStart);
  const [selected, setSelected] = useState<MediaItem | null>(null);

  if (media.length === 0) {
    return (
      <p className="empty">
        No media yet — save an ultrasound clip at the machine or order a CXR.
      </p>
    );
  }

  return (
    <div>
      <div className="mediagrid">
        {[...media].reverse().map((m) => (
          <button key={m.id} className="mediathumb" onClick={() => setSelected(m)}>
            {m.dataUrl ? (
              <img src={m.dataUrl} alt={m.label} />
            ) : (
              <span className="noimg">image unavailable</span>
            )}
            <figcaption>
              <span>{m.label}</span>
              <span className="mono">{wallClock(clockStart, m.t, false)}</span>
            </figcaption>
          </button>
        ))}
      </div>

      {selected && (
        <div className="lightbox" onClick={() => setSelected(null)}>
          <figure onClick={(e) => e.stopPropagation()}>
            <header>
              <strong>{selected.label}</strong>
              <span className="mono dim">{wallClock(clockStart, selected.t, false)}</span>
              <button className="iconbtn" onClick={() => setSelected(null)} aria-label="Close image">
                <IconX />
              </button>
            </header>
            {selected.dataUrl ? (
              <img src={selected.dataUrl} alt={selected.label} />
            ) : (
              <div className="zoom-missing">image unavailable</div>
            )}
            {selected.findingsText && <figcaption>{selected.findingsText}</figcaption>}
          </figure>
        </div>
      )}
    </div>
  );
}
