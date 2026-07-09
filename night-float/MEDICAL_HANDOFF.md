# MEDICAL_HANDOFF

**Audience:** the model (or physician-author) doing the *medical pass* on Night
Float. You have never seen this repo. You will make the medicine real. You should
not need to touch engine machinery — if you do, that's a bug in the firewall;
stop and note it.

## The deal

The simulation machinery (engine, 3D world, device screens, procedures runtime,
audio, EMR) is finished and tested with **placeholder medicine**. Every medically
load-bearing number, curve, mapping, step list and finding lives in one of two
places:

1. **Content files** in `src/data/**` — pure data validated by zod schemas in
   `src/contracts/content.ts`. This is where most of your work happens.
2. **Tagged engine stubs** — small function bodies marked `TODO(MEDICAL)` with a
   one-line note on what the real version should model. The generated inventory
   at the bottom of this file lists every tag with file + line.

Run `npm run handoff` to regenerate this document after your edits (the tag
inventory below is generated; the preamble is `docs/handoff-preamble.md`).
Run `npm run verify` when done — determinism, schema round-trips and the smoke
tour must stay green.

## Where each kind of medicine plugs in

| You want to author… | Edit | Validated by |
| --- | --- | --- |
| Drug PK/PD, dosing, rhythm effects | `src/data/drugs/*.ts` | `drugDefinitionSchema` |
| Lab panels, reference ranges | `src/data/labs/*.ts` | `labPanelDefinitionSchema` |
| Lab **values** as f(patient state) | `src/engine/labs/generators.ts` | registry of tagged functions |
| Procedure steps, complications | `src/data/procedures/*.ts` | `procedureDefinitionSchema` |
| Scenarios: initial state, scripted events, end conditions | `src/data/scenarios/*.ts` | `scenarioFileSchema` |
| Debrief rubrics | `rubric` block of each scenario | `scenarioRubricSchema` |
| Exam findings text + auscultation params | scenario `initialPatient.exam` + defaults in `src/engine/exam-defaults.ts` (tagged) | `examFindingsSchema` |
| Ultrasound findings per view | scenario `initialPatient.us` + scripted `setUsFinding` | `usFindingsSchema` |
| Physiology equations (MAP, SpO2, HR coupling…) | `src/engine/physiology/*.ts` stub bodies | tags |
| PatientState → waveform fidelity (PPV, perfusion→pleth…) | `src/engine/params.ts` | tags |
| Lung model / vent behavior | `src/engine/vent.ts`, `src/engine/waveforms/vent-curves.ts` | tags |
| Alarm default limits | scenario `devices.monitor.alarmLimits` + defaults in `src/engine/alarms.ts` | tags |
| Heart/lung sound recipes | `src/audio/auscultation.ts` recipe tables | tags |

## Contracts you must not break

- Content must parse: `npm run test` includes zod round-trips for every file in
  `src/data`.
- The engine stays pure (no three/react/zustand imports) — eslint enforces.
- Determinism: use the provided `Rng` (never `Math.random`), sim-seconds
  (never wall time).
- `physiology` keys are open-ended — add parameters freely; they flow through
  effects, scripts (`setPhysiology`/`rampPhysiology`) and generators by name.
- See `CONTENT_AUTHORING.md` for worked examples of each content type.

---

## Generated TODO(MEDICAL) inventory

_110 tags across 44 files. Regenerate with `npm run handoff`._

### `src/audio/alarms.ts`

- **L35** — true IEC 60601-1-8 melodies.

### `src/audio/steth.ts`

- **L10** — real acoustics per finding (murmur timing/character
- **L130** — real vesicular/bronchial spectra.
- **L148** — polyphonic wheeze.
- **L196** — real muffling acoustics.
- **L225** — heart-sound acoustics, splits, gallops.
- **L243** — murmur taxonomy.
- **L260** — per-recipe gains; 'diminished' quiet, 'absent' near-silent.
- **L303** — bowel character.

### `src/contracts/content.ts`

- **L190** — the whole PD shape is a placeholder frame.

### `src/contracts/patient.ts`

- **L36** — murmur character/timing taxonomy.
- **L64** — map to EF ranges.
- **L162** — sensible default alarm limits.
- **L199** — real parameter set + units.
- **L206** — every one of these is a placeholder scalar, roughly 0..1

### `src/contracts/waveforms.ts`

- **L71** — fidelity of the lung model itself lives in the engine stub.

### `src/data/drugs/amiodarone.ts`

- **L3** — antiarrhythmic exemplar (probabilistic rhythm conversion) — placeholder numbers.

### `src/data/drugs/fentanyl.ts`

- **L3** — opioid exemplar (sedation + respiratory depression) — placeholder numbers.

### `src/data/drugs/index.ts`

- **L3** — every drug in here ships with placeholder kinetics/effects.

### `src/data/drugs/lactated-ringers.ts`

- **L16** — via todoMedical: a real 1L bolus runs 15-30+ min

### `src/data/drugs/norepinephrine.ts`

- **L3** — pressor exemplar — every number below is a placeholder (see todoMedical).

### `src/data/drugs/propofol.ts`

- **L3** — sedative exemplar (bolus + infusion, hypotension side effect) — placeholder numbers.

### `src/data/drugs/rocuronium.ts`

- **L3** — paralytic exemplar (weight-based bolus, paralysis then wear-off) — placeholder numbers.

### `src/data/labs/index.ts`

- **L3** — ).

### `src/data/labs/panels.ts`

- **L3** — ).

### `src/data/procedures/aline.ts`

- **L4** — placeholder step list. The payoff is

### `src/data/procedures/cvl.ts`

- **L4** — placeholder step list; real

### `src/data/procedures/ett.ts`

- **L4** — placeholder step list. Completion

