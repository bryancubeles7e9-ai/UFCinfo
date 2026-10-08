import { $, escapeHTML as esc, formatDate, formatTime } from './utils.js';
import { getLanguage } from './i18n.js';
import { directoryFighterById, fighterNameLink } from './fighter-directory.js';
import { fullName } from './data.js';
import { resultHidden } from './spoilers.js';
import {validateGroupFeed,filterGroups,groupCard} from './rumor-groups.js';
import {initializeRumorReview} from './rumor-review.js';

const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && /(?:Z|[+-]\d{2}:\d{2})$/.test(value);
export function validateRumorFeed(feed) {
  if (!feed || feed.schemaVersion !== 1 || !Array.isArray(feed.sources) || feed.sources.length > 50 ||
      !Array.isArray(feed.rumors) || feed.rumors.length > 500 ||
      (feed.updatedAt !== null && !validDate(feed.updatedAt)) ||
      (feed.lastOfficialCheckAt !== null && !validDate(feed.lastOfficialCheckAt))) return false;
  const sources = new Map();
  for (const source of feed.sources) {
    if (!source || !/^[a-z0-9-]{1,60}$/.test(source.id) || sources.has(source.id) ||
        typeof source.name !== 'string' || !source.name.trim() || source.name.length > 100 ||
        !/^[A-Za-z0-9_]{1,15}$/.test(source.handle) || !['es','en'].includes(source.language) ||
        source.profile !== `https://x.com/${source.handle}`) return false;
    sources.set(source.id, source);
  }
  const ids = new Set(), posts = new Set();
  return feed.rumors.every(r => {
    if (!r || typeof r.id !== 'string' || !/^[0-9]{10,22}$/.test(r.id) || ids.has(r.id) || posts.has(r.postUrl) ||
        !sources.has(r.sourceId) || !validDate(r.publishedAt) || !validDate(r.reviewedAt) ||
        !['es','en'].includes(r.language) || typeof r.containsSpoilers !== 'boolean' ||
        !Array.isArray(r.fighters) || r.fighters.length !== 2 || r.fighters[0] === r.fighters[1] ||
        !r.fighters.every(directoryFighterById) ||
        !r.summary || !['es','en'].every(lang => typeof r.summary[lang] === 'string' && r.summary[lang].trim() && r.summary[lang].length <= 600) ||
        (r.eventId !== null && !/^ufc-\d{1,4}$/.test(r.eventId))) return false;
    const handle = sources.get(r.sourceId).handle;
    if (r.postUrl !== `https://x.com/${handle}/status/${r.id}`) return false;
    if (r.official !== null && (!r.official || !/^ufc-\d{1,4}$/.test(r.official.eventId) ||
        r.official.url !== `https://www.ufc.com/event/${r.official.eventId}` ||
        !validDate(r.official.checkedAt) || !validDate(r.official.eventDate) ||
        Date.parse(r.official.eventDate) < Date.parse(r.publishedAt) ||
        (r.eventId !== null && r.eventId !== r.official.eventId))) return false;
    ids.add(r.id); posts.add(r.postUrl); return true;
  });
}

