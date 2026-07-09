/**
 * StateEffect / ScriptAction applier — the one place declarative content
 * patches (procedure step effects, completion effects, scenario scripts)
 * mutate PatientState. Also owns physiology RAMPS (base params interpolated
 * over time).
 */
import type { ScriptAction, StateEffect } from '../../contracts/content';
import type { USFindings, ExamFindings } from '../../contracts/patient';
import type { UsViewId } from '../../contracts/ids';
import type { EngineCtx } from '../types';
import { getPath, setPath } from '../paths';
import type { VentHandle } from '../vent';
import type { RhythmMachine } from '../rhythms';

export interface Ramp {
  param: string;
  from: number;
  to: number;
  startT: number;
  overS: number;
}

export interface EffectsHandle {
  apply(effect: StateEffect, site?: string): void;
  applyScriptAction(action: ScriptAction, scriptId: string): void;
  /** advance active base-param ramps; call once per tick, before pharmacology */
  tickRamps(t: number, dt: number): void;
  serialize(): Ramp[];
  restore(state: Ramp[]): void;
}

/** Default findings per view family, used when a script patches an absent view. */
export function defaultUsFindings(view: UsViewId): USFindings {
  if (view === 'ivc') return { kind: 'ivc', diameterCm: 1.8, collapse: 0.3 };
  if (view.startsWith('lung_')) return { kind: 'lung', sliding: true, bLines: 0, effusion: 0 };
  if (view === 'ruq' || view === 'luq' || view === 'pelvis')
    return { kind: 'abdominal', freeFluid: 0 };
  return { kind: 'cardiac', contractility: 0.6, lvScale: 1, rvScale: 1, effusion: 0 };
}

export function defaultExamFindings(): ExamFindings {
  return {
    inspect: 'Unremarkable.',
    palpate: 'Unremarkable.',
    auscultation: { heartMurmur: 0, heartMuffled: 0, lungRecipe: 'clear', lungIntensity: 0.5 },
  };
}

export function createEffects(
  ctx: EngineCtx,
  vent: VentHandle,
  rhythms: RhythmMachine,
): EffectsHandle {
  const ramps: Ramp[] = [];

  function cancelRamp(param: string): void {
    for (let i = ramps.length - 1; i >= 0; i--) {
      if (ramps[i].param === param) ramps.splice(i, 1);
    }
  }

  function apply(effect: StateEffect, site?: string): void {
    const patient = ctx.patient;
    switch (effect.type) {
      case 'set':
        setPath(patient, effect.path, effect.value);
        break;
      case 'add': {
        const cur = getPath(patient, effect.path);
        setPath(patient, effect.path, (typeof cur === 'number' ? cur : 0) + effect.value);
        break;
      }
      case 'setPhysiology':
        cancelRamp(effect.param);
        patient.physiology[effect.param] = effect.value;
        break;
      case 'rampPhysiology': {
        cancelRamp(effect.param);
        const from = patient.physiology[effect.param] ?? 0;
        if (effect.overS <= 0) {
          patient.physiology[effect.param] = effect.to;
        } else {
          ramps.push({
            param: effect.param,
            from,
            to: effect.to,
            startT: ctx.now(),
            overS: effect.overS,
          });
        }
        break;
      }
      case 'addLine': {
        const line = {
          id: ctx.nextId('line'),
          type: effect.lineType,
          site: effect.site === '$site' ? (site ?? effect.site) : effect.site,
          placedAt: ctx.now(),
        };
        patient.lines.push(line);
        ctx.emit({ type: 'LinePlaced', line: { ...line } });
        break;
      }
      case 'setVent':
        vent.applySettings(effect.settings, 'scenario', effect.connect);
        break;
      case 'setUsFinding': {
        const existing = patient.us[effect.view] ?? defaultUsFindings(effect.view);
        patient.us[effect.view] = { ...existing, ...effect.patch } as USFindings;
        break;
      }
      case 'setExamFinding': {
        const existing = patient.exam[effect.zone] ?? defaultExamFindings();
        patient.exam[effect.zone] = { ...existing, ...effect.patch };
        break;
      }
      case 'setRhythm':
        rhythms.set(effect.rhythm);
        break;
    }
  }

  function applyScriptAction(action: ScriptAction, scriptId: string): void {
    switch (action.type) {
      case 'nurseSay':
        ctx.emit({ type: 'NurseSpeech', say: action.text });
        break;
      case 'notify':
        ctx.emit({
          type: 'ScenarioScriptedEvent',
          scriptId: `${scriptId}#notify`,
          label: action.text,
        });
        break;
      default:
        apply(action);
        break;
    }
  }

  function tickRamps(t: number, _dt: number): void {
    for (let i = ramps.length - 1; i >= 0; i--) {
      const r = ramps[i];
      const progress = (t - r.startT) / r.overS;
      if (progress >= 1) {
        ctx.patient.physiology[r.param] = r.to;
        ramps.splice(i, 1);
      } else if (progress > 0) {
        ctx.patient.physiology[r.param] = r.from + (r.to - r.from) * progress;
      }
    }
  }

  return {
    apply,
    applyScriptAction,
    tickRamps,
    serialize: () => [...ramps],
    restore: (state) => {
      ramps.splice(0, ramps.length, ...state);
    },
  };
}
