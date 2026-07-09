/**
 * Nurse NPC visual rig (SPEC §11.1) — the engine owns her brain; the world
 * reads hubStore.nurse each frame, walks her between named stations with a
 * subtle bob, and shows a canvas-sprite speech bubble while she talks.
 */
import * as THREE from 'three';
import type { WorldCtx, Updater } from '../types';
import { hubStore } from '../../bridge/store';
import { NURSE_STATIONS } from '../layout';
import { canvasTexture, makeCanvas } from '../lib';

const WALK_SPEED = 1.2;

function angleDelta(target: number, from: number): number {
  return ((target - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

function buildRig(): THREE.Group {
  const g = new THREE.Group();
  const scrubs = new THREE.MeshStandardMaterial({ color: 0x4e8c85, roughness: 0.85 });
  const scrubsDark = new THREE.MeshStandardMaterial({ color: 0x38665f, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc99a76, roughness: 0.6 });

  const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.5, 4, 10), scrubsDark);
  legs.position.y = 0.5;
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.155, 0.42, 4, 12), scrubs);
  torso.position.y = 1.06;
  torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.088, 14, 12), skin);
  head.position.y = 1.5;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshStandardMaterial({ color: 0x2e2a26, roughness: 0.95 }));
  cap.scale.set(1, 0.75, 1);
  cap.position.set(0, 1.545, -0.012);
  const badge = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 0.06, 0.006),
    new THREE.MeshStandardMaterial({ color: 0xe8e6df, roughness: 0.8 }),
  );
  badge.position.set(0.09, 1.18, 0.135);
  g.add(legs, torso, head, cap, badge);

  const armGeo = new THREE.CapsuleGeometry(0.038, 0.36, 4, 8);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(armGeo, scrubs);
    arm.position.set(side * 0.21, 1.05, 0);
    arm.rotation.z = side * -0.12;
    g.add(arm);
  }
  return g;
}

export function createNurse(ctx: WorldCtx): Updater {
  const rig = buildRig();
  const home = NURSE_STATIONS.station;
  rig.position.copy(home.pos);
  rig.rotation.y = home.yaw;
  ctx.scene.add(rig);

  // speech bubble sprite (repainted only when the text changes)
  const { canvas, ctx: c2d } = makeCanvas(512, 160);
  const bubbleTex = canvasTexture(canvas);
  const bubble = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: bubbleTex, transparent: true, depthTest: false }),
  );
  bubble.scale.set(1.15, 0.36, 1);
  bubble.position.y = 1.92;
  bubble.visible = false;
  rig.add(bubble);
  let lastSay = '';

  const paintBubble = (text: string): void => {
    if (!c2d) return;
    c2d.clearRect(0, 0, 512, 160);
    c2d.fillStyle = 'rgba(14,18,26,0.92)';
    c2d.strokeStyle = 'rgba(127,168,208,0.9)';
    c2d.lineWidth = 3;
    const r = 18;
    c2d.beginPath();
    c2d.roundRect(8, 8, 496, 116, r);
    c2d.fill();
    c2d.stroke();
    c2d.beginPath(); // tail
    c2d.moveTo(236, 122);
    c2d.lineTo(256, 152);
    c2d.lineTo(276, 122);
    c2d.closePath();
    c2d.fill();
    c2d.fillStyle = '#e8eef6';
    c2d.font = '500 30px system-ui, sans-serif';
    c2d.textAlign = 'center';
    c2d.textBaseline = 'middle';
    // wrap to at most 2 lines
    const words = text.split(' ');
    let line1 = '';
    let line2 = '';
    for (const word of words) {
      const probe = line1 ? `${line1} ${word}` : word;
      if (c2d.measureText(probe).width < 460 && !line2) line1 = probe;
      else line2 = line2 ? `${line2} ${word}` : word;
    }
    if (c2d.measureText(line2).width > 460) {
      while (line2.length > 3 && c2d.measureText(`${line2}...`).width > 460) {
        line2 = line2.slice(0, -1);
      }
      line2 += '...';
    }
    if (line2) {
      c2d.fillText(line1, 256, 46);
      c2d.fillText(line2, 256, 88);
    } else {
      c2d.fillText(line1, 256, 66);
    }
    bubbleTex.needsUpdate = true;
  };

  let bobPhase = 0;
  return (dt) => {
    const nurse = hubStore.getState().nurse;
    const target = NURSE_STATIONS[nurse.target] ?? home;

    const dx = target.pos.x - rig.position.x;
    const dz = target.pos.z - rig.position.z;
    const dist = Math.hypot(dx, dz);
    let targetYaw = target.yaw;
    if (dist > 0.05) {
      const step = Math.min(dist, WALK_SPEED * dt);
      rig.position.x += (dx / dist) * step;
      rig.position.z += (dz / dist) * step;
      targetYaw = Math.atan2(dx, dz); // face movement direction
      bobPhase += dt * 7.5;
      rig.position.y = Math.abs(Math.sin(bobPhase)) * 0.028;
      rig.rotation.z = Math.sin(bobPhase) * 0.02;
    } else {
      rig.position.y *= Math.max(0, 1 - dt * 6);
      rig.rotation.z = Math.sin(ctx.clock.t * 1.1) * 0.012; // idle sway
    }
    rig.rotation.y += angleDelta(targetYaw, rig.rotation.y) * Math.min(1, dt * 7);

    const talking = !!nurse.say && Date.now() < nurse.sayUntilReal;
    if (talking && nurse.say !== lastSay) {
      lastSay = nurse.say as string;
      paintBubble(lastSay);
    }
    if (!talking) lastSay = '';
    if (bubble.visible !== talking) bubble.visible = talking;
  };
}
