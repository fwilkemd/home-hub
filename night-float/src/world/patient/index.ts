/**
 * Stylized low-poly patient (SPEC §6.2): supine, head-up ~25°, chest rise
 * from the live breath phase, sedation-driven eyelids with a deterministic
 * blink, perfusion/SpO2 skin tint, per-line tube visuals, idle micro-motion.
 * Deliberately NOT uncanny — primitives only.
 */
import * as THREE from 'three';
import type { UsViewId } from '../../contracts/ids';
import type { WorldCtx, Updater } from '../types';
import { PATIENT } from '../layout';
import { clamp, paintBlanket, smoothstep } from '../lib';
import { buildLines } from './lines';
import { buildUsAnchors, buildZones } from './zones';

export interface PatientRig {
  update: Updater;
  usAnchors: Map<UsViewId, THREE.Object3D>;
  /** world-space torso reference for probe proximity checks */
  center: THREE.Vector3;
}

const SKIN_BASE = new THREE.Color(0xd9a184);
const SKIN_PALE = new THREE.Color(0xccc0b2);
const LIP_BASE = new THREE.Color(0xb06a5e);
const LIP_CYAN = new THREE.Color(0x7b6d84);
const BLINK_PATTERN = [3.4, 4.3, 2.9, 5.1]; // seconds between blinks (deterministic)
const BLINK_LEN = 0.14;

