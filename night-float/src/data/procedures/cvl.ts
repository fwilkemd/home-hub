import { defineProcedure } from '../../contracts/content';

/**
 * Central line (US-guided) — TODO(MEDICAL): placeholder step list; real
 * technique, checks and complication rates come from the medical pass.
 */
export const cvl = defineProcedure({
  id: 'cvl',
  name: 'Central venous line',
  todoMedical:
    'Real CVL: site selection tradeoffs, full Seldinger step list with confirmations (manometry, wire depth), true complication rates (PTX, arterial cannulation, CLABSI risk from breaks).',
  requiredTool: 'cvl_kit',
  kitLabel: 'Central line kit',
  siteOptions: ['R IJ', 'L IJ', 'R subclavian', 'R femoral'],
  positioningNote: 'Slight Trendelenburg, head turned away from the site.',
  sterile: true,
  steps: [
    {
      id: 'position',
      prompt: 'Position the patient and drop the bed rail.',
      interaction: 'click',
    },
    {
      id: 'prep_drape',
      prompt: 'Chlorhexidine prep and full-body drape.',
      interaction: 'click_hold',
      holdS: 2,
      skippable: true,
      skipConsequenceNote: 'Skipping prep risks line infection (medical-pass hook).',
    },
    {
      id: 'gown_glove',
      prompt: 'Gown and glove — the field is now sterile.',
      interaction: 'click_hold',
      holdS: 2,
      skippable: true,
      skipConsequenceNote: 'No sterile field: contamination is guaranteed.',
    },
    {
      id: 'us_align',
      prompt: 'Find the vein on ultrasound and line up the needle.',
      detail: 'Compressible vessel = vein. Keep the target centered.',
      tool: 'us_probe',
      interaction: 'align_hold',
      holdS: 2.5,
      overlay: 'us_procedural',
      skippable: true,
      skipConsequenceNote: 'Landmark-only puncture multiplies arterial risk.',
    },
    {
      id: 'needle',
      prompt: 'Advance the needle with negative pressure until flash.',
      interaction: 'click_hold',
      holdS: 1.5,
      overlay: 'us_procedural',
      complications: [
        {
          id: 'arterial_puncture',
          label: 'Arterial puncture — pulsatile flash',
          baseProb: 0.03, // placeholder
          probIfSkipped: [{ stepId: 'us_align', mult: 8 }],
          effects: [
            {
              type: 'setExamFinding',
              zone: 'neck',
              patch: { inspect: 'Expanding hematoma at the insertion site.' },
            },
          ],
        },
      ],
    },
    {
      id: 'wire',
      prompt: 'Thread the guidewire — watch the monitor for ectopy.',
      interaction: 'slider',
      complications: [
        {
          id: 'wire_ectopy',
          label: 'Wire-induced ectopy',
          baseProb: 0.08, // placeholder; transient — medical pass decides effects
          effects: [],
        },
      ],
    },
    { id: 'dilate', prompt: 'Nick the skin and pass the dilator.', interaction: 'click_hold', holdS: 1.5 },
    { id: 'thread', prompt: 'Thread the catheter over the wire; withdraw the wire.', interaction: 'slider' },
    { id: 'suture', prompt: 'Suture the line and dress the site.', interaction: 'click_hold', holdS: 1.5 },
  ],
  completionEffects: [
    { type: 'addLine', lineType: 'cvc', site: '$site' },
    // CVP appears on the monitor automatically once the cvc line exists.
  ],
});
