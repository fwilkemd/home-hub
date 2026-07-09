# CONTENT_AUTHORING

How to add medicine to Night Float without touching machinery. Everything
here is data in `src/data/**`, validated by the zod schemas in
`src/contracts/content.ts` (the `define*` helpers parse at import time, so a
typo fails `npm run test` loudly). After edits: `npm run verify` and
`npm run handoff`.

All engine timing is **sim-seconds**; physiology parameters are open-ended
`string -> number` (add your own — effects, scripts and lab generators refer
to them by name).

---

## 1. Add a drug

Create `src/data/drugs/vasopressin.ts`:

```ts
import { defineDrug } from '../../contracts/content';

export const vasopressin = defineDrug({
  id: 'vasopressin',
  name: 'vasopressin',
  class: 'pressor',
  todoMedical: 'placeholder PK/PD — real V1 receptor kinetics + fixed-dose convention',
  concentration: { amount: 20, unit: 'units', volumeMl: 100 },
  infusion: { doseUnit: 'units/min', min: 0.01, max: 0.06, default: 0.03, step: 0.01 },
  pk: { onsetS: 60, offsetS: 600, refDose: 0.03 },
  effects: [
    // magnitude = potency * ce^n / (ce^n + ec50^n); add -> param += m, mult -> param *= 1+m
    { param: 'svr', mode: 'add', potency: 0.25, ec50: 1, hillN: 1 },
  ],
});
```

Register it in `src/data/drugs/index.ts` (import + add to the array). It now
appears in the EMR order search, the pumps, PK/PD, and the MAR — no other
code. Weight-based units (`/kg/`) convert via the patient's `weightKg`;
`rhythmEffects` lets a drug convert rhythms probabilistically.

## 2. Add a lab panel

Add to `src/data/labs/panels.ts` (or a new file registered in
`src/data/labs/index.ts`):

```ts
export const bnp = defineLabPanel({
  id: 'bnp',
  name: 'BNP',
  poc: false,
  turnaroundS: 2700,
  statTurnaroundS: 1500,
  todoMedical: 'placeholder — real assay behavior + failure-state coupling',
  tests: [
    { id: 'bnp', name: 'BNP', unit: 'pg/mL', refLo: 0, refHi: 100, critHi: 5000,
      generator: 'bnp', precision: 0 },
  ],
});
```

Then implement the **value** in `src/engine/labs/generators.ts` — a function
of the live patient (this is the one engine file content authors touch;
every entry is `TODO(MEDICAL)`):

```ts
bnp: (patient, effective, rng) =>
  80 + 900 * (1 - clamp01(effective.contractility)) + rng.gauss() * 25,
```

## 3. Change what the ultrasound shows

Findings are parametric per view, on the patient (scenario) or via scripts:

```ts
// in a scenario's initialPatient.us
us: {
  plax: { kind: 'cardiac', contractility: 0.15, lvScale: 1.5, effusion: 0.4 },
  ivc:  { kind: 'ivc', diameterCm: 2.6, collapse: 0.05 },
  lung_ant_l: { kind: 'lung', sliding: true, bLines: 6, effusion: 0 },
},

// or mid-scenario, from a scripted event
{ type: 'setUsFinding', view: 'plax', patch: { effusion: 0.8 } },
```

The renderer maps these to shapes: `contractility` drives wall excursion
(beat-synced with the monitor), `effusion` draws the anechoic rim, `collapse`
animates the IVC with respiration, `bLines` counts comet tails, `freeFluid`
paints stripes in the FAST views.

## 4. Add or edit a procedure

Procedures are 100% data + four generic interaction types (`click`,
`click_hold`, `align_hold`, `slider`) + two optional overlays
(`us_procedural`, `laryngoscopy`). Sketch of a new one:

```ts
export const chestTube = defineProcedure({
  id: 'chest_tube',
  name: 'Chest tube',
  todoMedical: 'placeholder steps — real technique, sizes, complications',
  requiredTool: 'cvl_kit', // or add a new ToolId in contracts/ids.ts
  kitLabel: 'Thoracostomy tray',
  siteOptions: ['L 5th ICS mid-axillary', 'R 5th ICS mid-axillary'],
  positioningNote: 'Head of bed 30°, arm above head.',
  sterile: true,
  steps: [
    { id: 'prep', prompt: 'Prep and drape the site', interaction: 'click_hold', holdS: 2 },
    { id: 'incise', prompt: 'Incise and blunt-dissect', interaction: 'click_hold', holdS: 2.5,
      complications: [{ id: 'bleed', label: 'Intercostal bleeding', baseProb: 0.05,
        effects: [{ type: 'rampPhysiology', param: 'volumeStatus', to: 0.3, overS: 300 }] }] },
    { id: 'insert', prompt: 'Advance the tube', interaction: 'slider' },
    { id: 'secure', prompt: 'Suture and dress', interaction: 'click_hold', holdS: 2 },
  ],
  completionEffects: [
    { type: 'setUsFinding', view: 'lung_post_l', patch: { effusion: 0 } },
  ],
});
```

Register in `src/data/procedures/index.ts`. `'$site'` inside an
`addLine` effect's `site` becomes the site chosen at start. Complication
odds multiply via `probIfSkipped` when named steps were skipped.

## 5. Write a scenario

`src/data/scenarios/<id>.ts`, registered in `scenarios/index.ts`. The shape
(see `stable-night.ts` for a compact real example):

- `initialPatient` — demographics, vitals, `physiology`
  (spread `PHYSIOLOGY_DEFAULTS` and override), `exam` per zone, `us` per
  view, `devices` (monitor alarm limits, vent, pump channels), `lines`.
- `scriptedEvents` — fire `at` a sim time or `when` a predicate holds:
  ramps/sets on physiology, rhythm changes, US/exam finding patches, vent
  changes, `nurseSay`, `notify`; `dropToRealtime` pulls 8×/32× back to 1×.
- `endConditions` — first true predicate wins (`success`/`death`/`timeout`).
  Use `sustained` with `graceS` so physiologic noise can't reset a stability
  clock, e.g.
  `{ type: 'sustained', path: 'map', op: 'gte', value: 65, seconds: 240, graceS: 20 }`.
- `rubric.items` — declarative scoring over the event log:
  `eventOccurred`, `eventWithin` (X within N seconds of Y), `never`,
  `outcome`. `where` matches event fields with dot paths
  (`{ 'order.panelId': 'lactate' }`).
- `tutorial` — optional guided steps (`doneWhen` predicates) shown on the HUD.

## 6. Exam findings & auscultation

Per zone on the patient (`exam.chest_left.auscultation`), the audio layer
synthesizes from `AuscultationParams`: `lungRecipe`
(`clear|crackles|wheeze|diminished|absent`) + `lungIntensity`, `heartMurmur`,
`heartMuffled`. Text findings live beside them (`inspect`, `palpate`,
`auscultateText`). Engine-side defaults: `src/engine/bedside.ts`
(`TODO(MEDICAL)`).

## 7. Alarm limits

Per scenario: `initialPatient.devices.monitor.alarmLimits` maps a vitals path
to `{ lo?, hi?, priority, label }`. Two tiers for one vital: add a second key
with a `#suffix` (`spo2` warning + `spo2#crisis` crisis) — the engine strips
the suffix for evaluation. Engine fallback defaults: `src/engine/alarms.ts`.
