# NIGHT FLOAT — First-Person ICU Simulation
## Build prompt for Claude Code

Working title: **Night Float**. Rename freely.

---

## 0. How to execute this document

- Read this entire file before writing any code.
- You have full autonomy. **Do not ask the user questions.** Where this spec is silent, make a reasonable call and log it as one line in `DECISIONS.md`.
- Work in the phases defined in §16. Use parallel subagents where marked. Contracts (§4) come before everything else.
- Keep `PROGRESS.md` current. Commit per milestone with clear messages.
- **The user is a physician. Medical realism is deliberately out of scope for you.** Your job is machinery: engine, world, devices, UI, procedures framework — with placeholder medical content that is clearly tagged and trivially replaceable. A second model pass will author the real medicine. Success criterion: **the medical pass never has to touch engine code** (see §5.6, the Medical Firewall).

---

## 1. Mission

An immersive first-person 3D simulation of an ICU room, in the browser. The player is the physician. The core loop:

**Assess** (look at the patient, examine, ultrasound, read the monitor and vent) → **Decide** → **Act** (place orders, give verbal orders, perform procedures) → **Observe the response** over compressed time → **Debrief**.

The player fantasy to hit: it's 3am, the room is dim, the vent is cycling, the monitor is glowing — and everything *works*. You can pick up the probe and actually scan. You can thread the wire. You can put in an order and watch the numbers move. Nothing is a painted-on prop.

Scope for v1: **one room, one patient per scenario.** Build the room generator parameterized so a multi-bed unit is a later content change, not a rewrite.

---

## 2. Hard constraints and non-goals

- Runs in a desktop browser via `npm install && npm run dev`. No backend, no accounts, no network required at runtime. Persistence via localStorage plus JSON export/import.
- **All assets procedural or generated in code.** If you must use an external asset, it must be CC0 and vendored into the repo. No paid or licensed assets, no photorealistic human models — stylized low-poly is the correct art direction, not a compromise.
- No multiplayer. No VR (keep the renderer abstraction WebXR-friendly, but do not implement). No mobile support.
- Medical accuracy is deferred (§5.6). Placeholder numbers are fine; **schemas must be able to represent the real thing.**
- The full game must work with zero API keys. The optional LLM dialogue module (§11.3) is strictly additive.

---

## 3. Stack (decided — do not relitigate)

- **Vite + TypeScript (strict)**, Node 20+.
- **Three.js (vanilla, not react-three-fiber)** for the 3D world.
- **React 18** for the 2D overlay UI (EMR, dialogs, debrief), mounted beside the canvas, never wrapping it.
- **Zustand** as the shared store bridging engine → world → UI (it works outside React). A **typed event bus** for sim events.
- **zod** for all content-file schemas. **vitest** for engine tests. **Playwright** for smoke tests and screenshots. eslint + prettier.
- **Web Audio API**, all sounds synthesized or generated into buffers at load.

Why this stack: it is fully buildable, runnable, testable, and screenshottable inside your environment. Unity/Unreal/Godot one-shots die on editors and asset pipelines. This one doesn't.

---

## 4. Architecture

```
/src
  /contracts     — canonical TypeScript types + zod schemas. Single source of truth.
  /engine        — pure simulation. NO imports of three/react/zustand (enforce via eslint no-restricted-imports).
    clock.ts       fixed-timestep scheduler, time compression
    physiology/    organ-system modules + integrator (stubs, tagged)
    pharmacology/  PK/PD framework, boluses, infusions
    labs/          lab generation + turnaround queue
    rhythms/       cardiac rhythm state machine (drives waveforms)
    waveforms/     parametric waveform generators (pure functions)
    scenario/      scenario loader, scripted events, end conditions, rubric evaluation
    log.ts         append-only SimEvent log (source of truth for debrief/replay)
  /world         — Three.js scene
    room/          procedural ICU room builder
    patient/       patient mesh, animation, exam zones
    devices/       monitor, vent, pumps, US machine, code cart (3D bodies + screen mounts)
    player/        first-person controller, pointer lock
    interact/      raycasting, highlighting, prompts, held-tool system
    npc/           nurse
  /screens       — offscreen-canvas device screens (monitor, vent, pump, ultrasound renderer)
  /ui            — React overlay: workstation/EMR, HUD, radial menu, debrief, settings
  /audio         — alarm manager, ambience, stethoscope/heart/lung generators
  /ai            — optional LLM dialogue module (off by default)
  /data          — CONTENT: scenarios/, drugs/, procedures/, labs/ (TS or JSON validated by zod)
  /bridge        — zustand store + event bus wiring
/tests           — vitest + playwright
/screenshots     — generated by the screenshot tour (§15)
```

