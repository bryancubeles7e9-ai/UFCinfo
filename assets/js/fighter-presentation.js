import { fullName } from './data.js';
import { directoryFighterByName } from './fighter-directory.js';
import { escapeHTML as esc, formatDate } from './utils.js';
import { countryLabel } from './fighter-country.js';
import { getLocale } from './i18n.js';
import { isLegend, legendBadge, renderLegacyDetails } from './fighter-legacy.js';
import { hasCurrentBelt, championshipBadge, renderStanceDetails, renderChampionships } from './fighter-details.js';
import { renderMartialDetails } from './fighter-martial.js';
import { renderExtendedFighterInfo, renderFighterConsultation } from './fighter-info.js';
import { resultHidden, hiddenResult } from './spoilers.js';
import { boutPinKey } from './following.js';

export function fighterHistory(fighter, events) {
  const seen = new Set();
  return events.filter(e => e.type === 'official' && Number.isFinite(Date.parse(e.date)))
    .flatMap(event => (event.bouts || []).flatMap(bout => {
      const participants = [bout.red, bout.blue].map(directoryFighterByName);
      if (!participants.some(f => f?.id === fighter.id)) return [];
      const key = boutPinKey(event, bout);
      if (seen.has(key)) return [];
      seen.add(key);
      return [{event, bout, key}];
    })).sort((a, b) => Date.parse(b.event.date) - Date.parse(a.event.date));
}
export function compactFighterRow(fighter, follow) {
  return `<article class="fighter-row ${hasCurrentBelt(fighter) ? 'is-champion' : ''} ${isLegend(fighter) ? 'is-legend' : ''}">
    <button class="fighter-row-identity" data-profile="${esc(fighter.id)}" aria-label="Ver ficha de ${esc(fullName(fighter))}"><img src="${esc(fighter.image || 'assets/images/fighter-placeholder.svg')}" alt="" width="64" height="76" loading="lazy"><span><strong translate="no">${esc(fullName(fighter))}</strong><small>${esc(countryLabel(fighter, getLocale()) || 'País no documentado')}</small></span></button>
    <div class="fighter-row-division"><span>${esc(fighter.division)}</span><div class="fighter-row-badges">${legendBadge(fighter)}${championshipBadge(fighter)}</div></div>
    <div class="fighter-row-record"><small>Récord · V-D-E</small><strong>${esc(fighter.record || '—')}</strong></div>
    <div class="fighter-row-follow">${follow}</div>
  </article>`;
}
export function renderFighterHistory(fighter, events) {
  const history = fighterHistory(fighter, events);
  return `<p class="data-note">Combates presentes en las carteleras de UFCinfo. Este historial puede no incluir toda su carrera.</p>${history.length ? `<ol class="profile-history">${history.map(({event, bout, key}) => {
    const completed = event.status === 'completed';
    const result = completed ? resultHidden(key) ? hiddenResult(key) : `<span>${esc(bout.winner ? `Ganador: ${bout.winner}` : bout.outcome || 'Resultado aún no disponible')}</span><small>${esc([bout.method, bout.round ? `R${bout.round}` : '', bout.time].filter(Boolean).join(' · '))}</small>` : `<span>${Date.parse(event.date) < Date.now() ? 'Resultados pendientes de actualización' : 'Combate anunciado · Sin resultado'}</span>`;
    return `<li><div><time datetime="${esc(event.date)}">${formatDate(event.date)}</time><button class="text-link" data-official-event="${esc(event.id)}" translate="no">${esc(event.title)} ›</button></div><div><strong translate="no">${esc(bout.red)} <span class="muted">vs</span> ${esc(bout.blue)}</strong><div class="profile-history-result">${result}</div></div></li>`;
  }).join('')}</ol>` : '<p class="profile-empty">Todavía no hay combates de este luchador en las carteleras disponibles.</p>'}`;
}
export function fighterProfile(fighter, { follow, events, active = 'summary' }) {
  const facts = [['País representado', countryLabel(fighter, getLocale()) || 'No indicado'], ['División', fighter.division], ['Apodo', fighter.nickname || 'No indicado'], ['Estilo indicado por UFC', fighter.officialStyle || 'No indicado'], ['Lugar de nacimiento', fighter.birthplace || 'No indicado']];
  const metrics = [['Récord · V-D-E', fighter.record || '—'], ['Altura', fighter.heightCm == null ? '—' : `${fighter.heightCm} cm`], ['Alcance', fighter.reachCm == null ? '—' : `${fighter.reachCm} cm`]];
  const tabs = [['summary','Resumen'], ['statistics','Estadísticas'], ['history','Historial']];
  return `<div class="fighter-profile ${hasCurrentBelt(fighter) ? 'is-champion' : ''} ${isLegend(fighter) ? 'is-legend' : ''}">
    <header class="fighter-profile-hero"><div class="fighter-profile-photo"><img src="${esc(fighter.image || 'assets/images/fighter-placeholder.svg')}" alt="${esc(fullName(fighter))}" width="200" height="240"></div><div class="fighter-profile-intro"><p class="eyebrow">${esc(fighter.division)}</p><h2 translate="no">${esc(fullName(fighter))}</h2><div class="profile-status">${legendBadge(fighter)}${championshipBadge(fighter)}</div><div class="profile-actions">${follow}<a class="text-link" href="${esc(fighter.source)}" target="_blank" rel="noopener noreferrer">Perfil oficial UFC ›</a></div></div><dl class="profile-metrics">${metrics.map(([label,value])=>`<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl></header>
    ${renderFighterConsultation(fighter)}
    <div class="profile-section-switch" role="group" aria-label="Secciones del perfil">${tabs.map(([id,label])=>`<button type="button" data-profile-section="${id}" aria-controls="fighter-panel-${id}" aria-pressed="${active === id}">${label}</button>`).join('')}</div>
    <section class="profile-section" id="fighter-panel-summary" ${active !== 'summary' ? 'hidden' : ''}><h3 class="profile-section-title">Resumen</h3>${renderLegacyDetails(fighter)}<section class="official-facts"><dl>${facts.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value || 'No indicado')}</dd></div>`).join('')}</dl></section><div class="profile-combat-grid">${renderStanceDetails(fighter)}${renderMartialDetails(fighter)}</div>${renderChampionships(fighter)}<p class="data-note">Fotografía: ${esc(fighter.photoCredit || 'UFC')}. El lugar de nacimiento no implica nacionalidad deportiva.</p></section>
    <section class="profile-section" id="fighter-panel-statistics" ${active !== 'statistics' ? 'hidden' : ''}><h3 class="profile-section-title">Estadísticas</h3>${renderExtendedFighterInfo(fighter) || '<p class="profile-empty">No hay estadísticas verificadas disponibles para este perfil.</p>'}</section>
    <section class="profile-section" id="fighter-panel-history" ${active !== 'history' ? 'hidden' : ''}><h3 class="profile-section-title">Historial</h3>${renderFighterHistory(fighter, events)}</section>
  </div>`;
}
