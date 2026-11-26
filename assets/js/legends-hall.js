// "Salón de leyendas": the Legends collection of the fighter catalogue, shown as a gallery
// with the official UFC Hall of Fame photos, wing filters and each legend's reviewed note.
import { escapeHTML as esc } from './utils.js';
import { fullName } from './data.js';

export const legendWings = { modern: 'Ala moderna', pioneer: 'Ala de pioneros', ufcinfo: 'Selección UFCinfo' };
export const legendWing = fighter => fighter.hallOfFame?.wing || 'ufcinfo';

// UFCinfo's selection of recent retirements first, then Hall of Fame members by induction year.
export function sortLegends(list) {
  const year = f => legendWing(f) === 'ufcinfo' ? 10000 + (f.hallOfFame?.retired || 0) : f.hallOfFame?.inducted || 0;
  return [...list].sort((a, b) => year(b) - year(a) || fullName(a).localeCompare(fullName(b), 'es'));
}

export function filterLegends(list, wing) {
  return wing === 'all' ? list : list.filter(f => legendWing(f) === wing);
}

export function legendTagline(fighter) {
  const wing = legendWing(fighter);
  if (wing === 'ufcinfo') return ['Selección UFCinfo', fighter.hallOfFame?.retired && `Retiro en ${fighter.hallOfFame.retired}`].filter(Boolean).join(' · ');
  return ['Salón de la Fama de UFC', legendWings[wing], fighter.hallOfFame?.inducted].filter(Boolean).join(' · ');
}

const belt = '<svg viewBox="0 0 24 12" aria-hidden="true" focusable="false"><rect x="1" y="3" width="22" height="6" rx="3" fill="none" stroke="currentColor" stroke-width="1.4"/><ellipse cx="12" cy="6" rx="5" ry="4.2" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';

export function legendsHallHeader(legends, wing = 'all') {
  const count = key => legends.filter(f => legendWing(f) === key).length;
  const champions = legends.filter(f => (f.championships || []).length).length;
  const chips = [['all', 'Todas', legends.length], ...Object.entries(legendWings).map(([key, label]) => [key, label, count(key)])]
    .filter(([, , total]) => total)
    .map(([key, label, total]) => `<button type="button" data-legend-wing="${key}" aria-pressed="${key === wing}">${label} <span>${total}</span></button>`).join('');
  return `<div class="legends-hall-intro">
      <p class="eyebrow">SALÓN DE LEYENDAS</p>
      <h2>Los que hicieron historia en el octágono.</h2>
      <p>Luchadores retirados del Salón de la Fama de UFC, con su ala y año de ingreso, sus cinturones y lo que los hizo únicos, junto a la selección propia de UFCinfo. Las fotografías y los datos proceden de UFC.com.</p>
    </div>
    <dl class="legends-hall-stats">
      <div><dt>Leyendas</dt><dd>${legends.length}</dd></div>
      <div><dt>Excampeones UFC</dt><dd>${champions}</dd></div>
      <div><dt>Ala moderna</dt><dd>${count('modern')}</dd></div>
      <div><dt>Pioneros</dt><dd>${count('pioneer')}</dd></div>
    </dl>
    <div class="legends-hall-filters" role="group" aria-label="Filtrar leyendas por ala del Salón de la Fama">${chips}</div>`;
}

export function legacyHighlights(fighter) {
  const items = fighter.legacyHighlights || [];
  return items.length ? `<ul class="legacy-highlights" aria-label="Momentos clave">${items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : '';
}

export function legendCard(fighter, follow = '') {
  const image = fighter.hallOfFame?.image || fighter.image || 'assets/images/fighter-placeholder.svg';
  const name = fullName(fighter);
  const belts = (fighter.championships || []).filter(c => c.status === 'former' || c.status === 'current')
    .map(c => `<li>${belt}<span>${esc(c.name)}</span></li>`).join('');
  return `<article class="legend-card legend-wing-${legendWing(fighter)}">
    <button type="button" class="legend-card-media" data-profile="${esc(fighter.id)}" aria-label="Ver la ficha de ${esc(name)}">
      <img src="${esc(image)}" alt="" loading="lazy" decoding="async" width="1280" height="720">
      <span class="legend-card-credit">FOTOGRAFÍA: UFC</span>
    </button>
    ${follow}
    <div class="legend-card-body">
      <p class="legend-card-tagline">${esc(legendTagline(fighter))}</p>
      <h3><button type="button" class="legend-card-name" data-profile="${esc(fighter.id)}">${esc(name)}</button></h3>
      <p class="legend-card-meta">${esc(fighter.division || '')}${fighter.record && fighter.record !== 'No indicado' ? ` · <span translate="no">${esc(fighter.record)}</span>` : ''}</p>
      ${belts ? `<ul class="legend-card-belts" aria-label="Cinturones de UFC">${belts}</ul>` : ''}
      ${fighter.legacyNote ? `<p class="legend-card-note">${esc(fighter.legacyNote)}</p>` : ''}
      ${legacyHighlights(fighter)}
    </div>
  </article>`;
}

// Home page: three legends that change every day, the same for every visitor that day.
export function dailyLegends(legends, date = new Date(), count = 3) {
  const list = sortLegends(legends);
  if (list.length <= count) return list;
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  const start = (day * count) % list.length;
  return Array.from({ length: count }, (_, i) => list[(start + i) % list.length]);
}
