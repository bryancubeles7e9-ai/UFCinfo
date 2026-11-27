// "Forma reciente": each fighter's last results and current streak, from assets/data/fight-history.json
// (every completed bout UFCinfo has recorded, kept across seasons by scripts/build-fight-history.mjs).
import { escapeHTML as esc } from './utils.js';
import { getLanguage } from './i18n.js';
import { directoryFighterByName, normalizeFighterName } from './fighter-directory.js';
import { fullName } from './data.js';

let byFighter = null;
let firstYear = 2026;
let loading = null;

// Index the bouts by fighter (directory id when known, otherwise the normalized name).
export function indexHistory(bouts, resolve = directoryFighterByName) {
  const index = new Map();
  const keyOf = name => resolve(name)?.id || `name:${normalizeFighterName(name)}`;
  for (const bout of bouts) {
    for (const [side, opponent] of [['red', 'blue'], ['blue', 'red']]) {
      const result = bout.result === 'draw' ? 'D' : bout.result === 'nc' ? 'NC' : bout.result === side ? 'W' : 'L';
      const key = keyOf(bout[side]);
      if (!index.has(key)) index.set(key, []);
      index.get(key).push({ result, opponent: bout[opponent], date: bout.date, event: bout.event, title: bout.title, method: bout.method, round: bout.round });
    }
  }
  for (const list of index.values()) list.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return index;
}

export function useHistory(bouts) {
  byFighter = indexHistory(bouts);
  const years = bouts.map(bout => new Date(bout.date).getUTCFullYear()).filter(Number.isFinite);
  if (years.length) firstYear = Math.min(...years);
}
export const historyReady = () => byFighter !== null;

export function loadFightHistory() {
  loading ??= fetch(new URL('../data/fight-history.json', import.meta.url), { cache: 'no-cache' })
    .then(response => (response.ok ? response.json() : null))
    .then(feed => { if (feed?.schemaVersion === 1 && Array.isArray(feed.bouts)) useHistory(feed.bouts); return historyReady(); })
    .catch(() => false);
  return loading;
}

// Last results (most recent first). `before` leaves out that bout and later ones (form going into a fight).
export function recentForm(fighter, { before = null, limit = 5 } = {}) {
  if (!byFighter || !fighter) return [];
  const list = byFighter.get(fighter.id) || byFighter.get(`name:${normalizeFighterName(fullName(fighter))}`) || [];
  const cutoff = before ? Date.parse(before) : Infinity;
  return list.filter(item => Date.parse(item.date) < cutoff).slice(0, limit);
}

// Consecutive wins or losses counting back from the latest result; draws and no contests end it.
export function currentStreak(form) {
  const first = form[0]?.result;
  if (first !== 'W' && first !== 'L') return null;
  let count = 0;
  for (const item of form) { if (item.result !== first) break; count++; }
  return { result: first, count };
}

const words = {
  es: { W: ['V', 'Victoria'], L: ['D', 'Derrota'], D: ['E', 'Empate'], NC: ['SR', 'Sin resultado'], vs: 'ante', label: 'Forma reciente', none: 'Sin combates registrados en UFCinfo todavía.',
    streak: (r, n) => `Racha: ${n} ${r === 'W' ? (n === 1 ? 'victoria' : 'victorias') : (n === 1 ? 'derrota' : 'derrotas')}`,
    note: year => `Combates registrados en UFCinfo desde ${year}; la trayectoria completa está en su perfil oficial de UFC.` },
  en: { W: ['W', 'Win'], L: ['L', 'Loss'], D: ['D', 'Draw'], NC: ['NC', 'No contest'], vs: 'vs', label: 'Recent form', none: 'No bouts recorded on UFCinfo yet.',
    streak: (r, n) => `Streak: ${n} ${r === 'W' ? (n === 1 ? 'win' : 'wins') : (n === 1 ? 'loss' : 'losses')}`,
    note: year => `Bouts recorded on UFCinfo since ${year}; the full career is on their official UFC profile.` },
  ca: { W: ['V', 'Victòria'], L: ['D', 'Derrota'], D: ['E', 'Empat'], NC: ['SR', 'Sense resultat'], vs: 'contra', label: 'Forma recent', none: 'Encara no hi ha combats registrats a UFCinfo.',
    streak: (r, n) => `Ratxa: ${n} ${r === 'W' ? (n === 1 ? 'victòria' : 'victòries') : (n === 1 ? 'derrota' : 'derrotes')}`,
    note: year => `Combats registrats a UFCinfo des del ${year}; la trajectòria completa és al seu perfil oficial d’UFC.` },
};
const text = () => words[getLanguage()] || words.es;
const className = { W: 'is-win', L: 'is-loss', D: 'is-draw', NC: 'is-nc' };

// Compact chips, newest on the left: «V V D V E».
export function formChips(form, { compact = false } = {}) {
  if (!form.length) return '';
  const t = text();
  const summary = form.map(item => t[item.result][1]).join(', ');
  return `<ol class="form-chips${compact ? ' is-compact' : ''}" aria-label="${esc(`${t.label}: ${summary}`)}" translate="no">${form.map(item =>
    `<li class="${className[item.result]}" title="${esc(`${t[item.result][1]} ${t.vs} ${item.opponent} · ${item.title}`)}">${t[item.result][0]}</li>`).join('')}</ol>`;
}

// Profile block: chips, streak and where the data comes from.
export function recentFormSection(fighter) {
  if (!historyReady()) return '';
  const t = text();
  const form = recentForm(fighter);
  const streak = currentStreak(form);
  return `<section class="recent-form" translate="no"><h3>${t.label}</h3>${form.length
    ? `${formChips(form)}${streak && streak.count > 1 ? `<p class="recent-form-streak ${className[streak.result]}">${esc(t.streak(streak.result, streak.count))}</p>` : ''}`
    : `<p class="data-note">${t.none}</p>`}<p class="data-note">${t.note(firstYear)}</p></section>`;
}
