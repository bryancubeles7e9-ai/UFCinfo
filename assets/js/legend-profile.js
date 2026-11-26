// Profile of a retired legend: the Hall of Fame photo, the essentials and a short story.
// It replaces the regular profile (stance, statistics, history…), which is mostly empty for them.
import { fullName } from './data.js';
import { escapeHTML as esc } from './utils.js';
import { legendBadge } from './fighter-legacy.js';
import { legendTagline, legendWing, legendWings } from './legends-hall.js';

const beltIcon = '<svg viewBox="0 0 24 12" aria-hidden="true" focusable="false"><rect x="1" y="3" width="22" height="6" rx="3" fill="none" stroke="currentColor" stroke-width="1.4"/><ellipse cx="12" cy="6" rx="5" ry="4.2" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';

export function legendProfile(fighter, { follow = '' } = {}) {
  const name = fullName(fighter);
  const image = fighter.hallOfFame?.image || fighter.image || 'assets/images/fighter-placeholder.svg';
  const wing = legendWing(fighter);
  const belts = (fighter.championships || []).filter(c => c.status === 'former' || c.status === 'current');
  const facts = [
    fighter.record && fighter.record !== 'No indicado' ? ['Récord', `<span translate="no">${esc(fighter.record)}</span>`] : null,
    ['Categoría', esc(fighter.division || '—')],
    wing === 'ufcinfo'
      ? ['Retiro', esc(String(fighter.hallOfFame?.retired || 'Documentado por UFC'))]
      : ['Salón de la Fama', esc([legendWings[wing], fighter.hallOfFame?.inducted].filter(Boolean).join(' · '))],
  ].filter(Boolean);
  const link = /^https:\/\/www\.ufc\.com\//.test(fighter.legendSource || '')
    ? `<a class="text-link" href="${esc(fighter.legendSource)}" target="_blank" rel="noopener noreferrer">${wing === 'ufcinfo' ? 'Trayectoria en UFC ›' : 'Salón de la Fama de UFC ›'}</a>` : '';
  return `<article class="legend-profile">
    <header class="legend-profile-hero">
      <img src="${esc(image)}" alt="${esc(name)}, fotografía de UFC" width="1280" height="720" decoding="async">
      <div class="legend-profile-title">
        <p class="legend-profile-tagline">${esc(legendTagline(fighter))}</p>
        <h2 translate="no">${esc(name)}</h2>
        ${fighter.nickname ? `<p class="legend-profile-nickname" translate="no">«${esc(fighter.nickname)}»</p>` : ''}
        ${legendBadge(fighter)}
      </div>
      <span class="legend-profile-credit">FOTOGRAFÍA: UFC</span>
    </header>
    <div class="legend-profile-actions">${follow}${link}</div>
    <dl class="legend-profile-facts">${facts.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>
    ${belts.length ? `<section class="legend-profile-belts"><h3>Cinturones de UFC</h3><ul>${belts.map(b => `<li>${beltIcon}<span>${esc(b.name)}</span></li>`).join('')}</ul></section>` : ''}
    <section class="legend-profile-story"><h3>Su historia</h3><p>${esc(fighter.legacyStory || fighter.legacyNote || '')}</p></section>
    <p class="data-note">Datos y fotografía: UFC.com. Consulta: ${esc(fighter.legendConsulted || '—')}.</p>
  </article>`;
}
