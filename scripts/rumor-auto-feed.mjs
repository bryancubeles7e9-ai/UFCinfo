import {confirmedCalendar} from './confirmed-rumor-matchups.mjs';
import {groupCandidates} from './group-rumor-candidates.mjs';
import {canonicalFighter,normalizeName} from './rumor-fighter-names.mjs';
import {candidateImport,validateGroupFeed} from '../assets/js/rumor-groups.js';

export const boxingPattern=/\b(boxing|boxeo|boxeador(?:es)?|boxeadoras?|pugilismo|tyson\s+fury|anthony\s+joshua|fury\s+vs\.?\s+joshua|aj[- ]fury)\b/i;
const officialPattern=/\b(?:ufc\s+(?:announces?|confirms?)|(?:ufc\s+)?(?:anuncia|confirma)\s+oficialmente|is\s+official|p[oó]ster\s+oficial|official\s+(?:poster|announcement)|confirmed\s+by\s+ufc|confirmad[oa]\s+por\s+(?:la\s+)?ufc)\b/i;
export function isOfficialAnnouncement(text) {
  for (const match of text.matchAll(new RegExp(officialPattern.source, 'gi'))) {
    const before=normalizeName(text.slice(Math.max(0,match.index-65),match.index));
    if (!/\b(?:no|not|sin|without|pending|pendiente)(?:\s+[a-z]+){0,4}$/.test(before)) return true;
  }
  return false;
}
const boxingBoutPattern=/\b(?:tyson\s+fury|anthony\s+joshua|aj[- ]fury|boxing\s+(?:match|bout|fight)|(?:pelea|combate)\s+de\s+boxeo|(?:in|en)\s+(?:boxing|boxeo)|boxing\s+rules)\b/i;
export const isBoxingPost = text => boxingBoutPattern.test(text) || boxingPattern.test(text) && !/\bufc(?:\b|[a-z0-9])/i.test(text);
const ufcPattern=/\bufc(?:\b|[a-z0-9])/i;
const otherPromotionPattern=/\b(?:pfl|bellator|one championship|aca|rizin|ksw|cage warriors)\b/i;
const bookingPattern=/\b(?:targeted|talks|negotiat\w*|in the works|set for|scheduled|booked|will (?:fight|face)|agreed|accepted|enfrentara|peleara|negoci\w*|previst\w*|programad\w*|acordad\w*|aceptad\w*)\b/i;
const futureRematchPattern=/\b(?:rumou?r(?:ed|s)?|possible|potential|could|might|would|wants?|calls?\s+for|busca|quiere|pide|podria|posible|futura|future|next|proxima)\b/i;
const opinionPattern=/\b(?:i wish|i would love|dream fight|me gustaria|ojala|pelea sonada|quien ganaria|who (?:wins|would win)|my prediction|mi prediccion)\b/i;
const resultPattern=/\b(?:highlights|throwback|defeated|knocked out|submitted|vencio|derroto|noqueo|sometio|resultado final)\b/i;
const invalidNamePattern=/\b(?:breaking|news|main|event|official|poster|fight|night|ufc|mma)\b/i;
const monthNames={es:['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'],en:['January','February','March','April','May','June','July','August','September','October','November','December']};
const normalize=name=>name.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const rematchWords=/\b(?:revancha|rematch|segunda\s+pelea|segundo\s+combate|second\s+(?:fight|bout)|fight\s+again|run\s+it\s+back)\b/i;
export function isRematchReport(text,fighterNames) {
  const normalized=normalizeName(text);
  if (rematchWords.test(normalized)) return true;
  // A bare "2" only counts directly after the opponent in a named matchup.
  for (const match of normalized.matchAll(/\b(?:vs|versus|contra|v)\s+([a-z][a-z'-]*(?:\s+[a-z][a-z'-]*){0,3})\s+(?:2|ii)\b/gi)) {
    const named=canonicalFighter(match[1]);
    if (named && fighterNames.some(name=>canonicalFighter(name)===named)) return true;
  }
  return false;
}

