import {groupCandidates} from './group-rumor-candidates.mjs';
import {candidateImport,validateGroupFeed} from '../assets/js/rumor-groups.js';

export const boxingPattern=/\b(boxing|boxeo|boxeador(?:es)?|boxeadoras?|pugilismo|tyson\s+fury|anthony\s+joshua|fury\s+vs\.?\s+joshua|aj[- ]fury)\b/i;
const officialPattern=/\b(?:p[oó]ster\s+oficial|official\s+(?:poster|announcement)|confirmed\s+by\s+ufc|confirmad[oa]\s+por\s+(?:la\s+)?ufc)\b/i;
const monthNames={es:['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'],en:['January','February','March','April','May','June','July','August','September','October','November','December']};
const normalize=name=>name.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]/g,'');

export function automaticFeed(payload,sources,previous={schemaVersion:1,updatedAt:null,groups:[]},now=new Date()) {
  if (!validateGroupFeed(previous,sources)) throw Error('Invalid existing public feed; refusing to overwrite.');
  const grouped=groupCandidates(payload);
  const imported=candidateImport(grouped,sources);
  const candidates=new Map(grouped.candidates.map(report=>[report.id,report]));
  const groups=previous.groups.map(group=>structuredClone(group));
  let added=0,skipped=0;
  const skipReasons={};
  const discard=reasons=>{skipped++;for(const reason of reasons)skipReasons[reason]=(skipReasons[reason]??0)+1;};
  for (const candidate of imported) {
    const rawGroup=grouped.groups.find(group=>group.reportIds.includes(candidate.reports[0].id));
    const date=rawGroup?.dateMention;
    const texts=candidate.reports.map(report=>report.text);
    const reasons=[];
    if(candidate.fighters.length!==2)reasons.push('fighters-not-detected');
    if(texts.some(text=>boxingPattern.test(text)))reasons.push('boxing');
    if(texts.some(text=>officialPattern.test(text)))reasons.push('official-announcement');
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
    // Bound undated grouping by publication month, without inventing an event date.
    const matchupKey=candidate.fighters.map(normalize).sort().join('|')+'|'+(eventDateHint??'undated:'+publishedAt.slice(0,7));
    const reports=candidate.reports.map(report=> {
      const original=candidates.get(report.id);
      const attribution=original.text.match(/(?:v[ií]a|inform[oó]\s+primero)\s*:?\s*([^\r\n]+)/i)?.[1]?.replace(/https?:\/\/\S+|#\S+/g,'').trim().slice(0,200);
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
    const description=descriptions[kind]??{es:'comenta un posible cruce',en:'discusses a possible matchup'};
    groups.push({id:reports[0].id,fighterNames:candidate.fighters,matchupKey,eventDateHint,dateYearInferred:date ? date.year===null : false,
      summary:{es:`${reporter} ${description.es} entre ${first} y ${second}${date ? `; la publicación menciona el ${date.day} de ${monthNames.es[date.month-1]}` : ', sin fecha exacta indicada en la fuente'}. Runrún de la comunidad; no constituye confirmación oficial.`,en:`${reporter} ${description.en} between ${first} and ${second}${date ? `; the post mentions ${monthNames.en[date.month-1]} ${date.day}` : ', with no exact date stated by the source'}. Community discussion; this is not official confirmation.`},
      processing:'automatic',generatedAt:now.toISOString(),reviewedAt:null,publishedAt,containsSpoilers:true,reports,official:null});
    added++;
  }
  const feed={schemaVersion:1,updatedAt:now.toISOString(),groups:groups.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,500)};
  if (!validateGroupFeed(feed,sources)) throw Error('Invalid generated feed; refusing to publish.');
  return {feed,added,skipped,skipReasons};
}

