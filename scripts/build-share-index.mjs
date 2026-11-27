// Builds assets/data/share-index.json: title, description and photo for every shareable address.
// Usage: node scripts/build-share-index.mjs          (writes the file)
//        node scripts/build-share-index.mjs --check  (fails if the file is out of date)
import { readFileSync, writeFileSync } from 'node:fs';
globalThis.localStorage ??= { getItem() {}, setItem() {} };
const { directoryFighters } = await import('../assets/js/fighter-directory.js');
const { fullName } = await import('../assets/js/data.js');
const { fighterPath, eventPath, rankingPath } = await import('../assets/js/share-paths.js');
const { rankingCategories } = await import('../assets/js/rankings.js');
const { directoryFighterByName } = await import('../assets/js/fighter-directory.js');
const { boutDivisionLabel } = await import('../assets/js/utils.js');

const target = new URL('../assets/data/share-index.json', import.meta.url);
const feed = JSON.parse(readFileSync(new URL('../assets/data/ufc-events.json', import.meta.url)));
const { setLanguage, translate } = await import('../assets/js/i18n.js');
const { formatLocation } = await import('../assets/js/utils.js');
const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
const locales = { es: 'es-ES', en: 'en-US', ca: 'ca-ES' };
const day = (iso, lang) => {
  const d = new Date(iso);
  if (lang === 'es') return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  return d.toLocaleDateString(locales[lang], { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};
// Previews are written in Spanish, English and Catalan; the server picks one with ?lang=en|ca.
const copy = {
  es: { record: 'récord', legend: ' Leyenda retirada.', fighterEnd: 'Ficha, estadísticas, historial y próximos combates en UFCinfo.',
    main: 'Combate estelar', cardEnd: done => `Cartelera${done ? ', resultados' : ''} y horarios en UFCinfo.`,
    rankingTitle: 'Ranking UFC', top: 'Top 15 oficial de UFC', champion: 'Campeón', championWoman: 'Campeona', rankingEnd: 'Consulta el ranking completo en UFCinfo.' },
  en: { record: 'record', legend: ' Retired legend.', fighterEnd: 'Profile, stats, fight history and upcoming bouts on UFCinfo.',
    main: 'Main event', cardEnd: done => `Fight card${done ? ', results' : ''} and times on UFCinfo.`,
    rankingTitle: 'UFC rankings', top: 'Official UFC top 15', champion: 'Champion', championWoman: 'Champion', rankingEnd: 'See the full ranking on UFCinfo.' },
  ca: { record: 'rècord', legend: ' Llegenda retirada.', fighterEnd: 'Fitxa, estadístiques, historial i propers combats a UFCinfo.',
    main: 'Combat estel·lar', cardEnd: done => `Cartellera${done ? ', resultats' : ''} i horaris a UFCinfo.`,
    rankingTitle: 'Rànquing UFC', top: 'Top 15 oficial d’UFC', champion: 'Campió', championWoman: 'Campiona', rankingEnd: 'Consulta el rànquing complet a UFCinfo.' },
};
const inLanguages = build => {
  const result = {};
  for (const lang of ['es', 'en', 'ca']) { setLanguage(lang); result[lang] = build(lang, copy[lang]); }
  setLanguage('es');
  return result;
};
const localized = ({ es, en, ca }) => ({ ...es, en: { title: en.title, description: en.description }, ca: { title: ca.title, description: ca.description } });

const fighters = {};
for (const f of directoryFighters) {
  const name = fullName(f);
  const retired = f.legend && f.careerStatus === 'retired';
  fighters[fighterPath(f).split('/').pop()] = localized(inLanguages((lang, t) => {
    const facts = [f.division && translate(f.division), f.record && f.record !== 'No indicado' ? `${t.record} ${f.record}` : null].filter(Boolean).join(' · ');
    return {
      id: f.id, title: `${name}${f.nickname ? ` «${f.nickname}»` : ''} — UFCinfo`,
      description: `${name}${facts ? `: ${facts}` : ''}.${retired ? t.legend : ''} ${t.fighterEnd}`,
      image: f.image && !/placeholder/.test(f.image) ? f.image : null,
    };
  }));
}
const events = {};
// Past seasons from the archive have their own addresses too (/carteleras/ufc-320).
let archived = [];
try { archived = Object.values(JSON.parse(readFileSync(new URL('../assets/data/ufc-events-archive.json', import.meta.url))).seasons || {}).flatMap(season => season.events || []); } catch { /* No archive yet. */ }
const currentIds = new Set(feed.events.map(e => e.id));
for (const e of [...feed.events, ...archived.filter(e => !currentIds.has(e.id))].filter(e => e.type === 'official' && !['cancelled', 'postponed'].includes(e.status))) {
  const main = e.bouts?.[0];
  events[eventPath(e).split('/').pop()] = localized(inLanguages((lang, t) => ({
    id: e.id, title: `${e.title}: ${e.subtitle} — UFCinfo`,
    description: `${e.title} · ${day(e.date, lang)} · ${formatLocation(e.location)}.${main ? ` ${t.main}: ${main.red} vs ${main.blue} (${translate(boutDivisionLabel(main.division)).toLowerCase()}).` : ''} ${t.cardEnd(e.status === 'completed')}`,
    image: e.poster || null,
  })));
}
const rankingFeed = JSON.parse(readFileSync(new URL('../assets/data/ufc-rankings.json', import.meta.url)));
const rankings = {};
for (const category of rankingCategories) {
  const current = rankingFeed.categories.find(c => c.id === category.id) || category;
  const top = current.names.slice(0, 3).map((name, i) => `${current.ranks?.[i] ?? i + 1}. ${name}`).join(', ');
  const face = directoryFighterByName(current.champion || current.names[0]);
  rankings[rankingPath(category).split('/').pop()] = localized(inLanguages((lang, t) => {
    const label = translate(category.label);
    return {
      id: category.id, title: `${t.rankingTitle} · ${label} — UFCinfo`,
      description: `${t.top}: ${label.replace(' · ', ', ').toLowerCase()}.${current.champion ? ` ${category.id.endsWith('-women') ? t.championWoman : t.champion}: ${current.champion}.` : ''} ${top}. ${t.rankingEnd}`,
      image: face?.image && !/placeholder/.test(face.image) ? face.image : null,
    };
  }));
}
const output = JSON.stringify({ fighters, events, rankings }, null, 1) + '\n';
if (process.argv.includes('--check')) {
  let current = '';
  try { current = readFileSync(target, 'utf8'); } catch {}
  if (current !== output) { console.error('assets/data/share-index.json está desactualizado: ejecuta node scripts/build-share-index.mjs'); process.exit(1); }
  console.log(`PASS: índice para compartir al día (${Object.keys(fighters).length} luchadores, ${Object.keys(events).length} veladas, ${Object.keys(rankings).length} rankings)`);
} else {
  writeFileSync(target, output);
  console.log(`Índice para compartir: ${Object.keys(fighters).length} luchadores, ${Object.keys(events).length} veladas, ${Object.keys(rankings).length} rankings`);
}
