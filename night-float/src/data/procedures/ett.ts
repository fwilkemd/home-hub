import { defineProcedure } from '../../contracts/content';

/**
 * Endotracheal intubation — TODO(MEDICAL): placeholder step list. Completion
 * connects the vent circuit (EtCO2 appears via the respiratory stub once the
 * ETT exists).
 */
export const ett = defineProcedure({
  id: 'ett',
  name: 'Endotracheal intubation',
  todoMedical:
    'Real RSI: induction + paralysis sequencing, preoxygenation targets, laryngoscopy grades, tube depth by height, waveform capnography confirmation, failed-airway algorithm.',
  requiredTool: 'ett_kit',
  kitLabel: 'Intubation kit',
  siteOptions: ['oral'],
  positioningNote: 'Sniffing position, bed to sternum height, suction on.',
  sterile: false,
  steps: [
    { id: 'position', prompt: 'Sniffing position — align the axes.', interaction: 'click' },
    {
      id: 'preoxygenate',
      prompt: 'Preoxygenate with high-flow O2.',
      detail: 'Buy apnea time before you take the breath away.',
      interaction: 'click_hold',
      holdS: 3,
      skippable: true,
      skipConsequenceNote: 'Skipping preoxygenation shortens safe apnea time.',
      effects: [
        // placeholder oxygen reserve bump while the attempt happens
        { type: 'setPhysiology', param: 'fio2', value: 0.9 },
      ],
    },
    {
      id: 'laryngoscopy',
      prompt: 'Sweep the tongue and lift — visualize the cords.',
      tool: 'laryngoscope',
      interaction: 'align_hold',
      holdS: 2.5,
      overlay: 'laryngoscopy',
    },
    {
      id: 'tube',
      prompt: 'Pass the tube through the cords to depth.',
      interaction: 'slider',
      overlay: 'laryngoscopy',
      complications: [
        {
          id: 'right_mainstem',
          label: 'Tube deep — right mainstem',
          baseProb: 0.05, // placeholder
          probIfSkipped: [{ stepId: 'laryngoscopy', mult: 4 }],
          effects: [
            {
              type: 'setExamFinding',
              zone: 'chest_left',
              patch: {
                auscultateText: 'Diminished breath sounds on the left.',
                auscultation: {
                  heartMurmur: 0,
                  heartMuffled: 0,
                  lungRecipe: 'diminished',
                  lungIntensity: 0.6,
                },
              },
            },
          ],
        },
      ],
    },
    {
      id: 'confirm',
      prompt: 'Inflate the cuff, bag, confirm EtCO2 and bilateral rise.',
      interaction: 'click',
    },
  ],
  completionEffects: [
    { type: 'addLine', lineType: 'ett', site: '$site' },
    // connecting the circuit clears vent standby; EtCO2 + capno follow the
    // ETT. Explicit post-intubation settings (start at 100% and titrate down)
    // because a zod-parsed partial settings object always arrives fully
    // populated with schema defaults. TODO via todoMedical: Vt by ideal body
    // weight, initial rate by minute-ventilation need.
    {
      type: 'setVent',
      settings: { mode: 'VC', setRr: 18, setVtMl: 420, peep: 8, fio2: 1.0 },
      connect: true,
    },
  ],
});