### `src/data/procedures/index.ts`

- **L3** — step lists are

### `src/data/scenarios/base.ts`

- **L3** — alarm limits and "normal" findings are placeholder content.
- **L14** — per-scenario limit strategy.
- **L29** — .

### `src/data/scenarios/crashing.ts`

- **L10** — the entire deterioration arc, doses, and endpoints.
- **L30** — (see surrounding code)
- **L33** — (see surrounding code)
- **L40** — (see surrounding code)
- **L191** — thresholds)

### `src/data/scenarios/stable-night.ts`

- **L32** — (see surrounding code)

### `src/engine/alarms.ts`

- **L24** — sensible default alarm limits per vital.
- **L96** — full arrhythmia alarm taxonomy

### `src/engine/bedside.ts`

- **L11** — NIBP cuff cycle time
- **L38** — real exam findings taxonomy per zone/mode/state.
- **L100** — NIBP vs arterial offsets

### `src/engine/labs/generators.ts`

- **L23** — lactate kinetics = production (hypoperfusion) - clearance.
- **L32** — .
- **L41** — WBC kinetics with infection/steroids; placeholder fever tie.
- **L44** — dilution vs blood loss; placeholder volume dilution only.
- **L47** — hct tracks hgb x3 as a placeholder.
- **L53** — K shifts with acidosis/insulin; crude lactate bump.
- **L57** — bicarbonate consumed by lactate 1:1-ish placeholder.
- **L61** — creatinine should lag hypotension by hours, not track it.
- **L68** — pH from full acid-base (anion gap, resp compensation).
- **L73** — PaCO2 from alveolar ventilation; crude RR inverse.
- **L78** — PaO2 from shunt equation; crude FiO2/shunt blend.
- **L88** — troponin rise/fall kinetics over hours post-injury.

### `src/engine/labs/index.ts`

- **L14** — portable CXR realistic timing
- **L54** — real read templates.
- **L58** — (see surrounding code)
- **L60** — (see surrounding code)

### `src/engine/params.ts`

- **L5** — mapping fidelity (amplitudes, swings, damping) is stub-level.
- **L19** — PPV% from heart-lung interaction.
- **L32** — (see surrounding code)

### `src/engine/pharmacology/kinetics.ts`

- **L11** — real model wants plasma + effect-site compartments (ke0),
- **L28** — placeholder frame — real PD curves per drug/effect.
- **L60** — real version needs diluent/bag options and unit sanity table.

### `src/engine/physiology/hemodynamics.ts`

- **L10** — real rate ranges per rhythm.
- **L18** — (see surrounding code)
- **L20** — 150-170 monomorphic VT
- **L43** — replace with CO*SVR-based model (preload/afterload curves).
- **L47** — stroke volume / arterial compliance model.
- **L51** — real baroreflex gain, blunting with sedation/beta-blockade.
- **L60** — (see surrounding code)
- **L76** — CVP from RV function + volume, respiratory variation.
- **L85** — capillary refill / lactate clearance linkage.

### `src/engine/physiology/respiratory.ts`

- **L18** — chemoreceptor drive (CO2/O2), not a linear drive scalar.
- **L24** — (see surrounding code)
- **L35** — device-specific FiO2 (NC/NRB/HFNC).
- **L39** — recruitment/derecruitment dynamics, PEEP titration curve.
- **L45** — apneic desaturation should follow an FRC/VO2 trajectory.
- **L49** — .
- **L51** — SvO2 = f(DO2/VO2).
- **L53** — real shunt equation over O2 CONTENT.
- **L55** — (see surrounding code)
- **L56** — (see surrounding code)
- **L65** — EtCO2 from CO2 production / alveolar ventilation.
- **L68** — (see surrounding code)

### `src/engine/physiology/sedation.ts`

- **L9** — onset of behavioral state change / emergence tails per agent.
- **L23** — agitation dynamics

### `src/engine/physiology/temperature.ts`

- **L3** — fever curves, antipyretics, active warming/cooling.
- **L8** — (see surrounding code)

### `src/engine/types.ts`

- **L32** — which params behave as slow states vs instant modifiers.

### `src/engine/vent.ts`

- **L5** — the entire lung model is a placeholder — real version wants
- **L13** — sane clinical bounds.
- **L55** — (see surrounding code)
- **L66** — backup rate
- **L69** — (see surrounding code)
- **L73** — I:E control
- **L86** — muscle pressure model

### `src/engine/waveforms/art.ts`

- **L8** — shape constants and the damping/PPV mappings are cosmetic.

### `src/engine/waveforms/capno.ts`

- **L7** — upstroke width vs. obstruction and phase III slope scaling.

### `src/engine/waveforms/ecg.ts`

- **L6** — all template positions/widths/amplitudes, the QT-rate

### `src/engine/waveforms/pleth.ts`

- **L6** — shoulder position/size vs. arterial compliance is cosmetic.

### `src/engine/waveforms/resp.ts`

- **L6** — I:E asymmetry is fixed at ~0.4/0.6 for looks.

### `src/engine/waveforms/vent-curves.ts`

- **L11** — single-compartment RC model with cosmetic time constants —

### `src/screens/cxr.ts`

- **L6** — findings mapping (effusion blunting, B-line haze, ETT tip

### `src/screens/laryngoscopy.ts`

- **L11** — geometry is impressionistic and the view grade comes from
- **L100** — mark spacing/cm labels are decorative placeholders.

### `src/screens/us-views-body.ts`

- **L6** — all geometry is impressionistic — shapes/sizes/motion are

### `src/screens/us-views.ts`

- **L6** — all geometry is impressionistic — shapes/sizes/motion are

### `src/ui/procedures/LaryngoscopyOverlay.tsx`

- **L20** — depth-by-height.

