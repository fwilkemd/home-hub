#!/usr/bin/env node
/**
 * npm run handoff — regenerates MEDICAL_HANDOFF.md (SPEC §17.5).
 * Combines the hand-written preamble (docs/handoff-preamble.md) with a
 * generated inventory of every TODO(MEDICAL) tag and content schema pointer.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx)$/.test(name)) yield p;
  }
}

const entries = [];
for (const file of walk(SRC)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const m = line.match(/TODO\(MEDICAL\)[:\s-]*(.*)/);
    if (m) {
      entries.push({
        file: relative(ROOT, file),
        line: i + 1,
        note: (m[1] || '').replace(/\*\/\s*$/, '').trim() || '(see surrounding code)',
      });
    }
  });
}

entries.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)));

const byFile = new Map();
for (const e of entries) {
  if (!byFile.has(e.file)) byFile.set(e.file, []);
  byFile.get(e.file).push(e);
}

let out = '';
const preamblePath = join(ROOT, 'docs', 'handoff-preamble.md');
if (existsSync(preamblePath)) {
  out += readFileSync(preamblePath, 'utf8').trimEnd() + '\n\n';
} else {
  out += '# MEDICAL_HANDOFF\n\n(Preamble missing — write docs/handoff-preamble.md.)\n\n';
}

out += '---\n\n## Generated TODO(MEDICAL) inventory\n\n';
out += `_${entries.length} tags across ${byFile.size} files. Regenerate with \`npm run handoff\`._\n\n`;
for (const [file, list] of byFile) {
  out += `### \`${file}\`\n\n`;
  for (const e of list) {
    out += `- **L${e.line}** — ${e.note}\n`;
  }
  out += '\n';
}

writeFileSync(join(ROOT, 'MEDICAL_HANDOFF.md'), out);
console.log(`MEDICAL_HANDOFF.md written: ${entries.length} TODO(MEDICAL) tags in ${byFile.size} files.`);
