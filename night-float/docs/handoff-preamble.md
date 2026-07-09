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
