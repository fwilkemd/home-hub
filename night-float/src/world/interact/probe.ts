/**
 * Ultrasound probe snapping — geometry side of SPEC §8.1. While the probe is
 * held near the patient, the aim point maps to the nearest UsViewId anchor;
 * view changes dispatch UsSetView via deps.onAction and micro-positioning
 * drives window quality via hubActions.setUs (throttled ~10 Hz).
 */
import * as THREE from 'three';
import type { UsViewId } from '../../contracts/ids';
import type { WorldCtx, Updater } from '../types';
import type { PatientRig } from '../patient';
import { hubActions, hubStore } from '../../bridge/store';
import { clamp } from '../lib';

const NEAR_RANGE = 1.6;
const QUALITY_RADIUS = 0.06; // lateral falloff to the 0.55 floor
const SWITCH_HYSTERESIS = 1.15;

export function createProbe(ctx: WorldCtx, rig: PatientRig): Updater {
  const raycaster = new THREE.Raycaster();
  raycaster.far = NEAR_RANGE;
  // patient body-zone boxes double as the scannable surface
  const surface = ctx.reg.colliders.filter((c) =>
    String(c.userData.nfInteractId ?? '').startsWith('zone_'),
  );

  let view: UsViewId | null = null;
  let throttle = 0;
  let lastQuality = -1;
  const tmp = new THREE.Vector3();

  const setView = (v: UsViewId | null): void => {
    if (view === v) return;
    view = v;
    ctx.deps.onAction({ id: 'us-view', label: '', command: { type: 'UsSetView', view: v } });
  };

  return (dt) => {
    throttle += dt;
    if (hubStore.getState().heldTool !== 'us_probe') {
      setView(null);
      return;
    }
    if (ctx.camera.position.distanceTo(rig.center) > NEAR_RANGE) {
      setView(null);
      return;
    }
    ctx.camera.updateMatrixWorld();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), ctx.camera);
    const hits = raycaster.intersectObjects(surface, false);
    if (hits.length === 0) {
      setView(null);
      return;
    }
    const p = hits[0].point;

    let best: UsViewId | null = null;
    let bestD = Infinity;
    let currentD = Infinity;
    for (const [id, anchor] of rig.usAnchors) {
      const d = anchor.getWorldPosition(tmp).distanceTo(p);
      if (d < bestD) {
        bestD = d;
        best = id;
      }
      if (id === view) currentD = d;
    }
    // hysteresis: only switch when clearly closer than the active anchor
    const next = view && currentD < bestD * SWITCH_HYSTERESIS ? view : best;
    setView(next);

    const dist = next === best ? bestD : currentD; // lateral distance to the active anchor
    const quality = 1 - clamp(dist / QUALITY_RADIUS, 0, 1) * 0.45;
    if (throttle >= 0.1) {
      throttle = 0;
      if (Math.abs(quality - lastQuality) > 0.01) {
        lastQuality = quality;
        hubActions.setUs({ quality });
      }
    }
  };
}
