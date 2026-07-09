import { defineProcedure } from '../../contracts/content';

/**
 * Radial arterial line — TODO(MEDICAL): placeholder step list. The payoff is
 * the arterial waveform appearing live on the monitor (params mapping keys
 * off the line).
 */
export const aline = defineProcedure({
  id: 'aline',
  name: 'Arterial line',
  todoMedical:
    'Real a-line: Allen test / collateral flow check, transducer leveling + zeroing, real failure modes (posterior wall, vasospasm, positional damping).',
  requiredTool: 'aline_kit',
  kitLabel: 'Arterial line kit',
  siteOptions: ['L radial', 'R radial'],
  positioningNote: 'Wrist dorsiflexed over a towel roll, arm board taped.',
  sterile: false,
  steps: [
    { id: 'position', prompt: 'Extend the wrist over a roll and tape it down.', interaction: 'click' },
    { id: 'prep', prompt: 'Prep the site.', interaction: 'click_hold', holdS: 1.5 },
    {
      id: 'palpate',
      prompt: 'Palpate the pulse and set your angle.',
      interaction: 'align_hold',
      holdS: 2,
      skippable: true,
      skipConsequenceNote: 'Blind sticks miss more (medical-pass hook).',
    },
    {
      id: 'puncture',
      prompt: 'Advance at 30-45 degrees until bright red flash.',
      interaction: 'click_hold',
      holdS: 1.5,
      complications: [
        {
          id: 'posterior_wall',
          label: 'Through-and-through — lost the flash',
          baseProb: 0.08, // placeholder
          probIfSkipped: [{ stepId: 'palpate', mult: 3 }],
          effects: [],
        },
      ],
    },
    { id: 'advance', prompt: 'Drop the angle, advance the catheter, connect the tubing.', interaction: 'slider' },
    { id: 'secure', prompt: 'Secure the line and zero the transducer.', interaction: 'click_hold', holdS: 1.5 },
  ],
  completionEffects: [{ type: 'addLine', lineType: 'aline', site: '$site' }],
});
