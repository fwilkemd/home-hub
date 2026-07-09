/**
 * Ultrasound structure painters, part 1 (SPEC §8.2): cardiac windows plus the
 * per-view dispatcher and default findings. Non-cardiac painters live in
 * us-views-body.ts; the shared draw context in us-draw.ts.
 *
 * TODO(MEDICAL): all geometry is impressionistic — shapes/sizes/motion are
 * tuned so each view "reads", not for anatomic fidelity.
 */
import type { UsViewId } from '../contracts/ids';
import type {
  USAbdFindings,
  USCardiacFindings,
  USFindings,
  USIvcFindings,
  USLungFindings,
} from '../contracts/patient';
import { clamp } from '../engine/waveforms';
import { ell, gray, TWO_PI, type UsDraw } from './us-draw';
import { drawAbd, drawIvc, drawLung } from './us-views-body';

export type { UsDraw } from './us-draw';
export { drawProcedural, type ProceduralState } from './us-views-body';

/** Cardiac chamber: bright speckled wall + anechoic cavity. */
function chamber(
  d: UsDraw,
  xCm: number,
  yCm: number,
  rxCm: number,
  ryCm: number,
  rot: number,
  wallCm: number,
  wallBright: number,
): void {
  const c = d.ctx;
  const k = d.pxPerCm;
  const wall = wallCm * k * (1 + 0.45 * d.pulse); // systolic wall thickening
  const x = d.apexX + xCm * k;
  const y = d.apexY + yCm * k;
  ell(c, x, y, rxCm * k + wall, ryCm * k + wall, rot);
  c.fillStyle = gray(wallBright);
  c.fill();
  ell(c, x, y, rxCm * k, ryCm * k, rot);
  c.fillStyle = '#060606';
  c.fill();
}

// ================================================================ cardiac
function contractionScale(f: USCardiacFindings, pulse: number): number {
  return 1 - (0.06 + 0.32 * clamp(f.contractility, 0, 1)) * pulse;
}

/** Pericardium + anechoic effusion rim around a heart bundle. */
function pericardium(d: UsDraw, xCm: number, yCm: number, rxCm: number, ryCm: number, rot: number, effusion: number): void {
  const c = d.ctx;
  const k = d.pxPerCm;
  const rim = effusion * 1.1 * k;
  const x = d.apexX + xCm * k;
  const y = d.apexY + yCm * k;
  ell(c, x, y, rxCm * k + rim + 0.14 * k, ryCm * k + rim + 0.14 * k, rot);
  c.fillStyle = gray(0.82);
  c.fill();
  if (rim > 0.5) {
    ell(c, x, y, rxCm * k + rim, ryCm * k + rim, rot);
    c.fillStyle = '#020202';
    c.fill();
  }
  ell(c, x, y, rxCm * k, ryCm * k, rot);
  c.fillStyle = gray(0.42);
  c.fill();
}

function drawPlax(d: UsDraw, f: USCardiacFindings): void {
  const c = d.ctx;
  const k = d.pxPerCm;
  const s = contractionScale(f, d.pulse);
  const sway = 0.1 * Math.sin(TWO_PI * d.respPhase);
  c.save();
  // classic PLAX obliquity: heart long axis tilted across the sector
  c.translate(d.apexX + sway * k, d.apexY + 6.2 * k);
  c.rotate(-0.18);
  c.translate(-d.apexX, -d.apexY - 6.2 * k);
  // descending aorta behind the LA (landmark)
  ell(c, d.apexX + 3.9 * k, d.apexY + 9.4 * k, 0.65 * k, 0.6 * k, 0);
  c.fillStyle = '#050505';
  c.fill();
  c.strokeStyle = gray(0.6);
  c.lineWidth = 0.08 * k;
  c.stroke();
  pericardium(d, 0.2, 6.2, 4.6, 3.1, -0.1, f.effusion);
  chamber(d, -0.5, 4.0, 1.9 * f.rvScale, 0.8 * f.rvScale, -0.16, 0.24, 0.62); // RV
  // aorta / LVOT corridor
  c.save();
  const a = { x: d.apexX + 1.5 * k, y: d.apexY + 5.1 * k };
  c.translate(a.x, a.y);
  c.rotate(-0.12);
  c.fillStyle = gray(0.8);
  c.fillRect(0, -0.75 * k, 2.6 * k, 1.5 * k);
  c.fillStyle = '#070707';
  c.fillRect(0, -0.48 * k, 2.6 * k, 0.96 * k);
  c.restore();
  chamber(d, -0.9, 6.5, 2.55 * f.lvScale * s, 1.5 * f.lvScale * s, -0.12, 0.5, 0.78); // LV
  chamber(d, 2.6, 7.5, 1.35, 1.15, 0.25, 0.24, 0.68); // LA
  // mitral leaflet flicks open in diastole
  const open = (1 - d.pulse) * (0.55 + 0.45 * Math.sin(TWO_PI * d.t * 1.3));
  const mx = d.apexX + 1.15 * k;
  const my = d.apexY + 6.35 * k;
  c.strokeStyle = gray(0.92);
  c.lineWidth = 0.09 * k;
  c.beginPath();
  c.moveTo(mx, my);
  c.lineTo(mx - 1.15 * k * Math.cos(0.35 + open * 0.9), my + 1.15 * k * Math.sin(0.35 + open * 0.9));
  c.stroke();
  c.restore();
}

