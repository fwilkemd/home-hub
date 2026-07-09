# Content authoring handoff

This directory is yours. The engine (`/src`) contains zero clinical
knowledge — everything the simulator knows about medicine comes from these
JSON files. You never need to touch `/src`.

## What you own

- `interventions.json` — the orderable catalog (meds, fluids, procedures,
  labs, imaging). The order panel's tabs are generated from the `category`
  values you use.
- `scenarios/*.json` — one file per scenario. Every scenario file in this
  folder automatically appears in the in-app scenario picker.

## The contract

Formal JSON Schemas (generate with `npm run schema:export`, output in
`/schema`):

- `schema/scenario.schema.json`
- `schema/interventions.schema.json`

The two bundled files are worked examples: `scenarios/demo-placeholder.json`
exercises drift, custom vars, exam findings, alarms, events, endpoints, and
gated orders; `scenarios/demo-stable.json` shows NIBP cycling
(`arterialLine: false`) and a timeout ending. Their values are deliberately
medically nonsensical.

Key ideas:

- **Vitals drift** toward `drift.<var>.setpoint` at `ratePerMin`.
- **Effects** are piecewise-linear envelopes: zero until `onsetSec`, ramp to
  `delta` at `peakSec`, hold for `durationSec` (from onset), then decay over
  `decaySec`. Infusions hold until stopped. Effects sum.
- **`requires` / `grants`** are opaque tags. An `action` intervention can
  grant a tag (e.g. placing access) that other orders require. The engine
  only checks tags.
- **Triggers** support `<, <=, >, >=, ==`, `sustainSec` (must hold that many
  consecutive seconds), and `{ "all": [...] }` compounds. `var: "rhythm"`
  compares tokens: `sinus | afib | svt | vt | vf | asystole`.
- **Exam findings** per region: first match wins; put the default (no
  `when`) last.
- **`{{var}}`** in a lab/imaging `resultText` reads the sim value at result
  time.

## Test without a headset

```sh
# schema check with readable errors
npm run validate -- content/scenarios/my-scenario.json content/interventions.json

# run it headless: minute-by-minute vitals, timeline, endpoint
npm run simulate -- content/scenarios/my-scenario.json --seed 5

# apply a scripted action list
npm run simulate -- content/scenarios/my-scenario.json --actions actions.json
```

`actions.json`:

```json
[
  { "atSec": 30, "order": "place-central-line" },
  { "atSec": 140, "order": "pressor-a-high" },
  { "atSec": 900, "stop": "pressor-a-high" }
]
```

Runs are deterministic for a given `--seed`, so a scenario that behaves under
`simulate` behaves identically in the headset.

The debrief page's **Export session log** button produces a JSON file of a
user's full run (orders, events, vitals history) — designed to be handed back
to you for a clinical debrief of their decisions.
