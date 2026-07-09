/**
 * Headless smoke for the world module: constructs the full scene with a
 * minimal DOM shim (no WebGL — renderer is only created at mount), runs
 * frames, exercises teleport/debugcam/hover/probe, and disposes cleanly.
 */
import { beforeAll, afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { ContextAction, HoverInfo, WorldDeps } from '../contracts/runtime';
import type { PatientState } from '../contracts/patient';
import { patientStateSchema, PHYSIOLOGY_DEFAULTS } from '../contracts/patient';
import { hubActions, hubStore } from '../bridge/store';
import { createWorld } from './index';
import { buildPatient } from './patient';
import { createProbe } from './interact/probe';
import { InteractableRegistry } from './interact/interactables';
import { ScreenRig } from './devices/screens';
import type { WorldCtx } from './types';

// ---------------------------------------------------------------- DOM shim
beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  if (typeof document === 'undefined') {
    g.document = {
      createElement: () => ({
        width: 0,
        height: 0,
        style: {},
        getContext: () => null,
      }),
      addEventListener: () => {},
      removeEventListener: () => {},
      pointerLockElement: null,
    };
  }
  if (typeof window === 'undefined') {
    g.window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      devicePixelRatio: 1,
    };
  }
});

afterEach(() => {
  hubActions.reset();
});

function makePatient(): PatientState {
  return patientStateSchema.parse({
    id: 'p1',
    demographics: { name: 'Test Patient', age: 60, sex: 'M', weightKg: 80 },
    vitals: { hr: 80, rhythm: 'sinus', spo2: 97, rr: 16, map: 75, sbp: 110, dbp: 60, tempC: 37 },
    physiology: { ...PHYSIOLOGY_DEFAULTS },
    devices: { monitor: {}, vent: {}, pumps: [] },
  });
}

function makeDeps(overrides: Partial<WorldDeps> = {}): WorldDeps & {
  hovers: (HoverInfo | null)[];
  actions: ContextAction[];
} {
  const hovers: (HoverInfo | null)[] = [];
  const actions: ContextAction[] = [];
  const patient = makePatient();
  return {
    hovers,
    actions,
    getPatient: () => patient,
    getWaveforms: () => null,
    getBreathPhase: () => 0.2,
    getSimTime: () => 0,
    onHover: (h) => hovers.push(h),
    onAction: (a) => actions.push(a),
    onPointerLock: () => {},
    ...overrides,
  };
}

describe('createWorld', () => {
  it('constructs, updates, teleports and disposes without a renderer', () => {
    const deps = makeDeps();
    const world = createWorld(deps);
    for (let i = 0; i < 5; i++) world.update(0.016);

    const placements = world.getDevicePlacements();
    expect(placements.map((p) => p.device).sort()).toEqual(
      ['monitor', 'pump', 'us_machine', 'vent', 'workstation'].sort(),
    );

    world.setDebugCam(true);
    for (const v of ['bedside', 'monitor', 'vent', 'ultrasound', 'wide'] as const) {
      world.teleport(v);
      world.update(0.016);
    }
    const pose = world.getListenerPose();
    expect(pose.position.every((n) => Number.isFinite(n))).toBe(true);
    expect(pose.forward.every((n) => Number.isFinite(n))).toBe(true);

    world.dispose();
  });

  it('hovers the monitor with its context actions when aimed at it', () => {
    const deps = makeDeps();
    const world = createWorld(deps);
    world.setDebugCam(true);
    world.teleport('monitor');
    hubActions.setPointerLocked(true); // hover runs while locked
    world.update(0.016);

    const last = deps.hovers[deps.hovers.length - 1];
    expect(last?.targetId).toBe('monitor');
    expect(last?.actions.map((a) => a.id)).toEqual(['zoom', 'silence', 'nibp']);
    world.dispose();
  });
});

describe('performance budget', () => {
  it('stays under the ~300 draw call target (SPEC §14)', async () => {
    const deps = makeDeps();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.05, 30);
    scene.add(camera);
    const ctx: WorldCtx = {
      scene,
      camera,
      deps,
      reg: new InteractableRegistry(),
      screens: new ScreenRig(),
      clock: { t: 0 },
    };
    const [structure, lighting, headwall, bed, furniture, monitor, vent, ivpole, us] =
      await Promise.all([
        import('./room/structure'),
        import('./room/lighting'),
        import('./room/headwall'),
        import('./room/bed'),
        import('./room/furniture'),
        import('./devices/monitor'),
        import('./devices/vent'),
        import('./devices/ivpole'),
        import('./devices/ultrasound'),
      ]);
    structure.buildStructure(ctx);
    lighting.buildLighting(ctx);
    headwall.buildHeadwall(ctx);
    bed.buildBed(ctx);
    furniture.buildFurniture(ctx);
    monitor.buildMonitor(ctx);
    vent.buildVent(ctx);
    ivpole.buildIvPole(ctx);
    us.buildUltrasound(ctx);
    buildPatient(ctx);
    const { createNurse } = await import('./npc/nurse');
    createNurse(ctx);

    let drawables = 0;
    scene.traverse((o) => {
      if (((o as THREE.Mesh).isMesh || (o as THREE.Sprite).isSprite) && o.visible) drawables++;
    });
    expect(drawables).toBeGreaterThan(50); // sanity: the room actually built
    expect(drawables).toBeLessThan(300);
  });
});

describe('probe snapping', () => {
  it('dispatches UsSetView for the nearest anchor and clears when far', () => {
    const deps = makeDeps();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.05, 30);
    scene.add(camera);
    const ctx: WorldCtx = {
      scene,
      camera,
      deps,
      reg: new InteractableRegistry(),
      screens: new ScreenRig(),
      clock: { t: 0 },
    };
    const rig = buildPatient(ctx);
    const probe = createProbe(ctx, rig);

    hubStore.setState({ heldTool: 'us_probe' });
    const plax = rig.usAnchors.get('plax')!;
    const target = plax.getWorldPosition(new THREE.Vector3());
    camera.position.copy(target).add(new THREE.Vector3(-0.4, 0.75, 0.3));
    camera.lookAt(target);
    camera.updateMatrixWorld();

    probe(0.2);
    const setViews = deps.actions.filter((a) => a.command?.type === 'UsSetView');
    expect(setViews.length).toBe(1);
    const cmd = setViews[0].command;
    expect(cmd && cmd.type === 'UsSetView' && cmd.view).toBe('plax');
    expect(hubStore.getState().us.quality).toBeGreaterThan(0.9);

    // step away -> view cleared exactly once
    camera.position.set(2.5, 1.6, 2.4);
    camera.updateMatrixWorld();
    probe(0.2);
    probe(0.2);
    const cleared = deps.actions.filter(
      (a) => a.command?.type === 'UsSetView' && a.command.view === null,
    );
    expect(cleared.length).toBe(1);
  });
});
