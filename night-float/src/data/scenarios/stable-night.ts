import { defineScenario } from '../../contracts/content';
import { PHYSIOLOGY_DEFAULTS } from '../../contracts/patient';
import { STANDARD_ALARM_LIMITS, NORMAL_US, emptyPumps } from './base';

/**
 * Tutorial scenario (SPEC §5.5): a stable post-op patient and a guided lap of
 * the room — look/move, examine, order a lab, cycle an NIBP, speed up time
 * and read the result. Ends successfully after the checklist (or a quiet
 * 12 sim-minutes). All medicine placeholder.
 */
export const stableNight = defineScenario({
  id: 'stable-night',
  title: 'Stable Night',
  subtitle: 'Tutorial — learn the room',
  seed: 1123,
  clockStart: '03:00',
  briefing: {
    oneLiner: 'Post-op appendectomy, doing fine. Learn the room.',
    hpi: 'Mr. Okafor is a 46-year-old man, post-op day 1 after an uncomplicated laparoscopic appendectomy, admitted overnight for observation. Comfortable, afebrile, on room air.',
    background: 'No significant PMH. Home meds: none. Allergies: NKDA. Surgery ended 21:40; overnight orders are routine post-op care.',
  },
  durationLimitS: 1800, // hard backstop; the quiet-night end fires first
  initialPatient: {
    id: 'pt-okafor',
    demographics: { name: 'Daniel Okafor', age: 46, sex: 'M', weightKg: 82 },
    vitals: { hr: 74, rhythm: 'sinus', spo2: 97, rr: 14, map: 82, sbp: 118, dbp: 64, tempC: 36.9 },
    physiology: {
      ...PHYSIOLOGY_DEFAULTS,
      fio2: 0.21, // room air
      hrBaseline: 72,
      mapSetpoint: 80,
      // scenario-flavored lab anchors TODO(MEDICAL)
      wbcAnchor: 10.2,
      hgbAnchor: 13.1,
      lactateAnchor: 1.0,
    },
    exam: {
      head: { inspect: 'Awake, comfortable, watching the TV you turned off an hour ago.' },
      abdomen: {
        inspect: 'Three lap sites, dressings clean and dry.',
        palpate: 'Mild incisional tenderness, no rebound.',
        auscultateText: 'Quiet bowel sounds.',
      },
      chest_left: { auscultateText: 'Clear breath sounds.' },
      chest_right: { auscultateText: 'Clear breath sounds.' },
    },
    us: NORMAL_US,
    lines: [{ id: 'piv-1', type: 'piv', site: 'L forearm', placedAt: -14400 }],
    devices: {
      monitor: { nibpIntervalMin: 5, alarmLimits: STANDARD_ALARM_LIMITS },
      vent: { connected: false, standby: true },
      pumps: emptyPumps(2),
    },
  },
  scriptedEvents: [
    {
      id: 'intro',
      at: 12,
      actions: [
        { type: 'nurseSay', text: 'Quiet one so far, doc. Bed 2 is your post-op appy — take a look around.' },
      ],
    },
    {
      id: 'flavor-family',
      at: 420,
      actions: [{ type: 'notify', text: 'Front desk: family called for an update — no action needed.' }],
    },
  ],
  endConditions: [
    {
      id: 'tutorial-complete',
      outcome: 'success',
      when: {
        type: 'eventOccurred',
        eventType: 'ScenarioScriptedEvent',
        where: { scriptId: 'tutorial-results' },
      },
      summary: 'Checklist done — you know the room now. Next patient will not be this polite.',
    },
    {
      id: 'quiet-night',
      outcome: 'success',
      when: { type: 'elapsed', op: 'gt', seconds: 720 },
      summary: 'A genuinely quiet night. Take the win.',
    },
  ],
  rubric: {
    items: [
      {
        id: 'examined',
        label: 'Examined the patient',
        points: 5,
        condition: { type: 'eventOccurred', eventType: 'ExamPerformed' },
      },
      {
        id: 'ordered-lab',
        label: 'Ordered a lab from the workstation',
        points: 5,
        condition: { type: 'eventOccurred', eventType: 'LabOrdered' },
      },
      {
        id: 'cycled-nibp',
        label: 'Cycled an NIBP from the monitor',
        points: 5,
        condition: { type: 'eventOccurred', eventType: 'PlayerAction', where: { action: 'CycleNibp' } },
      },
      {
        id: 'finished',
        label: 'Finished the shift',
        points: 10,
        condition: { type: 'outcome', outcome: 'success' },
      },
    ],
  },
  tutorial: [
    {
      id: 'look',
      text: 'Look around with the mouse and walk to the bedside (WASD).',
      doneWhen: { type: 'elapsed', op: 'gt', seconds: 15 },
    },
    {
      id: 'examine',
      text: 'Examine the patient — press E on a body zone and pick an exam.',
      doneWhen: { type: 'eventOccurred', eventType: 'ExamPerformed' },
    },
    {
      id: 'order-lab',
      text: 'Open the workstation (Tab), go to Orders, and order a CBC.',
      doneWhen: { type: 'eventOccurred', eventType: 'OrderPlaced', where: { 'order.kind': 'lab' } },
    },
    {
      id: 'check-monitor',
      text: 'Walk to the monitor, open it (E), and cycle an NIBP.',
      doneWhen: { type: 'eventOccurred', eventType: 'PlayerAction', where: { action: 'CycleNibp' } },
    },
    {
      id: 'results',
      text: 'Speed time up (time controls) and check Results when the lab lands.',
      doneWhen: { type: 'eventOccurred', eventType: 'LabResulted' },
    },
  ],
});
