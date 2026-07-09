/**
 * Hospital bed: frame, mattress with raised head section (~25°), side
 * rails, head/footboard, casters. The patient rig lies on top of this.
 */
import * as THREE from 'three';
import type { WorldCtx } from '../types';
import { BED, PATIENT } from '../layout';
import { mergedBoxes } from '../lib';

export function buildBed(ctx: WorldCtx): void {
  const { scene } = ctx;
  const cx = BED.center.x;
  const headZ = BED.headZ;
  const footZ = headZ + BED.length;

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x494f58, roughness: 0.45, metalness: 0.5 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0x8b929c, roughness: 0.3, metalness: 0.85 });
  const mattressMat = new THREE.MeshStandardMaterial({ color: 0xb9c0cc, roughness: 0.85 });

  // under-frame + deck
  const frame = new THREE.Mesh(
    mergedBoxes([
      { size: [0.82, 0.24, 1.75], pos: [cx, 0.34, headZ + BED.length / 2] },
      { size: [BED.width, 0.05, BED.length], pos: [cx, BED.deckY - 0.025, headZ + BED.length / 2] },
    ]),
    frameMat,
  );
  frame.castShadow = true;
  scene.add(frame);

  // casters
  const casterGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.05, 12);
  casterGeo.rotateZ(Math.PI / 2);
  const casterMat = new THREE.MeshStandardMaterial({ color: 0x1e2126, roughness: 0.55 });
  for (const [dx, dz] of [
    [-0.36, 0.2],
    [0.36, 0.2],
    [-0.36, BED.length - 0.2],
    [0.36, BED.length - 0.2],
  ]) {
    const c = new THREE.Mesh(casterGeo, casterMat);
    c.position.set(cx + dx, 0.075, headZ + dz);
    scene.add(c);
  }

  // mattress: flat lower section + raised head section hinged at the split
  const hingeZ = headZ + 0.88;
  const flat = new THREE.Mesh(
    new THREE.BoxGeometry(BED.width - 0.06, 0.16, footZ - hingeZ - 0.03),
    mattressMat,
  );
  flat.position.set(cx, BED.deckY + 0.08, (hingeZ + footZ) / 2);
  flat.receiveShadow = true;
  flat.castShadow = true;
  scene.add(flat);

  const headSection = new THREE.Group();
  headSection.position.set(cx, BED.deckY + 0.08, hingeZ);
  headSection.rotation.x = PATIENT.inclineRad; // lifts the head (-z) end
  const headPad = new THREE.Mesh(new THREE.BoxGeometry(BED.width - 0.06, 0.16, 0.88), mattressMat);
  headPad.position.z = -0.44;
  headPad.castShadow = true;
  headSection.add(headPad);
  // pillow
  const pillow = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.09, 0.34),
    new THREE.MeshStandardMaterial({ color: 0xd8dde6, roughness: 0.95 }),
  );
  pillow.position.set(0, 0.125, -0.68);
  pillow.rotation.x = -0.06;
  headSection.add(pillow);
  scene.add(headSection);

  // side rails (merged tubes-as-boxes per side)
  for (const side of [-1, 1]) {
    const x = cx + side * (BED.width / 2 + 0.015);
    const rail = new THREE.Mesh(
      mergedBoxes([
        { size: [0.03, 0.035, 0.85], pos: [x, 1.06, headZ + 0.95] },
        { size: [0.03, 0.035, 0.85], pos: [x, 0.92, headZ + 0.95] },
        { size: [0.03, 0.2, 0.035], pos: [x, 0.99, headZ + 0.56] },
        { size: [0.03, 0.2, 0.035], pos: [x, 0.99, headZ + 1.34] },
        { size: [0.03, 0.34, 0.035], pos: [x, 0.82, headZ + 0.66] },
        { size: [0.03, 0.34, 0.035], pos: [x, 0.82, headZ + 1.24] },
      ]),
      chromeMat,
    );
    rail.castShadow = true;
    scene.add(rail);
  }

  // headboard + footboard
  const headboard = new THREE.Mesh(
    new THREE.BoxGeometry(BED.width - 0.02, 0.4, 0.045),
    new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.5 }),
  );
  headboard.position.set(cx, 0.88, headZ - 0.05);
  const footboard = headboard.clone();
  footboard.scale.y = 1.1;
  footboard.position.set(cx, 0.82, footZ + 0.05);
  scene.add(headboard, footboard);
}
