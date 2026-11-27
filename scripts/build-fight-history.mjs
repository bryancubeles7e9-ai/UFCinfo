// Builds assets/data/fight-history.json: every completed UFC bout UFCinfo has recorded, kept forever.
// The events feed only covers the current season; this file keeps earlier seasons, so each
// fighter's "recent form" (last results and streak) keeps growing instead of resetting each year.
// Existing entries are never removed: new results are merged in.
// Usage: node scripts/build-fight-history.mjs          (writes the file)
//        node scripts/build-fight-history.mjs --check  (fails if a completed result is missing)
import { readFileSync, writeFileSync } from 'node:fs';
import { boutResult } from './fight-results.mjs';

const target = new URL('../assets/data/fight-history.json', import.meta.url);
const feed = JSON.parse(readFileSync(new URL('../assets/data/ufc-events.json', import.meta.url)));
let previous = { schemaVersion: 1, bouts: [] };
try { previous = JSON.parse(readFileSync(target, 'utf8')); } catch { /* First run. */ }

const key = bout => `${bout.event}|${bout.red}|${bout.blue}`;

const merged = new Map(previous.bouts.map(bout => [key(bout), bout]));
for (const event of feed.events) {
  if (event.status !== 'completed' || event.type !== 'official') continue;
  for (const bout of event.bouts || []) {
    const result = boutResult(bout);
    if (!result) continue;
    const entry = { date: event.date, event: event.id, title: event.title, red: bout.red, blue: bout.blue, result,
      method: bout.method || null, round: bout.round || null };
    merged.set(key(entry), entry);
  }
}
const bouts = [...merged.values()].sort((a, b) => b.date.localeCompare(a.date) || key(a).localeCompare(key(b)));
// One bout per line: small file, readable diffs when new results arrive.
const output = '{"schemaVersion":1,"source":"UFC","bouts":[\n' + bouts.map(bout => JSON.stringify(bout)).join(',\n') + '\n]}\n';

if (process.argv.includes('--check')) {
  let current = '';
  try { current = readFileSync(target, 'utf8'); } catch {}
  if (current !== output) { console.error('assets/data/fight-history.json está desactualizado: ejecuta node scripts/build-fight-history.mjs'); process.exit(1); }
  console.log(`PASS: historial de combates al día (${bouts.length} combates)`);
} else {
  writeFileSync(target, output);
  console.log(`Historial de combates: ${bouts.length} combates (${bouts.length - previous.bouts.length} nuevos)`);
}
