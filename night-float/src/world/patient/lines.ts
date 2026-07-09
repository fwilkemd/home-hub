/**
 * Visible lines/tubes per PatientState.lines (SPEC §6.2): PIV, CVC dressing,
 * arterial line, ETT, foley. Groups are prebuilt and toggled by an updater
 * that checks the live patient every frame.
 */
import * as THREE from 'three';
import type { LineType } from '../../contracts/ids';
import type { WorldCtx, Updater } from '../types';
import { IV_POLE, PATIENT } from '../layout';

const tubeMat = (): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color: 0xd6dade, roughness: 0.5, transparent: true, opacity: 0.9 });
const tapeMat = (): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color: 0xe6e2d8, roughness: 0.95 });

function curveTube(points: THREE.Vector3[], r: number, mat: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, r, 6), mat);
}

/**
 * @param upper inclined torso group — used to convert body-local anchor
 * points to world space once (the patient never moves).
 */
export function buildLines(ctx: WorldCtx, upper: THREE.Group, lower: THREE.Group): Updater {
  upper.updateMatrixWorld(true);
  lower.updateMatrixWorld(true);
  const w = (g: THREE.Group, x: number, y: number, z: number): THREE.Vector3 =>
    g.localToWorld(new THREE.Vector3(x, y, z));

  const groups = new Map<LineType, THREE.Group>();
  const make = (type: LineType): THREE.Group => {
    const g = new THREE.Group();
    g.visible = false;
    ctx.scene.add(g);
    groups.set(type, g);
    return g;
  };

  // ---- PIV: hub + tape on L forearm, thin line up to the pump stack
  {
    const g = make('piv');
    const site = w(upper, 0.27, 0.14, -0.2);
    const hub = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, 0.015, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x7fa8c8, roughness: 0.4 }),
    );
    hub.position.copy(site);
    const tape = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.008, 0.06), tapeMat());
    tape.position.copy(site).add(new THREE.Vector3(0, -0.002, 0));
    g.add(hub, tape);
    g.add(
      curveTube(
        [
          site.clone().add(new THREE.Vector3(0.02, 0.01, 0)),
          new THREE.Vector3(1.45, 1.05, -1.5),
          new THREE.Vector3(IV_POLE.pos.x, 1.32, IV_POLE.pos.z + 0.12),
        ],
        0.004,
        tubeMat(),
      ),
    );
  }

  // ---- CVC: dressing patch on R neck
  {
    const g = make('cvc');
    const site = w(upper, -0.07, 0.11, -0.6);
    const dressing = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.01, 0.075), tapeMat());
    dressing.position.copy(site);
    dressing.rotation.set(PATIENT.inclineRad, 0, -0.5); // drape over the neck side
    const stub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.04, 6),
      new THREE.MeshStandardMaterial({ color: 0x3e6ea8, roughness: 0.4 }),
    );
    stub.position.copy(site).add(new THREE.Vector3(-0.03, 0.01, 0.02));
    stub.rotation.z = 1.1;
    g.add(dressing, stub);
  }

  // ---- A-line: wrist board + hub on L wrist, short line toward the rail
  {
    const g = make('aline');
    const wrist = w(upper, 0.28, 0.09, -0.06);
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.012, 0.16), tapeMat());
    board.position.copy(wrist).add(new THREE.Vector3(0.01, -0.03, 0));
    board.rotation.x = PATIENT.inclineRad;
    const hub = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.012, 0.03),
      new THREE.MeshStandardMaterial({ color: 0xc84a4a, roughness: 0.4 }),
    );
    hub.position.copy(wrist);
    g.add(board, hub);
    g.add(
      curveTube(
        [wrist.clone(), new THREE.Vector3(1.42, 0.95, -1.25), new THREE.Vector3(1.42, 0.78, -1.45)],
        0.0035,
        tubeMat(),
      ),
    );
  }

  // ---- ETT: tube from the mouth + tape; meets the vent circuit end
  {
    const g = make('ett');
    const mouth = PATIENT.mouthWorld;
    g.add(
      curveTube(
        [
          mouth.clone().add(new THREE.Vector3(0.015, -0.03, 0.01)),
          mouth.clone(),
          mouth.clone().add(new THREE.Vector3(-0.05, 0.025, 0)),
        ],
        0.009,
        new THREE.MeshStandardMaterial({ color: 0xcfd4d9, roughness: 0.35 }),
      ),
    );
    const connector = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.03, 8),
      new THREE.MeshStandardMaterial({ color: 0x6fa8d8, roughness: 0.4 }),
    );
    connector.position.copy(mouth).add(new THREE.Vector3(-0.06, 0.025, 0));
    connector.rotation.z = Math.PI / 2;
    const tape = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.012, 0.025), tapeMat());
    tape.position.copy(mouth).add(new THREE.Vector3(0, -0.005, 0.015));
    tape.rotation.x = PATIENT.inclineRad;
    g.add(connector, tape);
  }

  // ---- Foley: tube from under the blanket to a bag on the bed frame
  {
    const g = make('foley');
    const start = w(lower, 0.06, 0.09, 0.5);
    const bagPos = new THREE.Vector3(1.44, 0.48, -0.95);
    g.add(
      curveTube(
        [start, new THREE.Vector3(1.2, 0.72, -0.85), bagPos.clone().add(new THREE.Vector3(0, 0.12, 0))],
        0.005,
        new THREE.MeshStandardMaterial({ color: 0xd8c66a, roughness: 0.4, transparent: true, opacity: 0.85 }),
      ),
    );
    const bag = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.18, 0.04),
      new THREE.MeshStandardMaterial({ color: 0xc9b34a, roughness: 0.35, transparent: true, opacity: 0.75 }),
    );
    bag.position.copy(bagPos);
    const hook = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.012, 0.012),
      new THREE.MeshStandardMaterial({ color: 0x8b929c, metalness: 0.7, roughness: 0.35 }),
    );
    hook.position.copy(bagPos).add(new THREE.Vector3(0, 0.1, 0));
    g.add(bag, hook);
  }

  return () => {
    const lines = ctx.deps.getPatient()?.lines;
    if (!lines) return;
    for (const [type, g] of groups) {
      const on = lines.some((l) => l.type === type);
      if (g.visible !== on) g.visible = on;
    }
  };
}
