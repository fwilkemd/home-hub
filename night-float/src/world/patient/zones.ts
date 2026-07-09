/**
 * Invisible body-zone colliders (exam targets, SPEC §6.4) + ultrasound view
 * anchor points on the body (SPEC §8.1). Zone hover actions depend on the
 * held tool; kits only offer procedures on plausible zones.
 */
import * as THREE from 'three';
import type { WorldCtx } from '../types';
import type { ContextAction } from '../../contracts/runtime';
import type { BodyZoneId, ToolId, UsViewId } from '../../contracts/ids';
import { hubStore } from '../../bridge/store';

const ZONE_LABELS: Record<BodyZoneId, string> = {
  head: 'Head',
  neck: 'Neck',
  precordium: 'Precordium',
  chest_left: 'Chest (L)',
  chest_right: 'Chest (R)',
  abdomen: 'Abdomen',
  arm_left: 'Arm (L)',
  arm_right: 'Arm (R)',
  leg_left: 'Leg (L)',
  leg_right: 'Leg (R)',
};

/** patient-local zone boxes; upper-body zones ride the inclined group */
const UPPER_ZONES: Record<string, { size: [number, number, number]; pos: [number, number, number] }> = {
  head: { size: [0.26, 0.22, 0.26], pos: [0, 0.13, -0.72] },
  neck: { size: [0.16, 0.14, 0.14], pos: [0, 0.1, -0.6] },
  precordium: { size: [0.2, 0.17, 0.22], pos: [0.03, 0.14, -0.4] },
  chest_left: { size: [0.2, 0.14, 0.3], pos: [0.14, 0.1, -0.42] },
  chest_right: { size: [0.2, 0.14, 0.3], pos: [-0.14, 0.1, -0.42] },
  abdomen: { size: [0.32, 0.14, 0.26], pos: [0, 0.1, -0.12] },
  arm_left: { size: [0.12, 0.12, 0.55], pos: [0.27, 0.08, -0.28] },
  arm_right: { size: [0.12, 0.12, 0.55], pos: [-0.27, 0.08, -0.28] },
};
const LOWER_ZONES: Record<string, { size: [number, number, number]; pos: [number, number, number] }> = {
  leg_left: { size: [0.18, 0.16, 0.85], pos: [0.1, 0.1, 0.52] },
  leg_right: { size: [0.18, 0.16, 0.85], pos: [-0.1, 0.1, 0.52] },
};

/** Patient's left = +x (supine, head toward the headwall at -z). */
const US_ANCHORS: Record<UsViewId, [number, number, number]> = {
  plax: [0.04, 0.2, -0.44],
  psax: [0.06, 0.2, -0.4],
  a4c: [0.14, 0.17, -0.33],
  subxiphoid: [0, 0.17, -0.24],
  ivc: [0, 0.16, -0.2],
  lung_ant_l: [0.13, 0.21, -0.47],
  lung_ant_r: [-0.13, 0.21, -0.47],
  lung_post_l: [0.21, 0.08, -0.36],
  lung_post_r: [-0.21, 0.08, -0.36],
  ruq: [-0.12, 0.14, -0.14],
  luq: [0.12, 0.14, -0.14],
  pelvis: [0, 0.12, 0.04],
};

const KIT_PROCEDURES: Partial<
  Record<ToolId, { procedureId: string; label: string; zones: BodyZoneId[] }>
> = {
  cvl_kit: {
    procedureId: 'cvl',
    label: 'Start central line',
    zones: ['neck', 'precordium', 'chest_left', 'chest_right'],
  },
  aline_kit: { procedureId: 'aline', label: 'Start arterial line', zones: ['arm_left', 'arm_right'] },
  ett_kit: { procedureId: 'ett', label: 'Start intubation', zones: ['head', 'neck'] },
};

function zoneActions(zone: BodyZoneId): ContextAction[] {
  const held = hubStore.getState().heldTool;
  const base: ContextAction[] = [
    { id: 'inspect', label: 'Inspect', command: { type: 'PerformExam', zone, mode: 'inspect' } },
    { id: 'palpate', label: 'Palpate', command: { type: 'PerformExam', zone, mode: 'palpate' } },
  ];
  if (held === 'stethoscope') {
    return [
      { id: 'auscultate', label: 'Auscultate', command: { type: 'PerformExam', zone, mode: 'auscultate' } },
      ...base,
    ];
  }
  if (held === 'us_probe') {
    // scanning is continuous (probe.ts drives UsSetView) — display-only action
    return [{ id: 'scan', label: 'Scan here' }, ...base];
  }
  const kit = held ? KIT_PROCEDURES[held] : undefined;
  if (kit && kit.zones.includes(zone)) {
    return [
      { id: 'proc', label: kit.label, ui: { type: 'startProcedureFlow', procedureId: kit.procedureId } },
      ...base,
    ];
  }
  return base;
}

const zoneGlowMaterial = (): THREE.MeshBasicMaterial =>
  new THREE.MeshBasicMaterial({
    color: 0x9fc7ff,
    transparent: true,
    opacity: 0.07,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

/**
 * Adds zone collider boxes as children of the patient's upper/lower groups
 * and registers them. Boxes stay visible=false (raycast still hits them);
 * the hover system flips visibility for the soft glow highlight.
 */
export function buildZones(ctx: WorldCtx, upper: THREE.Group, lower: THREE.Group): void {
  const addZone = (zone: BodyZoneId, parent: THREE.Group, spec: { size: [number, number, number]; pos: [number, number, number] }): void => {
    const box = new THREE.Mesh(new THREE.BoxGeometry(...spec.size), zoneGlowMaterial());
    box.position.set(...spec.pos);
    box.visible = false;
    box.userData.nfGlow = true;
    box.userData.nfZone = zone;
    parent.add(box);
    ctx.reg.add({
      id: `zone_${zone}`,
      label: ZONE_LABELS[zone],
      colliders: [box],
      highlights: [box],
      getActions: () => zoneActions(zone),
    });
  };
  for (const [zone, spec] of Object.entries(UPPER_ZONES)) addZone(zone as BodyZoneId, upper, spec);
  for (const [zone, spec] of Object.entries(LOWER_ZONES)) addZone(zone as BodyZoneId, lower, spec);
}

/** Empty Object3D per ultrasound view, parented to the inclined torso. */
export function buildUsAnchors(upper: THREE.Group): Map<UsViewId, THREE.Object3D> {
  const map = new Map<UsViewId, THREE.Object3D>();
  for (const [view, pos] of Object.entries(US_ANCHORS)) {
    const o = new THREE.Object3D();
    o.position.set(pos[0], pos[1], pos[2]);
    upper.add(o);
    map.set(view as UsViewId, o);
  }
  return map;
}
