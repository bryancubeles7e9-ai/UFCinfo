import {canonicalFighter,normalizeName} from './rumor-fighter-names.mjs';
const identity=name=>normalizeName(canonicalFighter(name) ?? name).replaceAll(' ','');
const pairKey=names=>names.map(identity).sort().join('|');
const timestamp=value=>typeof value==='string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? Date.parse(value) : NaN;
const validName=value=>typeof value==='string' && value.trim().length>0 && value.length<=100;

// This is the synchronized calendar API snapshot, not an additional paid API query.
export function confirmedCalendar(feed) {
  const unavailable={available:false,synchronizedAt:null,match:()=>null};
  if (!feed || feed.schemaVersion!==1 || !['UFC','UFCalendar'].includes(feed.source) ||
      feed.sourceUrl!==(feed.source==='UFCalendar' ? 'https://www.ufcalendar.com' : 'https://www.ufc.com') ||
      !Number.isFinite(timestamp(feed.synchronizedAt)) || !Array.isArray(feed.events) || feed.events.length>100) return unavailable;
  const ids=new Set(),bouts=[];
  for (const event of feed.events) {
    if (!event || typeof event.id!=='string' || !/^ufc-[a-z0-9-]{1,100}$/.test(event.id) || ids.has(event.id) ||
        event.type!=='official' || event.source!==`https://www.ufc.com/event/${event.id}` ||
        !Number.isFinite(timestamp(event.date)) || !Array.isArray(event.bouts) || event.bouts.length>30 ||
        !['announced','scheduled','live','completed','cancelled'].includes(event.status)) return unavailable;
    ids.add(event.id);
    for (const bout of event.bouts) {
      if (!bout || !validName(bout.red) || !validName(bout.blue) || identity(bout.red)===identity(bout.blue)) return unavailable;
      if (event.status==='cancelled' || bout.status==='cancelled') continue;
      bouts.push({key:pairKey([bout.red,bout.blue]),eventId:event.id,date:event.date,status:event.status,url:event.source});
    }
  }
  return {available:true,synchronizedAt:feed.synchronizedAt,match(record) {
    if (!Array.isArray(record.fighterNames) || record.fighterNames.length!==2 || !record.fighterNames.every(validName)) return null;
    const posted=timestamp(record.publishedAt);
    if (!Number.isFinite(posted)) return null;
    let hinted;
    if (record.eventDateHint!=null) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(record.eventDateHint)) return null;
      hinted=Date.parse(record.eventDateHint+'T00:00:00Z');
      if (!Number.isFinite(hinted) || new Date(hinted).toISOString().slice(0,10)!==record.eventDateHint) return null;
    }
    return bouts.find(bout=>bout.key===pairKey(record.fighterNames) &&
      // A finished meeting is no longer a rumor, even when mentioned weeks later.
      // An explicit second fight posted after it refers to another meeting.
      (timestamp(bout.date)>=posted || (bout.status==='completed' && record.rematch!==true)) &&
      (record.eventId==null || record.eventId===bout.eventId) &&
      (hinted===undefined || Math.abs(Date.parse(bout.date.slice(0,10)+'T00:00:00Z')-hinted)<=86400000)) ?? null;
  }};
}
