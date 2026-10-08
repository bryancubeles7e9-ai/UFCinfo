import {escapeHTML as esc, formatDate, formatTime} from './utils.js';
import {getLanguage} from './i18n.js';
import {fighterNameLink} from './fighter-directory.js';
import {resultHidden} from './spoilers.js';

const validDate = value => typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
const validName = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 100;
function validReport(report,sources) {
  const source = sources.find(s=>s.id === report?.sourceId);
  return source && typeof report.id === 'string' && /^[0-9]{10,22}$/.test(report.id) &&
    report.postUrl === `https://x.com/${source.handle}/status/${report.id}` && validDate(report.publishedAt) &&
    ['es','en'].includes(report.language) && (report.attribution===undefined || typeof report.attribution==='string' && report.attribution.length<=200) && Array.isArray(report.attributedAccounts) && report.attributedAccounts.length <= 20 &&
    report.attributedAccounts.every(handle=>typeof handle === 'string' && /^[A-Za-z0-9_]{1,15}$/.test(handle));
}
export function validateGroupFeed(feed,sources) {
  if (!feed || feed.schemaVersion !== 1 || !Array.isArray(feed.groups) || feed.groups.length > 500 ||
      (feed.updatedAt !== null && !validDate(feed.updatedAt)) ||
      (feed.lastSearchedAt != null && !validDate(feed.lastSearchedAt))) return false;
  const ids = new Set(),posts = new Set();
  return feed.groups.every(group=> {
    if (!group || typeof group.id !== 'string' || !/^[0-9]{10,22}$/.test(group.id) || ids.has(group.id) ||
        !Array.isArray(group.fighterNames) || group.fighterNames.length !== 2 || !group.fighterNames.every(validName) ||
        group.fighterNames[0].trim().toLowerCase() === group.fighterNames[1].trim().toLowerCase() ||
        !(group.processing === 'automatic' ? group.reviewedAt === null && validDate(group.generatedAt) : validDate(group.reviewedAt)) || !validDate(group.publishedAt) || typeof group.containsSpoilers !== 'boolean' ||
        !group.summary || !['es','en'].every(lang=>typeof group.summary[lang] === 'string' && group.summary[lang].trim() && group.summary[lang].length <= 600) ||
        group.official !== null || !Array.isArray(group.reports) || !group.reports.length || group.reports.length > 50 ||
        !group.reports.every(report=>validReport(report,sources)) || !group.reports.some(report=>report.id === group.id)) return false;
    for (const report of group.reports) {
      if (posts.has(report.id)) return false;
      posts.add(report.id);
    }
    ids.add(group.id); return true;
  });
}
export function candidateImport(payload,sources) {
  if (!sources.length) throw Error('Todavía no se han cargado las fuentes. Recarga la página e inténtalo de nuevo.');
  if (!payload || !Array.isArray(payload.candidates) || payload.candidates.length > 500 ||
      !Array.isArray(payload.groups) || payload.groups.length > 500) throw Error('Archivo de candidatos no válido.');
  const byId = new Map();
  for (const candidate of payload.candidates) {
    if (!candidate || typeof candidate.text !== 'string' || !candidate.text.trim() || candidate.text.length > 30000 || byId.has(candidate.id)) throw Error('Publicación no válida.');
    const date = new Date(candidate.publishedAt);
    if (!Number.isFinite(date.getTime())) throw Error('Fecha de publicación no válida.');
    const report = {...candidate,publishedAt:date.toISOString(),language:['es','en'].includes(candidate.language) ? candidate.language : sources.find(s=>s.id === candidate.sourceId)?.language,attributedAccounts:[...new Set([...candidate.text.matchAll(/@([A-Za-z0-9_]{1,15})/g)].map(match=>match[1]))]};
    if (!validReport(report,sources)) throw Error('La publicación no pertenece a una fuente configurada.');
    byId.set(report.id,report);
  }
  const used = new Set();
  return payload.groups.map((group,index)=> {
    if (!Array.isArray(group.reportIds) || !group.reportIds.length || group.reportIds.length > 50 || !Array.isArray(group.fighters) || group.fighters.length > 2 || !group.fighters.every(validName)) throw Error('Grupo no válido.');
    const reports = group.reportIds.map(id=> {
      if (!byId.has(id) || used.has(id)) throw Error('Publicación duplicada o desconocida.');
      used.add(id); return byId.get(id);
    });
    return {id:String(index),fighters:group.fighters,reports};
  }).concat([...byId.values()].filter(report=>!used.has(report.id)).map(report=>({id:`post:${report.id}`,fighters:[],reports:[report]})));
}
export function parseCandidateFile(text,sources) {
  let payload;
  try { payload=JSON.parse(text.replace(/^\uFEFF/,'').trim()); }
  catch { throw Error('El archivo no contiene JSON válido. Selecciona twitterapi-candidates.json.'); }
  if (!payload || !Array.isArray(payload.candidates)) {
    if (Array.isArray(payload?.groups)) throw Error('Este archivo contiene grupos para publicar. Para revisar, selecciona twitterapi-candidates.json.');
    throw Error('Este archivo no contiene candidatos de rumores. Selecciona twitterapi-candidates.json en .ufcinfo-data.');
  }
  if (!Array.isArray(payload.groups)) throw Error('Falta la agrupación de candidatos. Reprocesa el archivo con -ReprocessExisting y vuelve a importarlo.');
  return candidateImport(payload,sources);
}
export function reviewedGroup(candidate,{fighterNames,summary,containsSpoilers=true,checked=false}) {
  if (!checked) throw Error('Comprueba las publicaciones originales antes de aprobar.');
  const reports = candidate.reports.map(({id,sourceId,postUrl,publishedAt,language,attributedAccounts})=>({id,sourceId,postUrl,publishedAt,language,attributedAccounts})).sort((a,b)=>Date.parse(a.publishedAt)-Date.parse(b.publishedAt));
  return {id:reports[0].id,fighterNames:fighterNames.map(name=>name.trim()),summary:{es:summary.es.trim(),en:summary.en.trim()},containsSpoilers,reviewedAt:new Date().toISOString(),publishedAt:reports[0].publishedAt,reports,official:null};
}
export function filterGroups(feed,sources,{query='',language='all',source='all',status='all'}={}) {
  const normalize=text=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return feed.groups.filter(group=> {
    const reporters=group.reports.map(report=>sources.find(s=>s.id===report.sourceId));
    const searchable=[...group.fighterNames,...reporters.flatMap(s=>[s.name,s.handle])].join(' ');
    return normalize(searchable).includes(normalize(query.trim())) && status !== 'confirmed' &&
      (language==='all' || group.reports.some(r=>r.language===language)) &&
      (source==='all' || group.reports.some(r=>r.sourceId===source));
  }).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
}
export function groupCard(group,sources) {
  const hidden=group.containsSpoilers && resultHidden(`rumor-group:${group.id}`);
  return `<article class="panel rumor-card"><div class="rumor-card-top"><span class="badge orange">RUMOR · SIN CONFIRMAR</span><span class="eyebrow">${group.reports.length} publicaciones agrupadas</span></div><h2 class="rumor-matchup">${group.fighterNames.map(name=>fighterNameLink(name,'rumor-fighter')).join('<span>VS</span>')}</h2>${hidden ? `<p class="data-note">Contenido oculto por el modo sin spoilers.</p><button class="text-link" data-reveal-result="rumor-group:${esc(group.id)}">Leer rumor</button>` : `<p class="rumor-summary" lang="${getLanguage() === 'ca' ? 'es' : getLanguage()}" translate="no">${esc(group.summary[getLanguage()] ?? group.summary.es)}</p>${getLanguage() === 'ca' ? '<p class="data-note">Resumen disponible en español.</p>' : ''}`} <div class="rumor-byline"><time datetime="${esc(group.publishedAt)}">${formatDate(group.publishedAt)} · ${formatTime(group.publishedAt)}</time></div><ul class="rumor-group-sources">${group.reports.map(report=> {
    const source=sources.find(s=>s.id===report.sourceId);
    return `<li><a class="text-link" href="${esc(report.postUrl)}" target="_blank" rel="noopener noreferrer" translate="no">${esc(source.name)} · @${esc(source.handle)} ↗</a>${report.attributedAccounts.length ? `<small>Cita a ${report.attributedAccounts.map(handle=>`@${esc(handle)}`).join(', ')}</small>` : ''}${report.attribution ? `<small translate="no">${esc(report.attribution)}</small>` : ''}</li>`;
  }).join('')}</ul>${group.processing==='automatic' ? '<p class="data-note">Recopilado automáticamente. No ha sido verificado manualmente ni confirmado por UFC.</p>' : ''}<p class="data-note">Varias publicaciones pueden repetir una misma fuente. No equivalen a confirmaciones independientes.</p></article>`;
}
