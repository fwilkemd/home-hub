/**
 * Headless guarantee for the audio module (SPEC §12/§14): in an environment
 * with no AudioContext (node / jsdom / smoke bootstrapping), constructing
 * createAudio, driving it with bus events and frames, and disposing it must
 * never throw and never write to the console.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EngineHandle } from '../contracts/runtime';
import { bus } from '../bridge/bus';
import { createAudio } from './index';

function stubEngine(): EngineHandle {
  const stub = {
    getSimTime: () => 42,
    getActiveAlarms: () => [
      {
        id: 'monitor-spo2-lo',
        source: 'monitor' as const,
        priority: 'crisis' as const,
        label: 'SpO2 critically low',
        raisedAt: 10,
        active: true,
        latched: false,
        silencedUntil: 0,
      },
    ],
    getBreathPhase: () => 0.2,
    getVentWave: () => ({ connected: true, standby: false }),
    getWaveformParams: () => ({
      beatSeed: 7,
      ecg: { rhythm: 'sinus', rate: 80, amplitude: 1, ectopyPerMin: 0 },
    }),
    getPatient: () => ({
      exam: {},
      devices: { pumps: [{ id: 'A', running: true }] },
    }),
  };
  return stub as unknown as EngineHandle;
}

describe('audio module without AudioContext', () => {
  const spies: Array<ReturnType<typeof vi.spyOn>> = [];

  beforeEach(() => {
    for (const m of ['error', 'warn', 'log', 'info'] as const) {
      spies.push(vi.spyOn(console, m));
    }
  });

  afterEach(() => {
    for (const s of spies) {
      expect(s).not.toHaveBeenCalled();
      s.mockRestore();
    }
    spies.length = 0;
  });

  it('constructs, updates, handles bus events and disposes silently', () => {
    expect(typeof AudioContext).toBe('undefined');
    const audio = createAudio(stubEngine(), null);

    for (let i = 0; i < 5; i++) audio.update(0.016);
    audio.unlock();

    bus.emit('qrsBeep', { spo2: 88 });
    bus.emit('screenClick', { device: 'pump' });
    bus.emit('chime', { kind: 'success' });
    bus.emit('chime', { kind: 'timeDrop' });
    bus.emit('simEvent', {
      t: 1,
      seq: 1,
      type: 'ExamPerformed',
      zone: 'precordium',
      mode: 'auscultate',
      findingsText: 'Regular S1/S2.',
    });
    audio.update(0.016);

    audio.dispose();
    audio.dispose(); // double-dispose is a no-op
    audio.update(0.016); // post-dispose frames are ignored
    bus.emit('qrsBeep', { spo2: 99 }); // handlers are unsubscribed
  });

  it('can be constructed again after a previous session was disposed', () => {
    const a = createAudio(stubEngine(), null);
    a.dispose();
    const b = createAudio(stubEngine(), null);
    b.update(0.02);
    b.dispose();
  });
});
