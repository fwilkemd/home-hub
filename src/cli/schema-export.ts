/**
 * Emit the content contract as JSON Schema files for the content author.
 *
 *   npm run schema:export        → writes schema/scenario.schema.json
 *                                          schema/interventions.schema.json
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { z } from 'zod'
import { CatalogSchema, ScenarioSchema } from '../sim/schema'

mkdirSync('schema', { recursive: true })

const targets = [
  { name: 'scenario', schema: ScenarioSchema },
  { name: 'interventions', schema: CatalogSchema },
] as const

for (const { name, schema } of targets) {
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' })
  const path = `schema/${name}.schema.json`
  writeFileSync(path, JSON.stringify(json, null, 2) + '\n')
  console.log(`wrote ${path}`)
}