export function filterRumors(feed, {query = '', language = 'all', source = 'all', status = 'all'} = {}) {
  const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return feed.rumors.filter(r => {
    const reporter = feed.sources.find(s => s.id === r.sourceId);
    // Search only the matchup and source so a hidden summary cannot disclose spoilers.
    const text = [...r.fighters.map(id => fullName(directoryFighterById(id))), reporter.name, reporter.handle].join(' ');
    return normalize(text).includes(normalize(query.trim())) &&
      (language === 'all' || r.language === language) && (source === 'all' || r.sourceId === source) &&
      (status === 'all' || (status === 'confirmed' ? Boolean(r.official) : !r.official));
  }).sort((a,b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

export function rumorCard(r, sources) {
  const reporter = sources.find(s => s.id === r.sourceId);
  const hidden = r.containsSpoilers && resultHidden(`rumor:${r.id}`);
  return `<article class="panel rumor-card"><div class="rumor-card-top"><span class="badge ${r.official ? 'rumor-confirmed' : 'orange'}">${r.official ? 'CONFIRMADO POR UFC' : 'RUMOR · SIN CONFIRMAR'}</span><span class="eyebrow">${r.language === 'es' ? 'FUENTE EN ESPAÑOL' : 'FUENTE EN INGLÉS'}</span></div><h2 class="rumor-matchup">${r.fighters.map(id => fighterNameLink(fullName(directoryFighterById(id)), 'rumor-fighter')).join('<span>VS</span>')}</h2>${hidden ? `<p class="data-note">Contenido oculto por el modo sin spoilers.</p><button class="text-link" data-reveal-result="rumor:${esc(r.id)}">Leer rumor</button>` : `<p class="rumor-summary" lang="${getLanguage() === 'ca' ? 'es' : getLanguage()}" translate="no">${esc(r.summary[getLanguage()] ?? r.summary.es)}</p>${getLanguage() === 'ca' ? '<p class="data-note">Resumen disponible en español.</p>' : ''}`} <div class="rumor-byline"><span>Publicado por</span> <a href="${esc(reporter.profile)}" target="_blank" rel="noopener noreferrer" translate="no">${esc(reporter.name)} · @${esc(reporter.handle)}</a><time datetime="${esc(r.publishedAt)}">${formatDate(r.publishedAt)} · ${formatTime(r.publishedAt)}</time></div><div class="rumor-actions"><a class="text-link" href="${esc(r.postUrl)}" target="_blank" rel="noopener noreferrer">Ver publicación original en X ↗</a>${r.official ? `<a class="text-link" href="${esc(r.official.url)}" target="_blank" rel="noopener noreferrer">Confirmación oficial UFC ↗</a>` : ''}</div>${r.official ? `<p class="data-note">La pelea aparece en la cartelera oficial UFC. Comprobación: ${formatDate(r.official.checkedAt)} · ${formatTime(r.official.checkedAt)}.</p>` : '<p class="data-note">Información atribuida al periodista; pendiente de confirmación oficial.</p>'}</article>`;
}

export function rumorSearchStatus(groupFeed) {
  const last=groupFeed.lastSearchedAt;
  const status=validDate(last) ? `Última búsqueda: ${formatDate(last)} · ${formatTime(last)}.` : 'Última búsqueda: todavía no disponible.';
  return `${status} Búsqueda programada cada hora en punto.`;
}

export function initializeRumors() {
  let feed = {schemaVersion:1, updatedAt:null, lastOfficialCheckAt:null, sources:[], rumors:[]};
  let loading = false, unavailable = false;
  let groupFeed = {schemaVersion:1,updatedAt:null,groups:[]};
  function draw() {
    const list = filterRumors(feed, {query:$('#rumor-search').value, language:$('#rumor-language').value, source:$('#rumor-source').value, status:$('#rumor-status').value});
    const groups=filterGroups(groupFeed,feed.sources,{query:$('#rumor-search').value,language:$('#rumor-language').value,source:$('#rumor-source').value,status:$('#rumor-status').value});
    $('#rumor-search-status').textContent = rumorSearchStatus(groupFeed);
    $('#rumor-count').textContent = `${list.length+groups.length} reportes`;
    $('#rumor-feed-status').textContent = unavailable ? 'No se pudo comprobar una actualización. Se conservan las últimas publicaciones cargadas.' : feed.lastOfficialCheckAt ? `Última comprobación de confirmaciones oficiales: ${formatDate(feed.lastOfficialCheckAt)} · ${formatTime(feed.lastOfficialCheckAt)}.` : 'Todavía no hay una comprobación de confirmaciones oficiales disponible.';
    const cards=[...list.map(r=>({date:r.publishedAt,html:rumorCard(r,feed.sources)})),...groups.map(group=>({date:group.publishedAt,html:groupCard(group,feed.sources)}))].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
    $('#rumor-list').innerHTML = cards.length ? cards.map(card=>card.html).join('') : `<div class="empty-state"><span>◇</span><p>${feed.rumors.length || groupFeed.groups.length ? 'No hay publicaciones con estos filtros.' : 'Aún no hay rumores revisados. Aquí aparecerán publicaciones con periodista, fecha y enlace original.'}</p></div>`;
    $('#rumor-sources').innerHTML = feed.sources.map(s => `<a class="rumor-source-link" href="${esc(s.profile)}" target="_blank" rel="noopener noreferrer"><span translate="no">${esc(s.name)}<small>@${esc(s.handle)}</small></span><span class="badge">${s.language.toUpperCase()}</span></a>`).join('');
  }
  async function refresh() {
    if (loading) return;
    loading = true;
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(),10000);
    try {
      const responses = await Promise.all([fetch(new URL('../data/ufc-rumors.json',import.meta.url), {cache:'no-store',signal:controller.signal}),fetch(new URL('../data/ufc-rumor-groups.json',import.meta.url), {cache:'no-store',signal:controller.signal})]);
      if (responses.some(response=>!response.ok)) throw Error('Unavailable');
      const [next,nextGroups] = await Promise.all(responses.map(response=>response.json()));
      if (!validateRumorFeed(next)) throw Error('Invalid feed');
      if (!validateGroupFeed(nextGroups,next.sources)) throw Error('Invalid group feed');
      feed = next; groupFeed=nextGroups; unavailable = false;
      const selected = $('#rumor-source').value;
      $('#rumor-source').innerHTML = '<option value="all">Todos los periodistas</option>' + feed.sources.map(s => `<option value="${esc(s.id)}" translate="no">${esc(s.name)}</option>`).join('');
      $('#rumor-source').value = feed.sources.some(s => s.id === selected) ? selected : 'all';
    } catch { unavailable = true; }
    finally { clearTimeout(timer); loading = false; draw(); }
  }
  $('#rumor-search').addEventListener('input',draw);
  for (const id of ['rumor-language','rumor-source','rumor-status']) $(`#${id}`).addEventListener('change',draw);
  document.addEventListener('ufcinfo:language-changed',draw);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  // Check immediately when returning to this view as well as while it stays open.
  window.addEventListener('hashchange', () => { if (location.hash === '#rumores') refresh(); });
  setInterval(() => {if (!document.hidden) refresh();},60000);
  draw(); refresh();
  initializeRumorReview({getSources:()=>feed.sources,getPublished:()=>groupFeed});
  return {draw, refresh};
}
