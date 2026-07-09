import { defineScenario } from '../../contracts/content';
import { PHYSIOLOGY_DEFAULTS } from '../../contracts/patient';
import { STANDARD_ALARM_LIMITS, emptyPumps } from './base';

/**
 * The showcase deterioration (SPEC §5.5): sepsis-flavored distributive shock
 * on 4L NC — MAP drifts down (expects fluids + norepinephrine), then the
 * lungs fail (expects intubation onto the pre-set vent). Placeholder
 * physiology throughout; timings tuned for the demo loop.
 * TODO(MEDICAL): the entire deterioration arc, doses, and endpoints.
 */
export const crashing = defineScenario({
  id: 'crashing',
  title: 'Crashing',
  subtitle: 'Septic physiology, 03:12',
  seed: 4711,
  clockStart: '03:12',
  briefing: {
    oneLiner: 'POD1 perforated diverticulitis, febrile on 4L — and softening.',
    hpi: 'Ms. Vasquez is a 62-year-old woman, post-op day 1 after emergent sigmoid resection for perforated diverticulitis. Febrile overnight, on 4L nasal cannula. Pressure was 100 systolic an hour ago.',
    background: 'PMH: HTN. Received 2L crystalloid intra-op. Blood cultures pending. Allergies: NKDA.',
  },
  durationLimitS: 1800,
  initialPatient: {
    id: 'pt-vasquez',
    demographics: { name: 'Elena Vasquez', age: 62, sex: 'F', weightKg: 70 },
    vitals: { hr: 98, rhythm: 'sinus', spo2: 95, rr: 21, map: 75, sbp: 103, dbp: 61, tempC: 38.3 },
    physiology: {
      ...PHYSIOLOGY_DEFAULTS,
      fio2: 0.36, // 4L NC equivalent TODO(MEDICAL)
      volumeStatus: 0.45,
      svr: 0.42,
      contractility: 0.7, // hyperdynamic early sepsis TODO(MEDICAL)
      shuntFraction: 0.12,
      respDrive: 0.6,
      perfusion: 0.7,
      tempSetC: 38.4,
      hrBaseline: 96,
      mapSetpoint: 75,
      // scenario-flavored lab anchors TODO(MEDICAL)
      wbcAnchor: 16.5,
      lactateAnchor: 2.2,
      hgbAnchor: 11.8,
      kAnchor: 4.3,
      crAnchor: 1.5,
      tropAnchor: 0.02,
    },
    exam: {
      head: { inspect: 'Flushed, anxious. Answers in short sentences.' },
      abdomen: {
        inspect: 'Midline dressing clean; abdomen distended.',
        palpate: 'Diffusely tender, worse in the LLQ.',
        auscultateText: 'Sparse bowel sounds.',
      },
      chest_left: { auscultateText: 'Few basilar crackles.' },
      chest_right: { auscultateText: 'Clear breath sounds.' },
      leg_left: { palpate: 'Warm; brisk pulses.' },
      leg_right: { palpate: 'Warm; brisk pulses.' },
    },
    us: {
      // hyperdynamic, underfilled heart + collapsing IVC + scattered B-lines
      plax: { kind: 'cardiac', contractility: 0.85, lvScale: 0.8, rvScale: 0.9, effusion: 0 },
      psax: { kind: 'cardiac', contractility: 0.85, lvScale: 0.8, rvScale: 0.9, effusion: 0 },
      a4c: { kind: 'cardiac', contractility: 0.85, lvScale: 0.8, rvScale: 0.9, effusion: 0 },
      subxiphoid: { kind: 'cardiac', contractility: 0.85, lvScale: 0.8, rvScale: 0.9, effusion: 0 },
      ivc: { kind: 'ivc', diameterCm: 1.0, collapse: 0.75 },
      lung_ant_l: { kind: 'lung', sliding: true, bLines: 2, effusion: 0 },
      lung_ant_r: { kind: 'lung', sliding: true, bLines: 1, effusion: 0 },
      lung_post_l: { kind: 'lung', sliding: true, bLines: 3, effusion: 0.15 },
      lung_post_r: { kind: 'lung', sliding: true, bLines: 3, effusion: 0 },
    },
    lines: [{ id: 'piv-1', type: 'piv', site: 'R forearm', placedAt: -21600 }],
    devices: {
      monitor: { nibpIntervalMin: 5, alarmLimits: STANDARD_ALARM_LIMITS },
      // vent pre-set by RT and standing by — intubation connects it
      vent: { connected: false, standby: true, mode: 'VC', setRr: 18, setVtMl: 420, peep: 8, fio2: 1.0 },
      pumps: emptyPumps(2),
    },
  },
  scriptedEvents: [
    {
      id: 'intro',
      at: 20,
      actions: [
        { type: 'nurseSay', text: "She's been running warm all night. Pressure was 100 an hour ago — cuff is cycling q5." },
      ],
    },
    {
      id: 'sepsis-onset',
      at: 90,
      label: 'She looks worse.',
      dropToRealtime: true,
      actions: [
        { type: 'rampPhysiology', param: 'svr', to: 0.26, overS: 240 },
        { type: 'rampPhysiology', param: 'volumeStatus', to: 0.32, overS: 240 },
        { type: 'rampPhysiology', param: 'perfusion', to: 0.5, overS: 240 },
        { type: 'rampPhysiology', param: 'tempSetC', to: 39.1, overS: 300 },
        { type: 'nurseSay', text: "Pressure's soft, doc." },
      ],
    },
    {
      id: 'nurse-prompt-pressor',
      when: { type: 'eventOccurred', eventType: 'AlarmRaised', where: { alarmId: 'monitor-map-lo' } },
      actions: [
        { type: 'nurseSay', text: 'Want me to hang fluids and pull up the norepi?' },
      ],
    },
    {
      id: 'sepsis-deepens',
      at: 420,
      actions: [
        { type: 'rampPhysiology', param: 'svr', to: 0.14, overS: 360 },
        { type: 'rampPhysiology', param: 'volumeStatus', to: 0.24, overS: 360 },
        { type: 'rampPhysiology', param: 'contractility', to: 0.5, overS: 360 },
      ],
    },
    {
      // steep enough that the sat breaks 90 before the 10-minute success
      // gate — an un-intubated patient cannot bank the sustained-SpO2 credit
      id: 'hypoxemia',
      at: 420,
      actions: [
        { type: 'rampPhysiology', param: 'shuntFraction', to: 0.55, overS: 240 },
        { type: 'setUsFinding', view: 'lung_ant_l', patch: { bLines: 5 } },
        { type: 'setUsFinding', view: 'lung_ant_r', patch: { bLines: 4 } },
        { type: 'setUsFinding', view: 'lung_post_l', patch: { bLines: 6, effusion: 0.25 } },
        {
          type: 'setExamFinding',
          zone: 'chest_left',
          patch: { auscultateText: 'Diffuse coarse crackles.' },
        },
        {
          type: 'setExamFinding',
          zone: 'chest_right',
          patch: { auscultateText: 'Coarse crackles to the mid-zones.' },
        },
        { type: 'nurseSay', text: 'Sats are drifting and she looks tired.' },
      ],
    },
    {
      id: 'mottling',
      when: { type: 'sustained', path: 'map', op: 'lt', value: 60, seconds: 120 },
      actions: [
        { type: 'setExamFinding', zone: 'leg_left', patch: { palpate: 'Cool, mottled to the knee; thready pulse.', inspect: 'Mottled shin.' } },
        { type: 'setExamFinding', zone: 'leg_right', patch: { palpate: 'Cool, mottled to the knee; thready pulse.', inspect: 'Mottled shin.' } },
        { type: 'nurseSay', text: "She's mottling at the knees." },
      ],
    },
    {
      id: 'tube-prompt',
      when: { type: 'sustained', path: 'spo2', op: 'lt', value: 88, seconds: 60 },
      actions: [{ type: 'nurseSay', text: "She's not keeping up — are we tubing her?" }],
    },
    {
      id: 'late-collapse',
      at: 960,
      actions: [
        { type: 'rampPhysiology', param: 'svr', to: 0.08, overS: 360 },
        { type: 'rampPhysiology', param: 'volumeStatus', to: 0.2, overS: 360 },
        { type: 'rampPhysiology', param: 'contractility', to: 0.45, overS: 360 },
        { type: 'rampPhysiology', param: 'perfusion', to: 0.35, overS: 360 },
      ],
    },
    {
      id: 'hypoxemia-2',
      at: 1050,
      actions: [{ type: 'rampPhysiology', param: 'shuntFraction', to: 0.62, overS: 300 }],
    },
  ],
  endConditions: [
    {
      id: 'death-shock',
      outcome: 'death',
      when: { type: 'sustained', path: 'map', op: 'lt', value: 40, seconds: 180 },
      summary: 'Refractory shock. The pressure never came back — fluids and vasopressors needed to move faster.',
    },
    {
      id: 'death-hypoxemia',
      outcome: 'death',
      when: { type: 'sustained', path: 'spo2', op: 'lt', value: 70, seconds: 180 },
      summary: 'Refractory hypoxemia. She needed an airway and a ventilator before the sat cratered.',
    },
    {
      id: 'stabilized',
      outcome: 'success',
      when: {
        type: 'and',
        conditions: [
          { type: 'elapsed', op: 'gt', seconds: 600 },
          // graceS: physiologic noise briefly dipping under a threshold must
          // not reset a 4-minute stability clock (TODO(MEDICAL): thresholds)
          { type: 'sustained', path: 'map', op: 'gte', value: 65, seconds: 240, graceS: 20 },
          { type: 'sustained', path: 'spo2', op: 'gte', value: 90, seconds: 240, graceS: 20 },
        ],
      },
      summary: 'Stabilized on vasopressors and mechanical ventilation. The unit exhales; the day team owes you a coffee.',
    },
  ],
  rubric: {
    items: [
      {
        id: 'lactate-ordered',
        label: 'Checked a lactate',
        detail: 'Any lactate order counts.',
        points: 8,
        condition: { type: 'eventOccurred', eventType: 'OrderPlaced', where: { 'order.panelId': 'lactate' } },
      },
      {
        id: 'early-fluids',
        label: 'Fluids within 5 min of the first MAP alarm',
        points: 12,
        condition: {
          type: 'eventWithin',
          eventType: 'OrderPlaced',
          where: { 'order.drugId': 'lactated-ringers' },
          afterEventType: 'AlarmRaised',
          afterWhere: { alarmId: 'monitor-map-lo' },
          windowS: 300,
        },
      },
      {
        id: 'early-pressor',
        label: 'Pressor running within 10 min of the first MAP alarm',
        points: 15,
        condition: {
          type: 'eventWithin',
          eventType: 'InfusionStarted',
          where: { 'infusion.drugId': 'norepinephrine' },
          afterEventType: 'AlarmRaised',
          afterWhere: { alarmId: 'monitor-map-lo' },
          windowS: 600,
        },
      },
      {
        id: 'intubated',
        label: 'Secured the airway',
        points: 12,
        condition: { type: 'eventOccurred', eventType: 'ProcedureCompleted', where: { procedureId: 'ett' } },
      },
      {
        id: 'ahead-of-airway',
        label: 'Never let the sat hit crisis (<85)',
        detail: 'Stretch goal — tube early, before the cliff.',
        points: 8,
        condition: { type: 'never', eventType: 'AlarmRaised', where: { alarmId: 'monitor-spo2-crisis-lo' } },
      },
      {
        id: 'scanned-ivc',
        label: 'Looked at the IVC with ultrasound',
        points: 5,
        condition: { type: 'eventOccurred', eventType: 'UsViewChanged', where: { view: 'ivc' } },
      },
      {
        id: 'sterile',
        label: 'Kept sterile fields sterile',
        points: 5,
        condition: { type: 'never', eventType: 'SterileFieldContaminated' },
      },
      {
        id: 'survived',
        label: 'Patient stabilized',
        points: 25,
        condition: { type: 'outcome', outcome: 'success' },
      },
    ],
  },
});
