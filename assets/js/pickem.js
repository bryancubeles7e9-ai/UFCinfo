import {nextPickEvent, closingTime, isClosed, pickKey, picksFor, readPicks} from './pickem-model.js';
import {directoryFighterByName} from './fighter-directory.js';
import {escapeHTML as esc} from './utils.js';
import {getLocale} from './i18n.js';
import {renderBoutTime} from './bout-schedule.js';

export function initializePickem() {
  const root = document.querySelector('#pickem-content');
  let storage;
  try { storage = window.localStorage; } catch {}
  let saved = readPicks(storage), events = [], event = null, persisted = true;
  const date = value => new Date(value).toLocaleString(getLocale(), {dateStyle:'medium', timeStyle:'short'});
  function render() {
    event = nextPickEvent(events);
    if (!event) { root.innerHTML = '<div class="panel"><h2>Próxima cartelera pendiente</h2><p>El Pick’em estará disponible cuando se anuncie el próximo evento.</p></div>'; return; }
    const picks = picksFor(event, saved[event.id]);
    const closed = isClosed(event), count = Object.keys(picks).length;
    root.innerHTML = `<div class="panel pickem-summary"><div><p class="eyebrow">TU PRÓXIMA VELADA</p><h2 translate="no">${esc(event.title)}</h2><p translate="no">${esc(date(event.date))}</p><p class="data-note">Hora local · inicio de la principal</p></div><div class="pickem-progress"><strong>${count} / ${event.bouts.length}</strong><span>Pronósticos elegidos</span><progress max="${Math.max(1,event.bouts.length)}" value="${count}" aria-label="Pronósticos elegidos"></progress></div></div>
      <p class="data-note">Los pronósticos se guardan solo en este navegador, sin sincronización con tu cuenta.</p>
      <p class="data-note">Cierre al inicio de la velada; si falta el horario oficial, cuatro horas antes de la principal.</p>
      <p><strong>${closed ? 'Pronósticos cerrados' : 'Puedes cambiar tus elecciones hasta el cierre'}</strong> · <time translate="no">${esc(date(closingTime(event)))}</time></p>
      <p class="data-note">Si cambia un rival, elige de nuevo en ese combate. Esto es un juego personal, sin apuestas ni clasificación pública.</p>
      <p id="pickem-save-status" role="status">${persisted ? 'Guardado automático en este navegador' : 'No se ha podido guardar. Tus elecciones se perderán al cerrar esta página.'}</p>
      <div class="pickem-grid">${event.bouts.map((bout,i) => `<fieldset class="pickem-bout"><legend><span>${esc({'main':'Principal','prelims':'Preliminares','early-prelims':'Preliminares previas'}[bout.section] || 'Combate')}</span> · ${esc(bout.division)}</legend>${renderBoutTime(event,bout)}<div class="pickem-options">${[bout.red,bout.blue].map((name,side) => {
        const fighter = directoryFighterByName(name), selected = picks[pickKey(bout)] === name;
        return `<button type="button" class="pickem-choice ${selected ? 'is-picked' : ''}" data-pick-bout="${i}" data-pick-side="${side}" aria-pressed="${selected}" ${closed ? 'disabled' : ''}><img src="${esc(fighter?.image || 'assets/images/fighter-placeholder.svg')}" alt="" loading="lazy" width="140" height="150"><span translate="no">${esc(name)}</span><small>${selected ? 'Tu elección' : 'Elegir ganador'}</small></button>`;
      }).join('')}</div></fieldset>`).join('') || '<p>Combates pendientes de anuncio.</p>'}</div>`;
  }
  root.addEventListener('error', e => {
    if (e.target.tagName === 'IMG' && !e.target.dataset.fallback) {
      e.target.dataset.fallback = 'true'; e.target.src = 'assets/images/fighter-placeholder.svg';
    }
  }, true);
  root.addEventListener('click', e => {
    const button = e.target.closest('[data-pick-bout]');
    if (!button || !event) return;
    if (isClosed(event)) { render(); return; }
    const bout = event.bouts[Number(button.dataset.pickBout)];
    if (!bout) return;
    const winner = Number(button.dataset.pickSide) === 0 ? bout.red : bout.blue;
    saved[event.id] = {...picksFor(event, saved[event.id]), [pickKey(bout)]:winner};
    try { storage.setItem('ufcinfo-pickem-v1', JSON.stringify(saved)); persisted = true; }
    catch { persisted = false; }
    const index = button.dataset.pickBout, side = button.dataset.pickSide;
    render();
    root.querySelector(`[data-pick-bout="${index}"][data-pick-side="${side}"]`)?.focus({preventScroll:true});
  });
  document.addEventListener('ufcinfo:language-changed', render);
  // Close even when the tab has stayed open across the start time.
  setInterval(() => {
    if (event && isClosed(event) && root.querySelector('[data-pick-bout]:not(:disabled)')) render();
  }, 15000);
  window.addEventListener('storage', e => {
    if (e.key === 'ufcinfo-pickem-v1' || e.key === null) { saved = readPicks(storage); render(); }
  });
  return {update(next) { events = next; render(); }};
}
