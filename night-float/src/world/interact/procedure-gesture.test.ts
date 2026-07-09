/**
 * E-hold gesture + sterile-field unit coverage (node, no DOM): a functional
 * window shim feeds key events; the store is primed with a live-style
 * ProcedureRuntime exactly as the bridge mirrors it (engine-mutated object).
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { defineProcedure } from '../../contracts/content';
import type { ContextAction, ProcedureRuntime } from '../../contracts/runtime';
import { hubActions, hubStore } from '../../bridge/store';
import { InteractableRegistry } from './interactables';
import { ScreenRig } from '../devices/screens';
import type { WorldCtx } from '../types';
import { createProcedureGesture } from './procedure-gesture';

type Handler = (e: unknown) => void;
const listeners = new Map<string, Set<Handler>>();
const fire = (type: string, e: Record<string, unknown> = {}): void => {
  for (const h of listeners.get(type) ?? []) h(e);
};

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  if (typeof window === 'undefined') {
    g.window = {
      addEventListener: (t: string, h: Handler) => {
        if (!listeners.has(t)) listeners.set(t, new Set());
        listeners.get(t)!.add(h);
      },
      removeEventListener: (t: string, h: Handler) => listeners.get(t)?.delete(h),
      devicePixelRatio: 1,
    };
  }
});

afterEach(() => {
  hubActions.reset();
});

const def = defineProcedure({
  id: 'testproc',
  name: 'Test procedure',
  todoMedical: 'test',
  requiredTool: 'cvl_kit',
  kitLabel: 'Test kit',
  siteOptions: ['R IJ'],
  positioningNote: 'n/a',
  sterile: true,
  steps: [
    { id: 'gown_glove', prompt: 'Gown and glove.', interaction: 'click_hold', holdS: 1 },
    { id: 'aim', prompt: 'Line it up.', interaction: 'align_hold', holdS: 2 },
    { id: 'finish', prompt: 'Done.', interaction: 'click' },
  ],
});

function makeRuntime(): ProcedureRuntime {
  return {
    procedureId: def.id,
    name: def.name,
    site: 'R IJ',
    sterile: true,
    contaminated: false,
    startedAt: 0,
    stepIndex: 0,
    steps: def.steps.map((s, i) => ({
      id: s.id,
      prompt: s.prompt,
      interaction: s.interaction,
      overlay: s.overlay,
      status: i === 0 ? ('active' as const) : ('pending' as const),
      skippable: s.skippable,
    })),
    definition: def,
  };
}

function makeCtx(actions: ContextAction[]): WorldCtx {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.05, 30);
  scene.add(camera);
  return {
    scene,
    camera,
    deps: {
      getPatient: () => null,
      getWaveforms: () => null,
      getBreathPhase: () => 0,
      getSimTime: () => 0,
      onHover: () => {},
      onAction: (a) => actions.push(a),
      onPointerLock: () => {},
    },
    reg: new InteractableRegistry(),
    screens: new ScreenRig(),
    clock: { t: 0 },
  };
}

describe('procedure E-hold gesture', () => {
  it('accumulates while E is held and advances the step at full hold', () => {
    const actions: ContextAction[] = [];
    const ctx = makeCtx(actions);
    const gesture = createProcedureGesture(ctx, ctx.camera.position.clone());
    const runtime = makeRuntime();
    hubStore.setState({ phase: 'running', procedure: runtime, pointerLocked: true });

    expect(gesture.capturesE()).toBe(true);
    fire('keydown', { code: 'KeyE', repeat: false });
    gesture.update(0.5);
    expect(hubStore.getState().procedureHold).toMatchObject({ stepId: 'gown_glove' });
    expect(hubStore.getState().procedureHold!.progress).toBeCloseTo(0.5, 2);

    gesture.update(0.6); // crosses 1.0
    expect(actions.map((a) => a.command?.type)).toContain('AdvanceProcedureStep');
    expect(hubStore.getState().procedureHold).toBeNull();

    // still held after completion: nothing accumulates until a fresh press
    runtime.steps[0].status = 'done';
    runtime.steps[1].status = 'active';
    runtime.stepIndex = 1;
    gesture.update(1.5);
    expect(hubStore.getState().procedureHold).toBeNull();
    gesture.dispose();
  });

  it('loses progress on release and gates align_hold on a patient-zone hover', () => {
    const actions: ContextAction[] = [];
    const ctx = makeCtx(actions);
    const gesture = createProcedureGesture(ctx, ctx.camera.position.clone());
    const runtime = makeRuntime();
    runtime.steps[0].status = 'done';
    runtime.steps[1].status = 'active';
    runtime.stepIndex = 1; // align_hold, 2 s
    hubStore.setState({ phase: 'running', procedure: runtime, pointerLocked: true });

    fire('keydown', { code: 'KeyE', repeat: false });
    gesture.update(1.0); // no zone hovered -> frozen at 0
    expect(hubStore.getState().procedureHold?.progress ?? 0).toBe(0);

    hubStore.setState({ hover: { targetId: 'zone_neck', label: 'Neck', actions: [] } });
    gesture.update(1.0);
    expect(hubStore.getState().procedureHold!.progress).toBeCloseTo(0.5, 2);

    fire('keyup', { code: 'KeyE' });
    gesture.update(0.1); // released early -> progress lost
    expect(hubStore.getState().procedureHold).toBeNull();

    fire('keydown', { code: 'KeyE', repeat: false });
    gesture.update(1.0);
    expect(hubStore.getState().procedureHold!.progress).toBeCloseTo(0.5, 2);
    expect(actions.every((a) => a.command?.type !== 'AdvanceProcedureStep')).toBe(true);
    gesture.dispose();
  });

  it('contaminates the sterile field once per non-patient target once gowned', () => {
    const actions: ContextAction[] = [];
    const ctx = makeCtx(actions);
    const gesture = createProcedureGesture(ctx, ctx.camera.position.clone());
    const runtime = makeRuntime();
    hubStore.setState({ phase: 'running', procedure: runtime });

    // field not up yet: touching things is fine
    gesture.noteWorldAction({ targetId: 'monitor', label: 'Patient monitor', actions: [] });
    expect(actions).toHaveLength(0);

    runtime.steps[0].status = 'done';
    runtime.stepIndex = 1;
    runtime.steps[1].status = 'active';
    gesture.noteWorldAction({ targetId: 'zone_neck', label: 'Neck', actions: [] });
    expect(actions).toHaveLength(0); // the patient is the field

    gesture.noteWorldAction({ targetId: 'monitor', label: 'Patient monitor', actions: [] });
    gesture.noteWorldAction({ targetId: 'monitor', label: 'Patient monitor', actions: [] });
    const contaminations = actions.filter((a) => a.command?.type === 'ContaminateSterileField');
    expect(contaminations).toHaveLength(1);
    expect(contaminations[0].command).toMatchObject({ what: 'Patient monitor' });
    gesture.dispose();
  });
});
