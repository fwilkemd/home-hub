/**
 * World entry (Phase 1A): builds the ICU room, patient, devices, nurse,
 * player and interaction systems, and implements WorldHandle. The session
 * calls update(realDtS) every frame — the world never schedules its own
 * requestAnimationFrame.
 */
import * as THREE from 'three';
import type { DeviceId, ViewpointId } from '../contracts/ids';
import type { WorldDeps, WorldHandle, DevicePlacement } from '../contracts/runtime';
import { hubStore } from '../bridge/store';
import type { Updater, WorldCtx } from './types';
import { disposeObject3D } from './lib';
import { InteractableRegistry } from './interact/interactables';
import { ScreenRig } from './devices/screens';
import { buildStructure } from './room/structure';
import { buildLighting, MOOD } from './room/lighting';
import { buildHeadwall } from './room/headwall';
import { buildBed } from './room/bed';
import { buildFurniture } from './room/furniture';
import { buildMonitor } from './devices/monitor';
import { buildVent } from './devices/vent';
import { buildIvPole } from './devices/ivpole';
import { buildUltrasound } from './devices/ultrasound';
import { buildPatient } from './patient';
import { createNurse } from './npc/nurse';
import { createPlayer } from './player/controller';
import { createHover } from './interact/hover';
import { createHeldTool } from './interact/held-tool';
import { createProbe } from './interact/probe';

export function createWorld(deps: WorldDeps): WorldHandle {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060a);
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

  // ---- build (order matters: patient registers zones before probe reads them)
  buildStructure(ctx);
  buildLighting(ctx);
  buildHeadwall(ctx);
  buildBed(ctx);
  buildMonitor(ctx);
  const updaters: Updater[] = [];
  updaters.push(buildVent(ctx));
  buildIvPole(ctx);
  updaters.push(buildUltrasound(ctx));
  updaters.push(buildFurniture(ctx));
  const patient = buildPatient(ctx);
  updaters.push(patient.update);
  updaters.push(createNurse(ctx));

  const hover = createHover(ctx);
  const player = createPlayer(ctx, (i) => {
    const action = hover.actionAt(i);
    if (action) deps.onAction(action);
  });
  updaters.push(createHeldTool(ctx));
  updaters.push(createProbe(ctx, patient));

  // ---- renderer lifecycle (created at mount so construction is DOM-safe)
  let renderer: THREE.WebGLRenderer | null = null;
  let container: HTMLElement | null = null;
  let resizeObserver: ResizeObserver | null = null;
  const onWindowResize = (): void => handle.resize();

  const handle: WorldHandle = {
    mount(el: HTMLElement): void {
      container = el;
      if (!renderer) {
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = MOOD.exposure;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.domElement.style.display = 'block';
        player.bind(renderer.domElement);
      }
      el.appendChild(renderer.domElement);
      handle.resize();
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver?.disconnect();
        resizeObserver = new ResizeObserver(() => handle.resize());
        resizeObserver.observe(el);
      }
      window.addEventListener('resize', onWindowResize);
      // SPEC §6.3 — ?debugcam boots straight into the free-fly camera
      if (typeof location !== 'undefined' && /[?&]debugcam/.test(location.search)) {
        player.setDebugCam(true);
      }
    },

    attachScreen(device: DeviceId, canvas: HTMLCanvasElement): void {
      ctx.screens.attach(device, canvas);
    },

    update(realDtS: number): void {
      const dt = Math.min(Math.max(realDtS, 0), 0.1);
      ctx.clock.t += dt;
      player.update(dt);
      if (hubStore.getState().pointerLocked) hover.update(dt);
      else hover.clear();
      for (const u of updaters) u(dt);
      ctx.screens.update(ctx.clock.t);
      if (renderer) renderer.render(scene, camera);
    },

    resize(): void {
      if (!renderer || !container) return;
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    },

    dispose(): void {
      player.dispose();
      hover.clear();
      resizeObserver?.disconnect();
      resizeObserver = null;
      window.removeEventListener('resize', onWindowResize);
      ctx.screens.dispose();
      ctx.reg.clear();
      disposeObject3D(scene);
      scene.clear();
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
        renderer = null;
      }
      container = null;
    },

    teleport(viewpoint: ViewpointId): void {
      player.teleport(viewpoint);
    },

    setDebugCam(on: boolean): void {
      player.setDebugCam(on);
    },

    requestPointerLock(): void {
      player.requestPointerLock();
    },

    exitPointerLock(): void {
      player.exitPointerLock();
    },

    getDevicePlacements(): DevicePlacement[] {
      return ctx.screens.placements();
    },

    getListenerPose(): { position: [number, number, number]; forward: [number, number, number] } {
      const p = camera.getWorldPosition(new THREE.Vector3());
      const f = camera.getWorldDirection(new THREE.Vector3());
      return { position: [p.x, p.y, p.z], forward: [f.x, f.y, f.z] };
    },
  };

  return handle;
}
