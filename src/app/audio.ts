import * as THREE from 'three'

/**
 * All audio is synthesized WebAudio — no files, no TTS. The alarm is a
 * THREE.PositionalAudio parked at the monitor so it beeps *from* the monitor.
 */
export class SoundKit {
  readonly listener = new THREE.AudioListener()
  private alarmOut: GainNode | null = null
  private humStarted = false

  private get ctx(): AudioContext {
    return this.listener.context
  }

  /** Browsers gate audio behind a user gesture; call this on any interaction. */
  unlock(): void {
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  /** Positional alarm source mounted on (usually) the monitor mesh. */
  attachAlarm(mesh: THREE.Object3D): void {
    const audio = new THREE.PositionalAudio(this.listener)
    audio.setRefDistance(1.2)
    const master = this.ctx.createGain()
    master.gain.value = 1
    audio.setNodeSource(master as unknown as AudioBufferSourceNode)
    mesh.add(audio)
    this.alarmOut = master
  }

  /** One monitor alarm beep (call ~1 Hz while an unsilenced alarm is active). */
  alarmBeep(): void {
    if (!this.alarmOut || this.ctx.state !== 'running') return
    const t = this.ctx.currentTime
    for (const [offset, freq] of [[0, 988], [0.18, 988]] as const) {
      const osc = this.ctx.createOscillator()
      const env = this.ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = freq
      env.gain.setValueAtTime(0, t + offset)
      env.gain.linearRampToValueAtTime(0.06, t + offset + 0.01)
      env.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.14)
      osc.connect(env).connect(this.alarmOut)
      osc.start(t + offset)
      osc.stop(t + offset + 0.16)
    }
  }

  /** Soft two-note chime for a new message/result. */
  chime(): void {
    this.tone([[880, 0, 0.2], [1318.5, 0.12, 0.3]], 0.045, 'sine')
  }

  /** Short tick for UI selection. */
  click(): void {
    this.tone([[2200, 0, 0.03]], 0.05, 'triangle')
  }

  /** Low ambient room hum, started once after the first gesture. */
  startHum(): void {
    if (this.humStarted || this.ctx.state !== 'running') return
    this.humStarted = true
    const osc = this.ctx.createOscillator()
    const osc2 = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 58
    osc2.type = 'sine'
    osc2.frequency.value = 89
    gain.gain.value = 0.012
    osc.connect(gain)
    osc2.connect(gain)
    gain.connect(this.listener.getInput())
    osc.start()
    osc2.start()
  }

  private tone(notes: readonly (readonly [number, number, number])[], vol: number, type: OscillatorType): void {
    if (this.ctx.state !== 'running') return
    const t = this.ctx.currentTime
    for (const [freq, offset, dur] of notes) {
      const osc = this.ctx.createOscillator()
      const env = this.ctx.createGain()
      osc.type = type
      osc.frequency.value = freq
      env.gain.setValueAtTime(0, t + offset)
      env.gain.linearRampToValueAtTime(vol, t + offset + 0.008)
      env.gain.exponentialRampToValueAtTime(0.001, t + offset + dur)
      osc.connect(env).connect(this.listener.getInput())
      osc.start(t + offset)
      osc.stop(t + offset + dur + 0.02)
    }
  }
}