export function buildPatient(ctx: WorldCtx): PatientRig {
  const root = new THREE.Group();
  root.position.copy(PATIENT.hip);
  ctx.scene.add(root);

  const upper = new THREE.Group();
  upper.rotation.x = PATIENT.inclineRad; // lifts the head (-z) end
  const lower = new THREE.Group();
  root.add(upper, lower);

  const skinMat = new THREE.MeshStandardMaterial({ color: SKIN_BASE.clone(), roughness: 0.65 });
  const gownMat = new THREE.MeshStandardMaterial({ color: 0x9fb0c0, roughness: 0.92 });
  const lipMat = new THREE.MeshStandardMaterial({ color: LIP_BASE.clone(), roughness: 0.6 });

  // ---- torso (gown) — origin at the back so breath scales upward only
  const chestGeo = new THREE.CapsuleGeometry(0.185, 0.34, 5, 12);
  chestGeo.rotateX(Math.PI / 2);
  chestGeo.translate(0, 0.185, -0.38);
  const chest = new THREE.Mesh(chestGeo, gownMat);
  const CHEST_FLAT = 0.6;
  chest.scale.y = CHEST_FLAT;
  chest.castShadow = true;
  upper.add(chest);

  const abdGeo = new THREE.CapsuleGeometry(0.165, 0.18, 5, 12);
  abdGeo.rotateX(Math.PI / 2);
  abdGeo.translate(0, 0.165, -0.12);
  const abdomen = new THREE.Mesh(abdGeo, gownMat);
  const ABD_FLAT = 0.58;
  abdomen.scale.y = ABD_FLAT;
  upper.add(abdomen);

  // ---- head group (skull, hair, nose, lips, eyes)
  const head = new THREE.Group();
  head.position.set(0, 0.1, -0.72);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.105, 18, 14), skinMat);
  skull.scale.set(0.92, 0.82, 1.05);
  skull.castShadow = true;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.104, 14, 10), new THREE.MeshStandardMaterial({ color: 0x3a332c, roughness: 0.95 }));
  hair.scale.set(0.95, 0.8, 1.0);
  hair.position.set(0, -0.008, -0.03);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.03, 6), skinMat);
  nose.position.set(0, 0.085, 0.015);
  const lips = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.008, 0.016), lipMat);
  lips.position.set(0, 0.062, 0.052);
  head.add(skull, hair, nose, lips);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.058, 0.1, 10), skinMat);
  neck.rotation.x = Math.PI / 2 - 0.2;
  neck.position.set(0, 0.08, -0.61);
  upper.add(neck, head);

  // eyes: dark almonds; closing = scale.y toward a sliver
  const eyeGeo = new THREE.SphereGeometry(0.0145, 10, 8);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.35 });
  const eyes: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(side * 0.037, 0.088, -0.028);
    eye.scale.set(1.15, 0.5, 0.45);
    head.add(eye);
    eyes.push(eye);
  }

  // ---- arms (skin) with a slight outward angle; hands as rounded boxes
  const hands: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const armGroup = new THREE.Group();
    const upperArmGeo = new THREE.CapsuleGeometry(0.046, 0.24, 4, 8);
    upperArmGeo.rotateX(Math.PI / 2);
    const upperArm = new THREE.Mesh(upperArmGeo, skinMat);
    upperArm.position.set(side * 0.235, 0.09, -0.4);
    upperArm.rotation.y = side * -0.12;
    const foreGeo = new THREE.CapsuleGeometry(0.038, 0.22, 4, 8);
    foreGeo.rotateX(Math.PI / 2);
    const forearm = new THREE.Mesh(foreGeo, skinMat);
    forearm.position.set(side * 0.27, 0.08, -0.17);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.03, 0.1), skinMat);
    hand.position.set(side * 0.28, 0.08, -0.02);
    hand.rotation.y = side * 0.1;
    armGroup.add(upperArm, forearm, hand);
    armGroup.castShadow = true;
    upper.add(armGroup);
    hands.push(hand);
  }

  // ---- lower body: legs hinted under a thin blanket
  const blanket = new THREE.Mesh(
    new THREE.BoxGeometry(0.88, 0.16, 1.1),
    new THREE.MeshStandardMaterial({ map: paintBlanket(), roughness: 0.95 }),
  );
  blanket.position.set(0, 0.06, 0.52);
  blanket.castShadow = true;
  const feet = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.16), blanket.material);
  feet.position.set(0, 0.16, 0.96);
  lower.add(blanket, feet);

  // ---- zones, anchors, lines
  buildZones(ctx, upper, lower);
  const usAnchors = buildUsAnchors(upper);
  root.updateMatrixWorld(true);
  const linesUpdate = buildLines(ctx, upper, lower);
  const center = upper.localToWorld(new THREE.Vector3(0, 0.15, -0.35));

  // ---- per-frame animation state
  let breathS = 0;
  let lid = 1; // 1 open .. 0 closed
  let blinkTimer = 0;
  let blinkIdx = 0;
  let tintK = -1;
  let cyanK = -1;

  const update: Updater = (dt) => {
    const t = ctx.clock.t;
    const patient = ctx.deps.getPatient();

    // chest rise from live breath phase; still when RR is 0
    const rr = patient?.vitals.rr ?? 0;
    let target = 0;
    if (rr > 0) {
      const p = clamp(ctx.deps.getBreathPhase(), 0, 1);
      target = p < 0.35 ? smoothstep(p / 0.35) : 1 - smoothstep((p - 0.35) / 0.65);
    }
    breathS += (target - breathS) * Math.min(1, dt * 10);
    chest.scale.y = CHEST_FLAT * (1 + 0.055 * breathS);
    abdomen.scale.y = ABD_FLAT * (1 + 0.035 * breathS);

    // eyelids: sedation closes; deterministic blink while awake
    const sedation = patient?.physiology.sedation ?? 0;
    const awake = sedation <= 0.35;
    let lidTarget = awake ? 1 : 0;
    if (awake) {
      blinkTimer += dt;
      const interval = BLINK_PATTERN[blinkIdx % BLINK_PATTERN.length];
      if (blinkTimer > interval + BLINK_LEN) {
        blinkTimer = 0;
        blinkIdx++;
      } else if (blinkTimer > interval) {
        lidTarget = 0;
      }
    }
    lid += (lidTarget - lid) * Math.min(1, dt * 16);
    const eyeScaleY = 0.08 + 0.42 * lid;
    for (const eye of eyes) eye.scale.y = eyeScaleY;

    // skin tint: pallor from perfusion, cyanotic lips from SpO2 (subtle)
    const perfusion = patient?.physiology.perfusion ?? 0.8;
    const k = clamp((0.4 - perfusion) / 0.4, 0, 1) * 0.85;
    if (Math.abs(k - tintK) > 0.01) {
      tintK = k;
      skinMat.color.copy(SKIN_BASE).lerp(SKIN_PALE, k);
    }
    const spo2 = patient?.vitals.spo2 ?? 98;
    const c = clamp((88 - spo2) / 12, 0, 1) * 0.8;
    if (Math.abs(c - cyanK) > 0.01) {
      cyanK = c;
      lipMat.color.copy(LIP_BASE).lerp(LIP_CYAN, c);
    }

    // micro-movements when lightly sedated (deterministic sines)
    if (sedation < 0.3) {
      head.rotation.y = Math.sin(t * 0.31) * 0.055;
      hands[1].rotation.z = Math.sin(t * 0.83 + 1.4) * 0.06;
      hands[0].rotation.z = Math.sin(t * 0.67 + 3.1) * 0.045;
    } else {
      head.rotation.y = 0;
      hands[0].rotation.z = 0;
      hands[1].rotation.z = 0;
    }

    linesUpdate(dt);
  };

  return { update, usAnchors, center };
}
