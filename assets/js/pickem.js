import {nextPickEvent, closingTime, isClosed, pickKey, picksFor, readPicks, pickResult, pickSummary} from './pickem-model.js';
import {directoryFighterByName} from './fighter-directory.js';
import {escapeHTML as esc} from './utils.js';
import {getLocale} from './i18n.js';
import {countryLabel} from './fighter-country.js';
import {renderBoutTime} from './bout-schedule.js';
import {accountRequest} from './account.js';

export function initializePickem() {
  const root = document.querySelector('#pickem-content');
  let storage;
  try { storage = window.localStorage; } catch {}
  let local = readPicks(storage), events = [], state = null, selected = '', draft = {}, dirty = false;
  let busy = false, generation = 0, message = '', scope = 'all', page = 1, ranking = null, rankingError = false;
  let serverOffset = 0, rankGeneration = 0, draftRevision = 0;
  const now = () => Date.now() + serverOffset;
  const date = value => new Date(value).toLocaleString(getLocale(), {dateStyle:'medium', timeStyle:'short'});
  function current() {
    return state?.events.find(item => item.event.id === selected) || null;
  }
  function eventData() { return current()?.event || nextPickEvent(events); }
  function closed() {
    const item = current();
    return item ? item.event.id !== state.nextEventId || item.closed || now() >= item.closesAt : !eventData() || isClosed(eventData());
  }
  function useState(next) {
    const wasNext = selected === state?.nextEventId;
    state = next; serverOffset = next.serverTime - Date.now();
    if (!selected || (wasNext && selected !== next.nextEventId) || !next.events.some(item => item.event.id === selected)) {
      selected = next.nextEventId || next.events.find(item => item.joined)?.event.id || '';
    }
    const item = current();
    draft = item ? picksFor(item.event, item.picks) : {}; draftRevision = item?.revision || 0; dirty = false;
  }
  function pastEvent() {
    const archived = state?.events.map(item => item.event) || [];
    return [...archived, ...events].filter(e => e.status === 'completed' && Date.parse(e.date) < now())
      .sort((a,b) => Date.parse(b.date) - Date.parse(a.date))[0] || null;
  }
  function board() {
    return `<section class="panel pickem-ranking"><h2>Ranking Pick’em</h2><p>Cada pick acertado suma 100 puntos. El ranking acumula los puntos de las veladas finalizadas.</p>
    <label>Clasificación <select id="pickem-scope"><option value="all" ${scope==='all'?'selected':''}>Histórica</option>${eventData()?`<option value="event" ${scope==='event'?'selected':''}>Esta velada</option>`:''}${pastEvent()?`<option value="past" ${scope==='past'?'selected':''}>Velada pasada</option>`:''}</select></label>
    ${rankingError ? '<p role="status">No se pudo cargar el ranking.</p>' : !ranking ? '<p>Cargando ranking…</p>' : `<div class="pickem-table"><table><thead><tr><th>Posición</th><th>Nombre de usuario</th><th>Puntos</th><th>Veladas</th><th>Aciertos</th><th>Pendientes</th></tr></thead><tbody>${ranking.rows.map(r=>`<tr><td>${r.position ?? '—'}</td><td translate="no">${esc(r.alias)}</td><td>${r.score === null ? '—' : r.score.toLocaleString(getLocale(),{maximumFractionDigits:2})}</td><td>${r.played}</td><td>${r.correct} / ${r.total}</td><td>${r.pending}</td></tr>`).join('') || '<tr><td colspan="6">Todavía no hay participantes.</td></tr>'}</tbody></table></div><div class="pickem-pagination"><button class="outline-button small" data-rank-page="-1" ${page<=1?'disabled':''}>Anterior</button><span>${page} / ${Math.max(1,Math.ceil(ranking.total/50))}</span><button class="outline-button small" data-rank-page="1" ${page*50>=ranking.total?'disabled':''}>Siguiente</button></div>`}</section>`;
  }
  function results(event, item) {
    if (!item?.joined || !item.closed) return '';
    const counts = pickSummary(event, item.picks);
    return `<section class="panel pickem-results" aria-labelledby="pickem-results-title"><h2 id="pickem-results-title">Resumen de tus resultados</h2>
      <p><strong>${item.result.void ? 'Velada anulada' : item.result.final ? 'Puntuación final' : 'Puntuación provisional'}</strong></p>
      <dl class="pickem-result-stats"><div><dt>Puntos</dt><dd>${item.result.score}</dd></div><div><dt>Aciertos</dt><dd>${counts.correct}</dd></div><div><dt>Fallos</dt><dd>${counts.wrong}</dd></div><div><dt>Sin elegir</dt><dd>${counts.unpicked}</dd></div><div><dt>Resultados pendientes</dt><dd>${counts.pending}</dd></div><div><dt>Combates anulados</dt><dd>${counts.void}</dd></div></dl>
      ${!item.result.final && !item.result.void ? '<p class="data-note">El resumen se actualizará cuando se confirmen los resultados. Los puntos se incorporan al ranking al finalizar la velada.</p>' : ''}</section>`;
  }
  function boutResult(bout, item) {
    if (!item?.joined || !item.closed) return '';
    const status = pickResult(bout, item.picks);
    const labels = {correct:'Pick acertado', wrong:'Pick fallado', unpicked:'Sin elegir', pending:'Resultado pendiente', void:'Combate anulado'};
    return `<p class="pickem-bout-result is-${status}"><strong>${labels[status]}</strong> · ${status==='pending'?'—':status==='correct'?100:0} <span>puntos</span>${!['pending','void'].includes(status)?`<br><span>Ganador</span>: <span translate="no">${esc(bout.winner)}</span>`:''}</p>`;
  }
  function render() {
    const event = eventData(), item = current();
    if (!event) { root.innerHTML = `<div class="panel"><h2>Próxima cartelera pendiente</h2></div>${board()}`; return; }
    const authenticated = !!state?.authenticated;
    const picks = authenticated ? picksFor(event, draft) : picksFor(event, local[event.id]);
    const locked = closed(), count = Object.keys(picks).length;
    const options = state?.events.filter(r => r.joined || r.event.id === state.nextEventId) || [];
    root.innerHTML = `<p class="data-note">Elige al ganador de cada combate del próximo evento. Inicia sesión y guarda antes del cierre: cada pick acertado suma 100 puntos; los fallos suman 0.</p>${options.length ? `<label>Velada <select id="pickem-event">${options.map(r=>`<option value="${esc(r.event.id)}" ${r.event.id===selected?'selected':''}>${esc(r.event.title)} · ${esc(date(r.event.date))}</option>`).join('')}</select></label>` : ''}
      <div class="panel pickem-summary"><div><p class="eyebrow">TUS PRONÓSTICOS UFC</p><h2 translate="no">${esc(event.title)}</h2><p translate="no">${esc(date(event.date))}</p><p class="data-note">Hora local · inicio de la principal</p></div><div class="pickem-progress"><strong>${count} / ${event.bouts.filter(b=>!b._void).length}</strong><span>Pronósticos elegidos</span><progress max="${Math.max(1,event.bouts.length)}" value="${count}" aria-label="Pronósticos elegidos"></progress></div></div>
      <p><strong>100 puntos por acierto</strong> · Cada acierto suma 100 puntos; los fallos y las peleas sin elegir suman 0. Empates, no contest y cancelaciones no dan puntos.</p>
      <p class="data-note">El cierre usa el primer bloque oficial disponible; sin horarios completos, cuatro horas antes de la principal. Lo controla el servidor.</p>
      <p><strong>${locked ? 'Pronósticos cerrados' : 'Puedes cambiar tus elecciones hasta el cierre'}</strong> · <time translate="no">${esc(date(item?.closesAt || closingTime(event)))}</time></p>
      ${results(event,item)}
      <div class="panel pickem-save">
      ${authenticated ? `<p>Los pronósticos guardados participan en el ranking con tu nombre de usuario.</p><p><span>Nombre de usuario</span>: <strong translate="no">${esc(state.alias || "")}</strong></p>
      <button class="button small" id="pickem-save" ${locked || busy || !count || !dirty ? 'disabled' : ''}>${busy?'Guardando…':'Guardar pronósticos'}</button>
      ${!locked && Object.keys(picksFor(event,local[event.id])).length ? '<button class="outline-button small" id="pickem-import">Recuperar picks de este navegador</button>' : ''}` : '<p>Modo invitado: tus picks son locales y no puntúan. Inicia sesión para participar en el ranking.</p><button class="button small" id="pickem-login">Iniciar sesión</button>'}
      <p id="pickem-save-status" role="status">${esc(message || (dirty ? 'Cambios sin guardar' : authenticated ? (item?.joined ? 'Pronósticos guardados en tu cuenta' : 'Elige tus ganadores y guarda para participar') : 'Guardado local en este navegador'))}</p>
      <button class="outline-button small" id="pickem-refresh" ${busy?'disabled':''}>Recargar pronósticos guardados</button></div>
      <div class="pickem-grid">${event.bouts.map((bout,i)=>`<fieldset class="pickem-bout"><legend>${esc({'main':'Principal','prelims':'Preliminares','early-prelims':'Preliminares previas'}[bout.section]||'Combate')} · ${esc(bout.division)}</legend>${bout._void?'<p>Combate anulado</p>':renderBoutTime(event,bout)}<div class="pickem-options">${[bout.red,bout.blue].map((name,side)=>{
        const fighter=directoryFighterByName(name), chosen=picks[pickKey(bout)]===name;
        return `<button type="button" class="pickem-choice ${chosen?'is-picked':''}" data-pick-bout="${i}" data-pick-side="${side}" aria-pressed="${chosen}" ${locked||busy||bout._void?'disabled':''}><img src="${esc(fighter?.image||'assets/images/fighter-placeholder.svg')}" alt="" loading="lazy" width="140" height="150"><span translate="no">${esc(name)}</span><small class="pickem-fighter-info"><span>Récord</span>: <span translate="no">${esc(fighter?.record || "—")}</span>${fighter && countryLabel(fighter,getLocale()) ? ` · <span translate="no">${esc(countryLabel(fighter,getLocale()))}</span>` : ""}</small><small>${chosen?'Tu elección':'Elegir ganador'}</small></button>`;
      }).join('')}</div>${boutResult(bout,item)}</fieldset>`).join('')}</div>${board()}`;
  }
  async function loadRanking() {
    const ticket=++rankGeneration;
    try {
      const data=await accountRequest(`pickem/ranking?scope=${encodeURIComponent(scope==='past'?pastEvent()?.id||'all':scope==='event'?eventData()?.id||'all':scope)}&page=${page}`);
      if(ticket!==rankGeneration)return;
      ranking=data; rankingError=false;
    } catch { if(ticket!==rankGeneration)return; rankingError=true; }
    render();
  }
  async function refresh(discard = false) {
    if (busy) return;
    const ticket=++generation;
    try {
      const data=await accountRequest('pickem/state');
      if(ticket!==generation)return;
      // Preserve unsaved edits until explicitly saved or the event is changed.
      if(!discard && dirty && state?.authenticated && data.authenticated) {
        state=data; serverOffset=data.serverTime-Date.now();
      } else useState(data);
      message='';
    } catch { if(ticket!==generation)return; message='No se pudo comprobar la cuenta o la cartelera. Reintenta antes de guardar.'; }
    render(); await loadRanking();
  }
  root.addEventListener('error',e=>{if(e.target.tagName==='IMG'&&!e.target.dataset.fallback){e.target.dataset.fallback='true';e.target.src='assets/images/fighter-placeholder.svg';}},true);
  root.addEventListener('change',e=>{
    if(e.target.id==='pickem-event'){selected=e.target.value;draft=picksFor(current().event,current().picks);draftRevision=current().revision;dirty=false;message='';render();if(scope==='event'){page=1;loadRanking();}}
    if(e.target.id==='pickem-scope'){scope=e.target.value;page=1;ranking=null;render();loadRanking();}
  });
  root.addEventListener('click',async e=>{
    if(e.target.closest('#pickem-login')){document.querySelector('#account-open').click();return;}
    if(e.target.closest('#pickem-refresh')){await refresh(true);return;}
    const pager=e.target.closest('[data-rank-page]');
    if(pager){page+=Number(pager.dataset.rankPage);await loadRanking();return;}
    const event=eventData(); if(!event||busy)return;
    if(e.target.closest('#pickem-import')&&!closed()){draft=picksFor(event,local[event.id]);dirty=true;message='Cambios sin guardar';render();return;}
    if(e.target.closest('#pickem-save')) {
      if(closed()) {render();return;}
      busy=true;message='Guardando…';render();const ticket=++generation;
      try {
        const session=await accountRequest('auth/session');
        if(ticket!==generation)return;
        if(!session.user)throw Error('Inicia sesión para guardar tus pronósticos.');
        const data=await accountRequest('me/pickem',{method:'PUT',csrf:session.csrf,body:{eventId:event.id,picks:picksFor(event,draft),revision:draftRevision}});
        if(ticket!==generation)return;
        useState(data);message='Pronósticos guardados en tu cuenta';
      } catch(error){if(ticket!==generation)return;message=error.status ? error.message : 'No se ha confirmado el guardado. Actualiza los datos y vuelve a intentarlo.';}
      finally{busy=false;render();}
      await loadRanking();return;
    }
    const button=e.target.closest('[data-pick-bout]');if(!button)return;
    if(closed()){render();return;}
    const bout=event.bouts[Number(button.dataset.pickBout)];if(!bout||bout._void)return;
    const winner=Number(button.dataset.pickSide)===0?bout.red:bout.blue;
    if(state?.authenticated){draft={...picksFor(event,draft),[pickKey(bout)]:winner};dirty=true;message='Cambios sin guardar';}
    else {local[event.id]={...picksFor(event,local[event.id]),[pickKey(bout)]:winner};try{storage.setItem('ufcinfo-pickem-v1',JSON.stringify(local));message='Guardado local en este navegador';}catch{message='No se ha podido guardar. Tus elecciones se perderán al cerrar esta página.';}}
    const i=button.dataset.pickBout,side=button.dataset.pickSide;render();root.querySelector(`[data-pick-bout="${i}"][data-pick-side="${side}"]`)?.focus({preventScroll:true});
  });
  document.addEventListener('ufcinfo:language-changed',render);
  document.addEventListener('ufcinfo:account-changed',()=>{generation++;state=null;draft={};dirty=false;message='';render();refresh();});
  window.addEventListener('storage',e=>{if(e.key==='ufcinfo-pickem-v1'||e.key===null){local=readPicks(storage);render();}});
  setInterval(()=>{if(eventData()&&closed()&&root.querySelector('[data-pick-bout]:not(:disabled)'))render();},15000);
  return {render, update(next){events=next;render();refresh();}};
}
