/**
 * Schema-check content files with readable errors.
 *
 *   npm run validate -- content/scenarios/foo.json [more files...]
 *
 * Files named interventions*.json are checked against the catalog schema;
 * everything else against the scenario schema.
 */
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { ContentValidationError, parseCatalog, parseScenario } from '../sim/schema'

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('Usage: npm run validate -- <content file> [more files...]')
  process.exit(2)
}

let failed = false
for (const file of files) {
  try {
    const raw: unknown = JSON.parse(readFileSync(file, 'utf8'))
    if (basename(file).startsWith('interventions')) {
      const catalog = parseCatalog(raw, file)
      console.log(`OK  ${file} — catalog, ${catalog.interventions.length} interventions`)
    } else {
      const scenario = parseScenario(raw, file)
      console.log(`OK  ${file} — scenario "${scenario.title}"`)
    }
  } catch (err) {
    failed = true
    if (err instanceof ContentValidationError) {
      console.error(`FAIL ${err.message}\n`)
    } else if (err instanceof SyntaxError) {
      console.error(`FAIL ${file} is not valid JSON:\n  ${err.message}\n`)
    } else {
      console.error(`FAIL ${file}: ${String(err)}\n`)
    }
  }
}
process.exit(failed ? 1 : 0)