export function automaticFeed(payload,sources,previous={schemaVersion:1,updatedAt:null,groups:[]},now=new Date(),eventFeed=null) {
  if (!validateGroupFeed(previous,sources)) throw Error('Invalid existing public feed; refusing to overwrite.');
  const grouped=groupCandidates(payload);
  const imported=candidateImport(grouped,sources);
  const candidates=new Map(grouped.candidates.map(report=>[report.id,report]));
  const calendar=confirmedCalendar(eventFeed);
  const groups=previous.groups.filter(group=>!calendar.match(group)).map(group=>structuredClone(group));
  const removedConfirmed=previous.groups.length-groups.length;
  let added=0,skipped=0;
  const skipReasons={};
  const discard=reasons=>{skipped++;for(const reason of reasons)skipReasons[reason]=(skipReasons[reason]??0)+1;};
  for (const candidate of imported) {
    const rawGroup=grouped.groups.find(group=>group.reportIds.includes(candidate.reports[0].id));
    const date=rawGroup?.dateMention;
    const texts=candidate.reports.map(report=>report.text);
    const reasons=[];
    if(candidate.fighters.length!==2 || candidate.fighters[0]===candidate.fighters[1]) reasons.push('fighters-not-detected');
    const normalized=texts.map(normalizeName);
    if(normalized.some(text=>opinionPattern.test(text))) reasons.push('opinion');
    if(normalized.some(text=>resultPattern.test(text)) && !normalized.some(text=>bookingPattern.test(text))) reasons.push('past-result');
    if(texts.some(text=>otherPromotionPattern.test(text)) && !texts.some(text=>ufcPattern.test(text))) reasons.push('other-promotion');
    if(candidate.fighters.length===2 && candidate.fighters.some(name=>!canonicalFighter(name))) {
      // Prospects outside the directory need both explicit UFC context and a future booking report.
      if(!texts.some(text=>ufcPattern.test(text) && bookingPattern.test(normalizeName(text))) || candidate.fighters.some(name=>invalidNamePattern.test(name))) reasons.push('unverified-fighters');
    }
    if(texts.some(isBoxingPost))reasons.push('boxing');
    if(texts.some(isOfficialAnnouncement))reasons.push('official-announcement');
    if(reasons.length){discard(reasons);continue;}
    const publishedAt=candidate.reports.map(report=>report.publishedAt).sort()[0];
    const posted=new Date(publishedAt);
    let eventDateHint=null;
    if(date) {
      let year=date.year ?? posted.getUTCFullYear();
      let eventDate=new Date(Date.UTC(year,date.month-1,date.day));
      if (!date.year && eventDate < new Date(Date.UTC(posted.getUTCFullYear(),posted.getUTCMonth(),posted.getUTCDate()))) eventDate=new Date(Date.UTC(++year,date.month-1,date.day));
      if(eventDate.getUTCMonth()!==date.month-1 || eventDate.getUTCDate()!==date.day){discard(['invalid-event-date']);continue;}
      if(eventDate.getTime()<now.getTime()-86400000){discard(['past-event']);continue;}
      if(eventDate.getTime()-posted.getTime()>183*86400000){discard(['event-too-far-ahead']);continue;}
      eventDateHint=eventDate.toISOString().slice(0,10);
    }
    const rematch=texts.some(text=>isRematchReport(text,candidate.fighters)) &&
      (eventDateHint!==null || normalized.some(text=>bookingPattern.test(text) || futureRematchPattern.test(text)));
    if(calendar.match({fighterNames:candidate.fighters,publishedAt,eventDateHint,rematch})) {discard(['confirmed-in-calendar']);continue;}
    // Bound undated grouping by publication month, without inventing an event date.
    const matchupKey=candidate.fighters.map(normalize).sort().join('|')+'|'+(eventDateHint??'undated:'+publishedAt.slice(0,7))+(rematch?'|rematch':'');
    const reports=candidate.reports.map(report=> {
      const original=candidates.get(report.id);
      const attribution=original.text.match(/(?:v[ií]a|inform[oó]\s+primero)\s*:?\s*([^\r\n]+)/i)?.[1]?.replace(/https?:\/\/\S+|#\S+/g,'').trim().replace(/[)\s]+$/,'').slice(0,200);
      return {id:report.id,sourceId:report.sourceId,postUrl:report.postUrl,publishedAt:report.publishedAt,language:report.language,attributedAccounts:report.attributedAccounts,...(attribution?{attribution}: {})};
    }).sort((a,b)=>a.publishedAt.localeCompare(b.publishedAt));
    const existing=groups.find(group=>group.matchupKey===matchupKey || group.reports.some(report=>reports.some(next=>next.id===report.id)));
    if (existing) {
      existing.reports=[...new Map([...existing.reports,...reports].map(report=>[report.id,report])).values()].sort((a,b)=>a.publishedAt.localeCompare(b.publishedAt)).slice(0,50);
      continue;
    }
    const reporter=sources.find(source=>source.id===reports[0].sourceId).name;
    const [first,second]=candidate.fighters;
    const kind=rawGroup?.discussionKind;
    const descriptions={response:{es:'recoge una respuesta pública relacionada con una posible pelea',en:'covers a public response concerning a possible fight'},challenge:{es:'recoge un reto público',en:'covers a public challenge'},'claimed-agreement':{es:'recoge la declaración de un luchador de haber aceptado una pelea',en:'covers a fighter’s claim of having agreed to a fight'}};
    const description=rematch ? {es:'comenta una posible revancha',en:'discusses a possible rematch'} : descriptions[kind]??{es:'comenta un posible cruce',en:'discusses a possible matchup'};
    groups.push({id:reports[0].id,fighterNames:candidate.fighters,matchupKey,eventDateHint,rematch,dateYearInferred:date ? date.year===null : false,
      summary:{es:`${reporter} ${description.es} entre ${first} y ${second}${date ? `; la publicación menciona el ${date.day} de ${monthNames.es[date.month-1]}` : ', sin fecha exacta indicada en la fuente'}. Runrún de la comunidad; no constituye confirmación oficial.`,en:`${reporter} ${description.en} between ${first} and ${second}${date ? `; the post mentions ${monthNames.en[date.month-1]} ${date.day}` : ', with no exact date stated by the source'}. Community discussion; this is not official confirmation.`},
      processing:'automatic',generatedAt:now.toISOString(),reviewedAt:null,publishedAt,containsSpoilers:true,reports,official:null});
    added++;
  }
  const feed={schemaVersion:1,updatedAt:now.toISOString(),lastSearchedAt:previous.lastSearchedAt ?? null,groups:groups.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,500)};
  if (!validateGroupFeed(feed,sources)) throw Error('Invalid generated feed; refusing to publish.');
  return {feed,added,skipped,skipReasons,removedConfirmed,calendarChecked:calendar.available,calendarSynchronizedAt:calendar.synchronizedAt};
}