**Engine rules:** deterministic given a seed plus the event log (this buys replay and debrief for free). Fixed **10 Hz** sim tick. Rendering runs at 60fps and reads *parameters* (e.g., WaveformParams), never raw engine internals — waveforms are synthesized at render rate from params, not at tick rate.

**Contracts come first.** Before any parallel work, write `/src/contracts` completely. Sketches (extend freely; never fork into local copies):

```ts
interface VitalSigns { hr: number; rhythm: RhythmId; spo2: number; rr: number;
  map: number; sbp: number; dbp: number; tempC: number; etco2?: number; cvp?: number; }

interface PatientState {
  id: string;
  demographics: { name: string; age: number; sex: string; weightKg: number };
  vitals: VitalSigns;
  physiology: Record<string, number>;        // continuous internals: volumeStatus, svr,
                                             // contractility, shuntFraction, compliance,
                                             // resistance, sedationScore, ...
                                             // TODO(MEDICAL) owns this list's semantics
  exam: Record<BodyZoneId, ExamFindings>;    // text + auscultation params per zone
  us: Record<UsViewId, USFindings>;          // parametric findings per ultrasound view
  lines: LineAccess[];                        // PIVs, CVC, a-line, ETT, foley...
  devices: DeviceStates;                      // vent settings/mode, pump channels, monitor config
  infusions: Infusion[];
  medsGiven: MedEvent[];
}

type SimEvent = { t: number; seq: number } & (
  | OrderPlaced | OrderModified | MedAdministered | InfusionRateChanged
  | VitalsSnapshot | AlarmRaised | AlarmSilenced | AlarmResolved
  | LabOrdered | LabResulted | ImagingResulted
  | ProcedureStarted | ProcedureStepCompleted | ProcedureComplication | ProcedureCompleted
  | NurseAction | PlayerAction | ScenarioScriptedEvent | ScenarioEnded );
```

Also define now: `DrugDefinition`, `ProcedureDefinition`, `ScenarioFile`, `ScenarioRubric`, `WaveformParams`, `USFindings`, `ExamFindings`, `DeviceStates`. One integration owner approves contract changes after Phase 0.

---

## 5. Simulation engine

**5.1 Clock.** Fixed-step 10 Hz. Time compression: pause / 1x / 8x / 32x. Auto-drop to 1x with a soft chime on: new alarm, stat lab resulted, scripted scenario event. Sim clock shown on HUD.

**5.2 Physiology.** Modular systems, each `(state, dt) => partial deltas`, composed by a simple integrator. Ship placeholder modules that are *structurally* real and *numerically* fake:
- Hemodynamics: MAP derived from volumeStatus, SVR, contractility stubs; HR loosely baroreflex-coupled.
- Respiratory: SpO2 from FiO2 and a shunt parameter; RR from sedation/drive stub.
- Rhythm state machine: sinus, sinus tach/brady, irregular (afib-like), VT, VF, asystole — as *waveform-level modes* with transition hooks the scenario/medical layer can trigger.
- Sedation/agitation scalar, temperature drift.

Every equation and constant gets `// TODO(MEDICAL)` with a one-line note on what the real version should model.

**5.3 Pharmacology.** A generic PK/PD frame: bolus and continuous infusion; effect-site concentration with onset/offset time constants; effects declared as **modifiers on named physiology parameters**. Drugs are pure data in `/src/data/drugs/` matching `DrugDefinition`. Ship ~6 placeholders covering the shapes the medical pass will need: a pressor, a fluid, a sedative, a paralytic, an antiarrhythmic, an opioid — with obviously-fake values and TODO(MEDICAL) tags.

**5.4 Labs and imaging.** Order → turnaround queue (per-panel turnaround; point-of-care faster) → `LabResulted`. Values are generated by functions of PatientState plus noise; every generator tagged TODO(MEDICAL). CXR is a procedural placeholder image plus a findings-text field driven by state. Results flow into the EMR Results tab and flowsheet.

**5.5 Scenario scripting.** `ScenarioFile` (zod-validated): initial PatientState, scripted events (fire at time T, or when a predicate over state/log is true), available resources, end conditions, debrief rubric. Ship **two demo scenarios** with placeholder medicine: `stable-night` (tutorial: learn controls, exam, one order) and `crashing` (timed deterioration that exercises alarms → pressor titration → intubation → ultrasound → debrief).

