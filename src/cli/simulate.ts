/**
 * Run a scenario headless, optionally applying a scripted action list, and
 * print a minute-by-minute vitals table, every event fired, and the endpoint.
 *
 *   npm run simulate -- content/scenarios/foo.json \
 *       [--actions actions.json] [--seed 42] [--catalog content/interventions.json] \
 *       [--maxSec 1800] [--json]
 *
 * actions.json: [{ "atSec": 120, "order": "pressor-a-low" },
 *                { "atSec": 900, "stop": "pressor-a-low" }]
 * ("stop" stops the most recent running infusion of that intervention id.)
 */
import { readFileSync } from 'node:fs'
import { SimEngine } from '../sim/engine'
import { ContentValidationError, parseCatalog, parseScenario } from '../sim/schema'

interface ScriptedAction {
  atSec: number
  order?: string
  stop?: string
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const scenarioFile = process.argv[2]
if (!scenarioFile || scenarioFile.startsWith('--')) {
  console.error('Usage: npm run simulate -- <scenario.json> [--actions a.json] [--seed N] [--json]')
  process.exit(2)
}

try {
  const scenario = parseScenario(JSON.parse(readFileSync(scenarioFile, 'utf8')), scenarioFile)
  const catalogFile = arg('catalog') ?? 'content/interventions.json'
  const catalog = parseCatalog(JSON.parse(readFileSync(catalogFile, 'utf8')), catalogFile)
  const seed = Number(arg('seed') ?? 1)
  const maxSec = Number(arg('maxSec') ?? scenario.timeLimitSec ?? 1800)

  const actions: ScriptedAction[] = arg('actions')
    ? (JSON.parse(readFileSync(arg('actions')!, 'utf8')) as ScriptedAction[])
    : []
  actions.sort((a, b) => a.atSec - b.atSec)

  const engine = new SimEngine(scenario, catalog, { seed })
  let next = 0

  for (let t = 0; t < maxSec && !engine.ended; t++) {
    while (next < actions.length && actions[next]!.atSec <= engine.time) {
      const a = actions[next++]!
      if (a.order) {
        const r = engine.order(a.order)
        if (!r.ok && r.missing) {
          console.log(`t=${engine.time}s  ORDER REJECTED ${a.order} — missing tags: ${r.missing.join(', ')}`)
        }
      } else if (a.stop) {
        const inf = engine.activeInfusions().filter((i) => i.interventionId === a.stop).at(-1)
        if (inf) engine.stopInfusion(inf.orderNo)
        else console.log(`t=${engine.time}s  STOP IGNORED — no running infusion of ${a.stop}`)
      }
    }
    engine.tick()
  }

  if (arg('json') !== undefined || process.argv.includes('--json')) {
    console.log(JSON.stringify(engine.exportSession(), null, 2))
    process.exit(0)
  }

  console.log(`\n${scenario.title}  (seed ${seed})\n`)
  console.log('  min |    hr |  sbp/dbp  (map) | spo2 |  rr | temp | rhythm')
  console.log('  ----+-------+-----------------+------+-----+------+--------')
  for (const s of engine.history) {
    if (s.t % 60 !== 0) continue
    const v = s.values
    const f = (x: number | undefined, w: number, d = 0) => (x ?? NaN).toFixed(d).padStart(w)
    console.log(
      `  ${String(s.t / 60).padStart(3)} | ${f(v.hr, 5)} | ${f(v.sbp, 5)}/${f(v.dbp, 3)} (${f(v.map, 4)}) | ${f(v.spo2, 4)} | ${f(v.rr, 3)} | ${f(v.tempC, 4, 1)} | ${s.rhythm}`,
    )
  }

  const interesting = engine.log.filter((l) =>
    ['order', 'orderRejected', 'orderActive', 'infusionStopped', 'message', 'result', 'event', 'alarmStart', 'alarmEnd', 'endpoint'].includes(l.type),
  )
  console.log('\nTimeline:')
  for (const l of interesting) {
    const mm = String(Math.floor(l.t / 60)).padStart(2, '0')
    const ss = String(l.t % 60).padStart(2, '0')
    console.log(`  ${mm}:${ss}  [${l.type}] ${l.type === 'message' ? `${l.ref}: ` : ''}${l.text}`)
  }

  console.log(
    engine.ended
      ? `\nEndpoint: ${engine.ended.kind.toUpperCase()} — ${engine.ended.label} at ${Math.floor(engine.ended.atSec / 60)}m${engine.ended.atSec % 60}s\n`
      : `\nNo endpoint reached in ${maxSec}s.\n`,
  )
} catch (err) {
  console.error(err instanceof ContentValidationError ? err.message : err)
  process.exit(1)
}
