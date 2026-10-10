import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import { ASSET } from '../world/textures.js'

export async function loadRig() {
  return new GLTFLoader().loadAsync(ASSET('Xbot.glb'))
}

// Static poses are rotations layered on top of the idle animation, per bone, in the bone's local frame.
// The rig rests in a T-pose with every bone axis world-aligned, which keeps these readable.
const POSES = {
  idle: {}, walk: {}, run: {},
  sit: { LeftUpLeg: [-1.45, 0, 0.14], RightUpLeg: [-1.45, 0, -0.14], LeftLeg: [1.6, 0, 0], RightLeg: [1.35, 0, 0], Spine: [0.14, 0, 0], Neck: [-0.05, 0, 0], LeftArm: [0, -0.4, 0], RightArm: [0, 0.4, 0], LeftForeArm: [0, 0, 0.6], RightForeArm: [0, 0, -0.6], _y: -0.52 },
  crouch: { LeftUpLeg: [-2.0, 0, 0.2], RightUpLeg: [-2.0, 0, -0.2], LeftLeg: [2.4, 0, 0], RightLeg: [2.4, 0, 0], Spine: [0.5, 0, 0], Neck: [-0.35, 0, 0], LeftArm: [0, -0.9, 0], RightArm: [0, 0.9, 0], LeftForeArm: [0, 0, 0.9], RightForeArm: [0, 0, -0.9], _y: -0.64 },
  kneel: { LeftUpLeg: [-0.25, 0, 0.1], RightUpLeg: [-0.25, 0, -0.1], LeftLeg: [1.7, 0, 0], RightLeg: [1.7, 0, 0], Spine: [0.3, 0, 0], Neck: [0.2, 0, 0], LeftArm: [0, -0.7, 0], RightArm: [0, 0.7, 0], _y: -0.58 },
  lie: { LeftArm: [0, 0, 0.3], RightArm: [0, 0, -0.3], Neck: [-0.2, 0, 0], _y: 0.1, _rx: -Math.PI / 2 + 0.06 },
  lean: { Spine: [-0.12, 0, 0], LeftArm: [0, -0.5, -0.3], RightArm: [0, 0.5, 0.3], LeftForeArm: [0, 0, 1.6], RightForeArm: [0, 0, -1.6], LeftLeg: [0.3, 0, 0], _y: -0.03 },
  spin: { LeftArm: [0, 0, 1.35], RightArm: [0, 0, -1.35], Neck: [-0.25, 0, 0], _y: 0 },
  golf: (fig) => {
    const s = fig.swing || 0
    return { Spine: [0.5, s * 0.9, 0], Spine1: [0.2, s * 0.3, 0], Neck: [-0.4, -s * 0.5, 0], LeftArm: [0, -1.0 + s * 0.2, -0.45], RightArm: [0, 1.0 - s * 0.2, 0.45], LeftForeArm: [0, 0, 0.25], RightForeArm: [0, 0, -0.25], _y: -0.1 }
  },
}

export class Character {
  constructor(gltf, { body = '#555', joints = '#222', scale = 1 } = {}) {
    this.root = new THREE.Group()
    this.model = SkeletonUtils.clone(gltf.scene)
    this.model.scale.multiplyScalar(scale)
    this.root.add(this.model)
    this.model.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) {
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false
        const m = o.material.clone()
        const isJoint = /Joints/i.test(m.name)
        m.color = new THREE.Color(isJoint ? joints : body)
        m.roughness = isJoint ? 0.55 : 0.72; m.metalness = isJoint ? 0.3 : 0.05
        o.material = m
      }
    })
    this.bone = {}
    this.model.traverse((o) => { if (o.isBone) this.bone[o.name.replace(/^mixamorig:?/, '')] = o })
    this.mixer = new THREE.AnimationMixer(this.model)
    this.actions = {}
    for (const name of ['idle', 'walk', 'run']) {
      const clip = THREE.AnimationClip.findByName(gltf.animations, name)
      const a = this.mixer.clipAction(clip); a.play(); a.setEffectiveWeight(name === 'idle' ? 1 : 0)
      this.actions[name] = a
    }
    // hand attachment points, in metres, hanging along the fingers
    const hand = (bone, sign) => { const g = new THREE.Group(); g.scale.setScalar(100); g.rotation.z = sign * Math.PI / 2; this.bone[bone].add(g); return g }
    this.handL = hand('LeftHand', 1); this.handR = hand('RightHand', -1)
    this.pose = 'idle'; this.t = 0; this.swing = 0
    this.cur = {}; this.curY = 0; this.curRX = 0
    this.weights = { idle: 1, walk: 0, run: 0 }
  }
  setPose(p) { if (POSES[p] === undefined) p = 'idle'; this.pose = p }
  update(dt, speed = 0) {
    this.t += dt
    const p = this.pose
    const want = { idle: 0, walk: 0, run: 0 }
    want[p === 'walk' || p === 'run' ? p : 'idle'] = 1
    const k = Math.min(1, dt * 9)
    for (const n in want) { this.weights[n] += (want[n] - this.weights[n]) * k; this.actions[n].setEffectiveWeight(this.weights[n]) }
    this.actions.walk.timeScale = THREE.MathUtils.clamp(speed / 1.45, 0.7, 1.7)
    this.actions.run.timeScale = THREE.MathUtils.clamp(speed / 4.4, 0.7, 1.4)
    this.mixer.update(dt)
    // layer the static pose on top of whatever the animation did
    const def = POSES[p]
    const off = typeof def === 'function' ? def(this) : def
    const ks = Math.min(1, dt * 8)
    const names = new Set([...Object.keys(this.cur), ...Object.keys(off).filter((n) => n[0] !== '_')])
    const q = new THREE.Quaternion(), e = new THREE.Euler()
    for (const n of names) {
      const target = off[n] ? q.setFromEuler(e.set(off[n][0], off[n][1], off[n][2])) : q.identity()
      const c = this.cur[n] || (this.cur[n] = new THREE.Quaternion())
      c.slerp(target, ks)
      const b = this.bone[n]
      if (b) b.quaternion.multiply(c)
      if (!off[n] && Math.abs(c.w) > 0.9999) delete this.cur[n]
    }
    this.curY += ((off._y || 0) - this.curY) * ks
    this.curRX += ((off._rx || 0) - this.curRX) * Math.min(1, dt * 6)
    this.model.position.y = this.curY
    this.root.rotation.x = this.curRX
    if (p === 'spin') this.root.rotation.y += dt * 4.2
  }
}
