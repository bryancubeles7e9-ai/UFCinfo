// Builds assets/data/share-index.json: title, description and photo for every shareable address.
// Usage: node scripts/build-share-index.mjs          (writes the file)
//        node scripts/build-share-index.mjs --check  (fails if the file is out of date)
import { readFileSync, writeFileSync } from 'node:fs';
globalThis.localStorage ??= { getItem() {}, setItem() {} };
const { directoryFighters } = await import('../assets/js/fighter-directory.js');
const { fullName } = await import('../assets/js/data.js');
const { fighterPath, eventPath } = await import('../assets/js/share-paths.js');
const { boutDivisionLabel } = await import('../assets/js/utils.js');

const target = new URL('../assets/data/share-index.json', import.meta.url);
const feed = JSON.parse(readFileSync(new URL('../assets/data/ufc-events.json', import.meta.url)));
const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
const day = iso => { const d = new Date(iso); return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };

const fighters = {};
for (const f of directoryFighters) {
  const name = fullName(f);
  const facts = [f.division, f.record && f.record !== 'No indicado' ? `récord ${f.record}` : null].filter(Boolean).join(' · ');
  const legend = f.legend && f.careerStatus === 'retired' ? ' Leyenda retirada.' : '';
  fighters[fighterPath(f).split('/').pop()] = {
    id: f.id, title: `${name}${f.nickname ? ` «${f.nickname}»` : ''} — UFCinfo`,
    description: `${name}${facts ? `: ${facts}` : ''}.${legend} Ficha, estadísticas, historial y próximos combates en UFCinfo.`,
    image: f.image && !/placeholder/.test(f.image) ? f.image : null,
  };
}
const events = {};
for (const e of feed.events.filter(e => e.type === 'official' && !['cancelled', 'postponed'].includes(e.status))) {
  const main = e.bouts?.[0];
  events[eventPath(e).split('/').pop()] = {
    id: e.id, title: `${e.title}: ${e.subtitle} — UFCinfo`,
    description: `${e.title} · ${day(e.date)} · ${e.location}.${main ? ` Combate estelar: ${main.red} vs ${main.blue} (${boutDivisionLabel(main.division).toLowerCase()}).` : ''} Cartelera${e.status === 'completed' ? ', resultados' : ''} y horarios en UFCinfo.`,
    image: e.poster || null,
  };
}
const output = JSON.stringify({ fighters, events }, null, 1) + '\n';
if (process.argv.includes('--check')) {
  let current = '';
  try { current = readFileSync(target, 'utf8'); } catch {}
  if (current !== output) { console.error('assets/data/share-index.json está desactualizado: ejecuta node scripts/build-share-index.mjs'); process.exit(1); }
  console.log(`PASS: índice para compartir al día (${Object.keys(fighters).length} luchadores, ${Object.keys(events).length} veladas)`);
} else {
  writeFileSync(target, output);
  console.log(`Índice para compartir: ${Object.keys(fighters).length} luchadores, ${Object.keys(events).length} veladas`);
}
