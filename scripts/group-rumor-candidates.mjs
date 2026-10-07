import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const months = {january:1,enero:1,february:2,febrero:2,march:3,marzo:3,april:4,abril:4,may:5,mayo:5,june:6,junio:6,july:7,julio:7,august:8,agosto:8,september:9,septiembre:9,october:10,octubre:10,november:11,noviembre:11,december:12,diciembre:12};
const monthPattern = Object.keys(months).join('|');
const nameToken = "(?:[A-Z][a-z]+(?:[A-Z][a-z]+)*|[A-Z]'[A-Z][a-z]+)";
const name = `${nameToken}(?:[ \\t]+${nameToken}){1,3}`;
const matchupPattern = new RegExp(`\\b(${name})\\s+(?:[Vv][Ss]\\.?|[Vv]ersus|[Cc]ontra|against|(?:could|may|might|will|would)\\s+(?:fight|face)|(?:se\\s+)?(?:enfrentara|enfrenta|enfrentaria)\\s+(?:al|a))\\s+(?:libanes\\s+)?(${name})\\b`);
const betweenPattern = new RegExp(`\\bentre\\s+(${name})\\s+y\\s+(${name})\\b`);

const narrativePatterns=[
  {kind:'response',pattern:new RegExp(`\\b(${name})\\s+(?:responds? to|responde a)\\s+(${name})\\b`)},
  {kind:'challenge',pattern:new RegExp(`\\b(${name})\\s+(?:offers?|challenges?|calls? out|reta a|desafia a)\\s+(${name})\\b`)},
  {kind:'claimed-agreement',pattern:new RegExp(`\\b(${name})\\s+(?:reveals?|says?|confirms?|afirma|revela)[^\\r\\n]{0,80}?\\b(?:agreed|accepted|aceptado|acordado)[^\\r\\n]{0,80}?\\b(?:fight|bout|pelea|combate)\\s+(?:with|against|con|contra)\\s+(${name})\\b`)},
];

export function groupCandidates(payload) {
  payload = {...payload,candidates:(payload.candidates ?? []).map(candidate => {
    const repaired = candidate.text.replace(/[\u00c2-\u00c3][\u0080-\u00bf]/g, part => Buffer.from(part,'latin1').toString('utf8'));
    return {...candidate,...(repaired !== candidate.text ? {originalText:candidate.originalText ?? candidate.text,text:repaired} : {}),...(/[\u00c3\u00c2\u00f0]/.test(repaired) ? {encodingWarning:'Legacy text may contain damaged characters; verify the original post.'} : {})};
  })};
  const groups = new Map();
  for (const candidate of payload.candidates ?? []) {
    // Normalize only a matching copy; retain every original text and source.
    const text = candidate.text.normalize('NFD').replace(/\p{M}/gu, '').replace(/[’‘]/g,"'").replace(/[^\x00-\x7F]/g, ' ').replace(/\([^)]*\)/g, ' ').replace(/[^\S\r\n]+/g, ' ');
    const narrative=narrativePatterns.map(item=>({...item,match:text.match(item.pattern)})).find(item=>item.match);
    const match = text.match(matchupPattern) ?? text.match(betweenPattern) ?? narrative?.match;
    const lower = text.toLowerCase();
    const date = lower.match(new RegExp(`\\b(${monthPattern})\\s+(\\d{1,2})(?:,?\\s+(20\\d{2}))?\\b`));
    const reversedDate = lower.match(new RegExp(`\\b(\\d{1,2})\\s+(?:de\\s+)?(${monthPattern})(?:\\s+(?:de\\s+)?(20\\d{2}))?\\b`));
    let dateMention = date ? {month:months[date[1]],day:Number(date[2]),year:date[3] ? Number(date[3]) : null} : reversedDate ? {month:months[reversedDate[2]],day:Number(reversedDate[1]),year:reversedDate[3] ? Number(reversedDate[3]) : null} : null;
    if (dateMention && (dateMention.day < 1 || dateMention.day > 31)) dateMention = null;
    const fighters = match ? [match[1].trim(),match[2].trim()].sort() : [];
    // Date-less or unidentified reports stay separate; grouping is not verification.
    const window = String(payload.checkedAt ?? '').slice(0,10);
    const key = fighters.length === 2 && dateMention ? `${window}:${fighters.join('|').toLowerCase()}:${JSON.stringify(dateMention)}` : `post:${candidate.id}`;
    if (!groups.has(key)) groups.set(key, {id:key,fighters,dateMention,discussionKind:narrative?.kind??'possible-matchup',status:'pending-review',reportIds:[],reports:[]});
    const group = groups.get(key);
    const attributedAccounts = [...new Set([...candidate.text.matchAll(/@([A-Za-z0-9_]{1,15})/g)].map(m=>m[1]))];
    group.reportIds.push(candidate.id);
    group.reports.push({...candidate,attributedAccounts});
  }
  return {...payload,groups:[...groups.values()]};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const input = readFileSync(process.argv[2] ?? 0,'utf8').replace(/^\uFEFF/,'');
  // ASCII JSON escapes prevent Windows PowerShell native-output decoding damage.
  process.stdout.write(JSON.stringify(groupCandidates(JSON.parse(input)),null,2).replace(/[^\x00-\x7F]/g, character=>'\\u'+character.charCodeAt(0).toString(16).padStart(4,'0'))+'\n');
}

