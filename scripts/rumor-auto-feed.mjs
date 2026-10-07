import {groupCandidates} from './group-rumor-candidates.mjs';
import {candidateImport,validateGroupFeed} from '../assets/js/rumor-groups.js';

export const boxingPattern=/\b(boxing|boxeo|boxeador(?:es)?|boxeadoras?|pugilismo|tyson\s+fury|anthony\s+joshua|fury\s+vs\.?\s+joshua|aj[- ]fury)\b/i;
const officialPattern=/\b(?:p[oó]ster\s+oficial|official\s+(?:poster|announcement)|confirmed\s+by\s+ufc|confirmad[oa]\s+por\s+(?:la\s+)?ufc)\b/i;
const opinionPattern=/\b(?:ojal[aá]|me\s+gustar[ií]a|would\s+love|i\s+wish|fantasy\s+matchup|dream\s+fight)\b/i;
const bookingPattern=/\b(?:in\s+talks|targeted|expected\s+to\s+face|set\s+(?:to\s+face|for)|booking|negociaciones|enfrentar[aá]|pelear[aá]|reportedly)\b/i;
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
    if(!texts.some(text=>/\bufc\b|#ufc/i.test(text)))reasons.push('no-ufc-reference');
    if(!texts.some(text=>bookingPattern.test(text)))reasons.push('no-booking-language');
    if(texts.some(text=>boxingPattern.test(text)))reasons.push('boxing');
    if(texts.some(text=>officialPattern.test(text)))reasons.push('official-announcement');
    if(texts.some(text=>opinionPattern.test(text)))reasons.push('opinion');
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
    groups.push({id:reports[0].id,fighterNames:candidate.fighters,matchupKey,eventDateHint,dateYearInferred:date ? date.year===null : false,
      summary:{es:`${reporter} reporta una posible pelea entre ${first} y ${second}${date ? ` para el ${date.day} de ${monthNames.es[date.month-1]}` : ', sin fecha indicada en la fuente'}. Información pendiente de confirmación oficial de UFC.`,en:`${reporter} reports a possible fight between ${first} and ${second}${date ? ` for ${monthNames.en[date.month-1]} ${date.day}` : ', with no date stated by the source'}. Awaiting official UFC confirmation.`},
      processing:'automatic',generatedAt:now.toISOString(),reviewedAt:null,publishedAt,containsSpoilers:true,reports,official:null});
    added++;
  }
  const feed={schemaVersion:1,updatedAt:now.toISOString(),groups:groups.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,500)};
  if (!validateGroupFeed(feed,sources)) throw Error('Invalid generated feed; refusing to publish.');
  return {feed,added,skipped,skipReasons};
}

