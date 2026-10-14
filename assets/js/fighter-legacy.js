import { escapeHTML as esc } from './utils.js';

// Editorial recognition is independent of championship ownership.
export const isLegend = fighter => fighter.legend === true && fighter.careerStatus === 'retired';
const laurel = '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 27C3 23 2 13 7 6M20 27c9-4 10-14 5-21M6 11l-3-1m3 7-4-1m6 6-4-1m22-10 3-1m-3 7 4-1m-6 6 4-1"/><path d="m16 7 2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8Z"/></svg>';
export function legendBadge(fighter) {
  if (!isLegend(fighter)) return '';
  const status = fighter.division?.includes('femenino') ? 'Retirada' : 'Retirado';
  return `<span class="legend-badge">${laurel}<span>Leyenda</span><span class="legend-status">${status}</span></span>`;
}
export function renderLegacyDetails(fighter) {
  if (!isLegend(fighter)) return '';
  const source = /^https:\/\/www\.ufc\.com\/(news|hof|athlete)\//.test(fighter.legendSource || '')
    ? `<a class="text-link" href="${esc(fighter.legendSource)}" target="_blank" rel="noopener noreferrer">Trayectoria en UFC ›</a>` : '';
  return `<section class="legacy-details">${legendBadge(fighter)}<p>Trayectoria histórica. Selección de leyendas de UFCinfo con retiro documentado.</p>${fighter.legacyNote ? `<p>${esc(fighter.legacyNote)}</p>` : ""}${source}<p class="data-note">Consulta: ${esc(fighter.legendConsulted || '—')}</p></section>`;
}
