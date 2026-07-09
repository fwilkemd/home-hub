/**
 * Screen rig — the emissive canvas-texture surfaces plus the point lights
 * that make each device visibly light the room (SPEC §6.5). Before a canvas
 * is attached, screens show dim dark glass — never a pure-black hole.
 */
import * as THREE from 'three';
import type { DeviceId } from '../../contracts/ids';
import type { DevicePlacement } from '../../contracts/runtime';
import { SCREENS, orientScreen, screenNormal } from '../layout';

/** Per-device glow color — matched by the point light and idle glass tint. */
const SCREEN_LIGHT: Record<DeviceId, { color: number; intensity: number }> = {
  monitor: { color: 0x4fe0a8, intensity: 1.2 },
  vent: { color: 0x54b8e8, intensity: 0.85 },
  pump: { color: 0xf0cd90, intensity: 0.55 },
  us_machine: { color: 0x9db6cc, intensity: 0.8 },
  workstation: { color: 0x6f95c8, intensity: 0.6 },
};

interface ScreenEntry {
  device: DeviceId;
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  light: THREE.PointLight;
  baseIntensity: number;
  phase: number;
  texture: THREE.CanvasTexture | null;
}

export class ScreenRig {
  private entries = new Map<DeviceId, ScreenEntry>();

  /**
   * Build the screen surface for a device, oriented from layout, and its
   * color-matched point light. Returned mesh is already positioned in WORLD
   * space — add it to the scene (not to a transformed parent).
   */
  createScreen(scene: THREE.Scene, device: DeviceId, opts: { staticTexture?: THREE.Texture } = {}): THREE.Mesh {
    const spec = SCREENS[device];
    const material = new THREE.MeshStandardMaterial({
      color: 0x05070a,
      roughness: 0.35,
      metalness: 0.15,
      emissive: 0x101820,
      emissiveIntensity: 0.55,
    });
    if (opts.staticTexture) {
      material.emissiveMap = opts.staticTexture;
      material.emissive = new THREE.Color(0xffffff);
      material.emissiveIntensity = 0.5;
    }
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(spec.w, spec.h), material);
    orientScreen(mesh, spec);
    scene.add(mesh);

    const cfg = SCREEN_LIGHT[device];
    const light = new THREE.PointLight(cfg.color, cfg.intensity, 2.4, 2);
    light.position.copy(spec.pos).addScaledVector(screenNormal(spec), 0.28);
    scene.add(light);

    this.entries.set(device, {
      device,
      mesh,
      material,
      light,
      baseIntensity: cfg.intensity,
      phase: this.entries.size * 1.7,
      texture: null,
    });
    return mesh;
  }

  /** Bind an offscreen canvas as the emissive map so the screen glows. */
  attach(device: DeviceId, canvas: HTMLCanvasElement): void {
    const e = this.entries.get(device);
    if (!e) return;
    e.texture?.dispose();
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    e.texture = tex;
    e.material.emissiveMap = tex;
    e.material.emissive = new THREE.Color(0xffffff);
    e.material.emissiveIntensity = 1.0;
    e.material.color = new THREE.Color(0x020304);
    e.material.needsUpdate = true;
  }

  /** Per-frame: re-upload live canvases + slow deterministic light flicker. */
  update(t: number): void {
    for (const e of this.entries.values()) {
      if (e.texture) e.texture.needsUpdate = true;
      const f = 0.93 + 0.05 * Math.sin(t * 1.3 + e.phase) + 0.03 * Math.sin(t * 2.9 + e.phase * 1.6);
      e.light.intensity = e.baseIntensity * f;
    }
  }

  placements(): DevicePlacement[] {
    return (Object.keys(SCREENS) as DeviceId[]).map((device) => ({
      device,
      position: [SCREENS[device].pos.x, SCREENS[device].pos.y, SCREENS[device].pos.z],
    }));
  }

  dispose(): void {
    for (const e of this.entries.values()) e.texture?.dispose();
    this.entries.clear();
  }
}
