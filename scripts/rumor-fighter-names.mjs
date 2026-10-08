import {fighters, fullName} from '../assets/js/data.js';
import {additionalFighters} from '../assets/js/fighter-directory-data.js';

export const normalizeName = value => value.normalize('NFD').replace(/\p{M}/gu, '').replace(/[’‘]/g, "'").toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const registry = new Map();
const add = (alias, canonical) => {
  const key = normalizeName(alias);
  if (!key) return;
  registry.set(key, registry.has(key) && registry.get(key) !== canonical ? null : canonical);
};
for (const fighter of [...fighters, ...additionalFighters]) {
  const canonical = fullName(fighter);
  for (const alias of [canonical, ...(fighter.aliases ?? []), fighter.last]) add(alias, canonical);
  if (fighter.id === 'garry') add('Ian Garry', canonical);
  if (fighter.id === 'zhang') add('Zhang Weili', canonical);
}
export const canonicalFighter = name => registry.get(normalizeName(name)) ?? null;
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Use complete aliases and only unambiguous surnames. Never infer a person from a first name.
const aliases = [...registry].filter(([, value]) => value).map(([key]) => escape(key).replaceAll(' ', '[\\s\x27-]+')).sort((a,b) => b.length-a.length);
const identity = `(?:${aliases.join('|')})`;
const patterns = [
  {kind:'response', connector:'(?:responds? to|responde a)'},
  {kind:'challenge', connector:'(?:offers?|challenges?|calls? out|reta a|desafia a)'},
  {kind:'claimed-agreement', connector:'(?:reveals?|says?|confirms?|afirma|revela)[^.!?\\r\\n]{0,80}?(?:agreed|accepted|aceptado|acordado)[^.!?\\r\\n]{0,80}?(?:fight|bout|pelea|combate)\\s+(?:with|against|con|contra)'},
  {kind:'possible-matchup', connector:'(?:is|are|esta|estan)\\s+(?:in talks|negotiating|negociando)[^.!?\\r\\n]{0,80}?(?:with|against|con|contra)'},
  {kind:'possible-matchup', connector:'(?:vs\\.?|versus|contra|against|v|(?:could|may|might|will|would)\\s+(?:fight|face)|(?:se\\s+)?(?:enfrentara|enfrenta|enfrentaria|peleara|pelearia|medira)\\s+(?:al|a|con|contra))'},
];
const matchers=patterns.map(({kind,connector})=>({kind,pattern:new RegExp(`(?<![a-z0-9])(${identity})\\s+${connector}\\s+(${identity})(?![a-z0-9])`,'i')}));
matchers.push({kind:'possible-matchup',pattern:new RegExp(`\\b(?:entre|between)\\s+(${identity})\\s+(?:y|and)\\s+(${identity})(?![a-z0-9])`,'i')});
export function catalogMatchup(text) {
  // Preserve punctuation for sentence boundaries and normalize accent/case for matching.
  const normalized=text.normalize('NFD').replace(/\p{M}/gu,'').replace(/[’‘]/g,"'").replace(/\([^)]*\)/g,' ').replace(/[^\x00-\x7F]/g,' ').replace(/[^\S\r\n]+/g,' ');
  const found=[];
  for (const {kind,pattern} of matchers) {
    for (const match of normalized.matchAll(new RegExp(pattern.source,'gi'))) {
      const names=[canonicalFighter(match[1]),canonicalFighter(match[2])].sort();
      if (names[0] && names[0]!==names[1]) found.push({fighters:names,kind});
    }
  }
  const pairs=new Set(found.map(item=>item.fighters.join('|')));
  if (pairs.size>1) return {fighters:[],kind:'ambiguous'};
  return found[0] ?? null;
}