function drawPsax(d: UsDraw, f: USCardiacFindings): void {
  const c = d.ctx;
  const k = d.pxPerCm;
  const s = contractionScale(f, d.pulse);
  pericardium(d, 0, 6.0, 3.3, 3.0, 0, f.effusion);
  chamber(d, -2.4, 4.9, 1.7 * f.rvScale, 0.95 * f.rvScale, 0.55, 0.22, 0.58); // RV crescent
  const cav = 1.5 * f.lvScale * s;
  chamber(d, 0.2, 6.1, cav, cav * 0.96, 0, 0.72, 0.8); // LV donut
  // papillary muscles
  c.fillStyle = gray(0.75);
  for (const ang of [2.3, 0.85]) {
    const px = d.apexX + (0.2 + Math.cos(ang) * cav * 0.62) * k;
    const py = d.apexY + (6.1 + Math.sin(ang) * cav * 0.62) * k;
    ell(c, px, py, 0.3 * k, 0.24 * k, ang);
    c.fill();
  }
}

/** Shared 4-chamber bundle (a4c upright, subxiphoid tilted). */
function fourChambers(d: UsDraw, cx: number, cy: number, rot: number, f: USCardiacFindings): void {
  const c = d.ctx;
  const k = d.pxPerCm;
  const s = contractionScale(f, d.pulse);
  c.save();
  c.translate(d.apexX + cx * k, d.apexY + cy * k);
  c.rotate(rot);
  c.translate(-d.apexX, -d.apexY);
  pericardium(d, 0.05, 5.1, 3.1, 3.6, 0.05, f.effusion);
  const dv = 0.32 * d.pulse; // annular plane excursion toward the apex
  chamber(d, 1.1, 3.6 + dv * 0.4, 1.25 * f.lvScale * s, 1.8 * f.lvScale * s, 0.06, 0.42, 0.78); // LV
  chamber(d, -1.15, 3.7 + dv * 0.4, 0.95 * f.rvScale * s, 1.5 * f.rvScale * s, -0.06, 0.26, 0.6); // RV
  chamber(d, 1.05, 6.9 - dv, 1.15, 1.15, 0, 0.22, 0.66); // LA
  chamber(d, -1.0, 6.85 - dv, 0.95, 1.05, 0, 0.22, 0.62); // RA
  // septum + AV plane
  c.fillStyle = gray(0.85);
  c.fillRect(d.apexX - 0.13 * k, d.apexY + 2.1 * k, 0.26 * k, 3.5 * k);
  c.fillRect(d.apexX - 2.1 * k, d.apexY + (5.55 - dv) * k, 4.3 * k, 0.18 * k);
  c.restore();
}

function drawA4c(d: UsDraw, f: USCardiacFindings): void {
  fourChambers(d, 0, 0, 0, f);
}

function drawSubxiphoid(d: UsDraw, f: USCardiacFindings): void {
  const c = d.ctx;
  const k = d.pxPerCm;
  // liver wedge between probe and heart
  c.fillStyle = gray(0.42);
  c.beginPath();
  c.moveTo(d.apexX - 4.2 * k, d.apexY + 0.4 * k);
  c.quadraticCurveTo(d.apexX - 1 * k, d.apexY + 2.6 * k, d.apexX + 2.4 * k, d.apexY + 3.4 * k);
  c.lineTo(d.apexX + 4.6 * k, d.apexY + 0.4 * k);
  c.closePath();
  c.fill();
  fourChambers(d, 0.9, 1.6, -0.62, f);
}

// ================================================================ dispatch
export function drawView(d: UsDraw, view: UsViewId, f: USFindings): void {
  switch (view) {
    case 'plax':
      return drawPlax(d, f.kind === 'cardiac' ? f : DEFAULT_CARDIAC);
    case 'psax':
      return drawPsax(d, f.kind === 'cardiac' ? f : DEFAULT_CARDIAC);
    case 'a4c':
      return drawA4c(d, f.kind === 'cardiac' ? f : DEFAULT_CARDIAC);
    case 'subxiphoid':
      return drawSubxiphoid(d, f.kind === 'cardiac' ? f : DEFAULT_CARDIAC);
    case 'ivc':
      return drawIvc(d, f.kind === 'ivc' ? f : DEFAULT_IVC);
    case 'lung_ant_l':
    case 'lung_ant_r':
      return drawLung(d, f.kind === 'lung' ? f : DEFAULT_LUNG, false);
    case 'lung_post_l':
    case 'lung_post_r':
      return drawLung(d, f.kind === 'lung' ? f : DEFAULT_LUNG, true);
    case 'ruq':
    case 'luq':
    case 'pelvis':
      return drawAbd(d, f.kind === 'abdominal' ? f : DEFAULT_ABD, view);
  }
}

const DEFAULT_CARDIAC: USCardiacFindings = {
  kind: 'cardiac',
  contractility: 0.6,
  lvScale: 1,
  rvScale: 1,
  effusion: 0,
};
const DEFAULT_IVC: USIvcFindings = { kind: 'ivc', diameterCm: 1.8, collapse: 0.3 };
const DEFAULT_LUNG: USLungFindings = { kind: 'lung', sliding: true, bLines: 0, effusion: 0 };
const DEFAULT_ABD: USAbdFindings = { kind: 'abdominal', freeFluid: 0 };

/** Sensible per-view defaults when the patient has no findings for a view. */
export function defaultFindingsFor(view: UsViewId): USFindings {
  switch (view) {
    case 'plax':
    case 'psax':
    case 'a4c':
    case 'subxiphoid':
      return DEFAULT_CARDIAC;
    case 'ivc':
      return DEFAULT_IVC;
    case 'lung_ant_l':
    case 'lung_ant_r':
    case 'lung_post_l':
    case 'lung_post_r':
      return DEFAULT_LUNG;
    case 'ruq':
    case 'luq':
    case 'pelvis':
      return DEFAULT_ABD;
  }
}