**5.6 THE MEDICAL FIREWALL — the most important design rule in this document.** Every medically load-bearing number, curve, mapping, step list, and finding lives either in `/src/data` content files or behind a `TODO(MEDICAL)` tag in an engine stub. The medical pass edits data files and stub bodies only. `MEDICAL_HANDOFF.md` (§17) is partly generated by grepping the tag — write a small script for that (`npm run handoff`).

---

## 6. World, player, interaction

**6.1 Room.** Procedural ICU room from primitives and generated textures: bed with rails, patient, headwall (gas outlets, suction), monitor on an articulating arm, ventilator, IV pole with 2–3 pumps, code cart, ultrasound machine on a cart, supply cart with labeled drawers, sink, sharps bin, computer workstation, door, curtain, and a window with faint night-city glow. Prioritize correct scale, readable silhouettes, and labels over realism.

**6.2 Patient.** Stylized low-poly humanoid, built in code. Required behaviors: chest rise synced to actual vent rate/RR; eyes open/close driven by the sedation scalar; subtle idle motion; visible lines/tubes appear after the corresponding procedure; a skin-tint parameter (pallor/cyanosis). Do not attempt uncanny detail.

**6.3 Player controller.** Pointer-lock mouse look. WASD to move (walking speed; it's one room). `E` interact, `Tab` workstation, `Q` radial quick-order menu, `1–6` tool hotbar, `Esc` releases pointer. Provide `?debugcam` — free-fly camera, no pointer lock — for automated tests and screenshots.

**6.4 Interaction system.** Camera raycast; interactables highlight with a short prompt. Context actions per object: monitor (silence alarm, cycle NIBP now, change views), pumps (open rate dialog), patient body zones (exam menu: inspect / palpate / auscultate — findings text from `PatientState.exam`, sounds via §12), drawers (open, take kit). Held-tool system: stethoscope, ultrasound probe, laryngoscope, procedure kits.

**6.5 Lighting and mood.** This carries the immersion. Dim night lighting; screens are emissive and *actually light the room* (cheap trick: a point light color-matched to each screen). One shadow-casting light max. Optional subtle vignette. Iterate with screenshots (§15) until a cold look at the frame reads "3am ICU."

---

## 7. Device screens (canvas textures)

Build one `DeviceScreen` abstraction: offscreen canvas → Three texture, redrawn at 30–60fps when visible; interacting with a screen opens a **fullscreen 2D zoom overlay of the same canvas** with clickable controls.

**7.1 Patient monitor.** Continuous waveforms: ECG (lead II), SpO2 pleth, respiration, arterial line (only once an a-line exists), EtCO2 (only once intubated). Numerics for all vitals; NIBP cycles on an interval and stamps the flowsheet. Alarm banner with priority colors.

Waveform synthesis lives in `/engine/waveforms` as pure functions of `WaveformParams`:
- **ECG:** per-beat sum-of-Gaussians PQRST template; the rhythm machine schedules beats (regularity, rate, ectopy hooks); VF = band-filtered noise; VT = wide, fast, near-sinusoidal.
- **Pleth:** systolic peak with a dicrotic-ish shoulder, amplitude scaled by a perfusion parameter.
- **Art line:** sharp upstroke, dicrotic notch, and a respiratory-swing parameter (this is the pulse-pressure-variation hook — build the parameter now).
- **Capno:** rounded square wave with an adjustable plateau slope.

The mapping `PatientState → WaveformParams` is TODO(MEDICAL) for fidelity, but ship defaults good enough that the tracings look right at a glance. **This is the soul of the sim — make the waveforms beautiful.**

**7.2 Ventilator screen.** Mode stubs (VC / PC / PS as distinct behaviors), settable RR, Vt, PEEP, FiO2, Pinsp, PS via the zoom UI. Live pressure-time, flow-time, volume-time curves from a simple lung model (compliance + resistance parameters in PatientState — TODO(MEDICAL)). Vent alarms (high pressure, low Vt) wired into the alarm manager.

**7.3 Pumps.** Per-channel drug, rate, VTBI. Rate changes take effect in the engine. Occlusion-alarm hook.

---

## 8. Ultrasound (headline feature)

Not raytraced anatomy — a **procedural renderer** that convincingly fakes it.

**8.1 Probe mechanics.** Equip the probe; near the patient it snaps between defined `UsViewId` zones: parasternal long, parasternal short, apical 4-chamber, subxiphoid, IVC, anterior/posterior lung fields L+R, RUQ, LUQ, pelvis. Fine mouse movement within a zone adjusts a "window quality" scalar (image degrades/sharpens) plus rotation feel. Image renders on the machine screen and in the zoom overlay. Depth and gain knobs. **Freeze** and **save clip** — saved stills land in the EMR Media tab.

**8.2 Renderer.** Layered 2D canvas composition inside a fan-shaped mask:
- Base: animated multiplicative speckle (value noise), depth-gain falloff, near-field haze.
- Structures: parametric primitives per view, bound to `USFindings` from PatientState. Cardiac views: chambers as animated ellipses with wall thickness, contraction amplitude driven by contractility and HR; pericardial effusion = anechoic rim with a size parameter. IVC: tube with diameter and a collapse fraction animated with respiration. Lung: bright pleural line, a sliding-shimmer toggle, B-lines as bright vertical rays (count parameter), effusion wedge. Abdominal: organ blobs plus free-fluid stripe toggles.
- M-mode is a nice-to-have; skip if it threatens the schedule.

**8.3 Acceptance test.** A clinician glancing at a screenshot of your parasternal long should say "ha — that reads." Iterate against your own saved screenshots until it does.

---

## 9. Procedures framework + three exemplars

**9.1 Framework.** `ProcedureDefinition` = metadata (required kit, site options, positioning) plus an ordered `ProcedureStep[]`: id, prompt text, required tool, target zone, interaction type (click-hold / align-and-hold / slider gesture), success checks, complication hooks with probability modifiers, and state effects on completion. Runtime is a state machine with diegetic prompts (small HUD near the hands) and a per-step event log. Steps can be marked skippable-with-consequence.

**9.2 Sterile field mini-system.** Gown/glove step creates a sterile zone volume; touching non-sterile objects fires a contamination event (consequences are a medical-pass hook).

**9.3 Ship three exemplars** with placeholder step lists (real steps come from the medical pass):
1. **Central line** (US-guided — reuses §8 in a "procedural window" mode with vessel targets and a needle overlay; wire, dilate, thread, suture steps; CVP appears on the monitor after).
2. **Arterial line** (radial; the payoff is the art waveform appearing live on the monitor).
3. **Intubation** (positioning, laryngoscope view rendered as a procedural 2D airway image with a difficulty/grade parameter, tube-depth slider, confirmation via EtCO2 appearing plus symmetric chest rise).

**9.4 Prove extensibility:** the three exemplars must be 100% data plus generic interaction types, so chest tube, thoracentesis, paracentesis, LP, etc. are later *content-only* additions.

---

## 10. Workstation UI (EMR) — React overlay

Tabs:
- **Chart** — HPI/background from the scenario file.
- **Orders** — the main "act" verb; make it fast (search, favorites, recents). Meds with dose/route/rate and infusion titration; lab panels; imaging; vent/respiratory orders; nursing orders.
- **MAR** — scheduled and given meds.
- **Results** — labs table with trends and abnormal flags.
- **Flowsheet** — vitals strip charts pulled from the event log.
- **Media** — saved ultrasound stills, CXR.
- **Notes** — free text plus a templated event note.
- **Debrief** — post-scenario (§13).

Every order emits SimEvents consumed by the nurse and engine. Nothing in the UI mutates state directly.

---

## 11. Nurse and verbal orders

**11.1 Nurse NPC.** One stylized figure, simple waypoint pathing (no navmesh needed). Consumes the order queue with realistic-ish task timing: fetch med → program pump or push; draw labs; etc. Short barks via speech bubble and a text log ("Pushing it now." / "Pressure's soft, doc."). Notifies the player of alarms and stat results when the player is buried in the workstation.

**11.2 Verbal orders.** Radial menu / command bar with structured quick orders: push X, bolus fluids, titrate infusion, stat lab, call RT. Deterministic parser over structured choices — no free text required.

**11.3 Optional LLM module** (`/src/ai`, OFF by default). Anthropic API key entered in settings, stored locally. Enables free-text chat with nurse / patient / family / consultant; the model receives structured sim context and a tool schema that can **only** emit the same structured orders/events as 11.2. The game must be fully playable with this module off.

---

## 12. Audio and alarms

- **Alarm manager:** priority tiers (crisis / warning / advisory), latching, per-source silence/acknowledge, distinct synthesized cadences per tier (IEC-flavored), spatialized to the source device.
- **Ambience:** room tone; vent cycle whoosh synced to the actual vent; pump clicks; monitor QRS beep with **pitch mapped to SpO2** (the pitch drops as the sat drops — do this, it's the iconic ICU sound).
- **Stethoscope:** parameterized heart sounds (rate, rhythm, a murmur-noise hook) and lung sounds (clear / crackles / wheeze as noise recipes) per exam zone. Recipes are TODO(MEDICAL); ship plausible defaults.
- Master / SFX / ambience sliders in settings.

---

## 13. Time, debrief, scoring

The append-only event log is the source of truth. Debrief screen: a timeline of interventions and events rendered over a vitals strip chart; procedure log; orders vs. results; a **rubric engine** that evaluates `ScenarioRubric` — declarative conditions over the event log (e.g., "event X occurred within N minutes of event Y"). Build the schema and evaluator now; real rubrics are medical-pass content. Full-log JSON export from the debrief screen.

---

## 14. Quality bar and performance

- 60fps on a mid-tier laptop. Under ~300 draw calls (merge/instance props). One shadow light. Modest texture budget.
- **Zero console errors** policy, enforced in the smoke test.
- The vibe target, verbatim: dim room, glowing waveforms, the vent breathing, a distant alarm. Screenshot it and ask "does this read 3am ICU?" Iterate until yes.

---

## 15. Testing and self-verification

- **vitest:** engine determinism (seeded scenario → event-log snapshot), waveform sanity (beat count matches HR over a window), infusion math, rhythm-machine transitions, zod round-trips for every content schema.
- **Playwright smoke:** app boots; canvas present; `?debugcam` tours **five named viewpoints** (bedside, monitor close-up, vent close-up, US screen, wide room) saving PNGs to `/screenshots`; workstation opens; placing an order produces a MAR row; zero console errors.
- `npm run verify` = typecheck + lint + unit + smoke. Run it at **every milestone**.
- **Look at the screenshots** at every milestone and fix what looks wrong. Visual self-review is part of the loop, not optional.

---

## 16. Execution plan

**Phase 0 — blocking, single-threaded.** Repo scaffold, `/src/contracts` complete, event bus, zustand bridge, clock, `npm run verify` skeleton.

**Phase 1 — parallel subagents.**
- **A:** world + player + interaction system.
- **B:** engine (physiology stubs, pharmacology, labs, scenario loader, log).
- **C:** waveform generators + monitor + the DeviceScreen abstraction.
- **D:** EMR shell + orders pipeline.

Contract changes go through one integration owner only.

**Phase 2 — integrate: THE VERTICAL SLICE.** Walk the room → live monitor reflects patient state → `Tab` → order a pressor infusion → nurse hangs it → MAP responds → alarm resolves → one basic ultrasound view → scenario ends → debrief shows the whole thing. **Nothing else matters until this loop is smooth.**

**Phase 3 — parallel.** Full ultrasound module; procedures framework + three exemplars; vent screen + lung stub; audio + alarms; nurse NPC polish; scenarios + rubric + debrief polish.

**Phase 4.** Polish, performance pass, settings + save/load, docs, final `verify`, final screenshot gallery.

If any feature threatens to stall a phase, ship its slice-level version, log it in `DECISIONS.md`, and move on. **A complete working loop beats four half-features.**

---

## 17. Deliverables

1. Running app: `npm install && npm run dev`.
2. `README.md` — quickstart, controls, screenshots.
3. `ARCHITECTURE.md` — module map, data flow, the engine/render/UI boundary.
4. `CONTENT_AUTHORING.md` — how to add a drug, a scenario, an ultrasound finding, a procedure — each with a worked example.
5. **`MEDICAL_HANDOFF.md`** — the contract for the medical pass, written for a model that has never seen this repo: a generated inventory of every `TODO(MEDICAL)` (via `npm run handoff`), every content schema, and exactly where real physiology, drug models, procedure steps, exam findings, ultrasound findings, lab generators, and rubrics plug in.
6. `DECISIONS.md`, `PROGRESS.md`, and the `/screenshots` gallery.

---

## 18. Acceptance checklist

- [ ] `npm run verify` passes clean; zero console errors in smoke.
- [ ] Vertical slice (§16 Phase 2) demoable end to end.
- [ ] All ultrasound views render and visibly change when `USFindings` change.
- [ ] All three procedures completable start to finish; art line makes the arterial waveform appear.
- [ ] Vent settings change the lung-model curves and can trigger vent alarms.
- [ ] Alarms sound, spatialize, silence, and auto-drop time compression.
- [ ] Time compression works; labs return on turnaround delays.
- [ ] Debrief renders timeline + strip chart and exports JSON.
- [ ] Both demo scenarios playable.
- [ ] `MEDICAL_HANDOFF.md` complete and generated fresh.
- [ ] Screenshot gallery reads "3am ICU" at a glance.
