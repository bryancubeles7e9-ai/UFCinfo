import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {groupCandidates} from '../scripts/group-rumor-candidates.mjs';
import {candidateImport,parseCandidateFile,reviewedGroup,validateGroupFeed,filterGroups,groupCard} from '../assets/js/rumor-groups.js';
import {setSpoilersEnabled,revealResult} from '../assets/js/spoilers.js';
import {setLanguage} from '../assets/js/i18n.js';
const {sources}=JSON.parse(await readFile(new URL('../assets/data/ufc-rumors.json',import.meta.url)));
const candidates=[
 {id:'2107747599155708089',sourceId:'kolmenero',postUrl:'https://x.com/KOlmeneroMMA/status/2107747599155708089',text:'Hecher Sosa vs Abdul Hussein on November 28. Via: ABC MMA',publishedAt:'Wed Oct 07 08:19:22 +0000 2026',language:'en'},
 {id:'2107750144795975680',sourceId:'pelunaton',postUrl:'https://x.com/pelunaton/status/2107750144795975680',text:'Hecher Sosa se enfrentará a Abdul Hussein el 28 de noviembre (vía @KOlmeneroMMA)',publishedAt:'Wed Oct 07 08:29:29 +0000 2026',language:'es'},
];
const imported=candidateImport(groupCandidates({checkedAt:'2026-10-07T15:07:27Z',candidates}),sources);
assert.equal(imported.length,1);
assert.equal(imported[0].reports.length,2);
assert.equal(parseCandidateFile('\uFEFF'+JSON.stringify(groupCandidates({checkedAt:'2026-10-07T15:07:27Z',candidates})),sources).length,1);
assert.throws(()=>parseCandidateFile('{"groups":[]}',sources),/grupos para publicar/);
assert.throws(()=>parseCandidateFile('invalid',sources),/JSON válido/);
assert.throws(()=>parseCandidateFile(JSON.stringify({candidates}),sources),/ReprocessExisting/);
const values={fighterNames:['Hecher Sosa','Abdul Hussein'],summary:{es:'Reporte atribuido a ABC MMA <script>alert(1)</script>',en:'A reported matchup, not an official announcement.'},checked:true};
assert.throws(()=>reviewedGroup(imported[0],{...values,checked:false}));
const reviewed=reviewedGroup(imported[0],values);
const feed={schemaVersion:1,updatedAt:new Date().toISOString(),groups:[reviewed]};
assert.ok(validateGroupFeed(feed,sources));
assert.ok(reviewed.reports.every(report=>!('text' in report) && !('originalText' in report)));
assert.equal(filterGroups(feed,sources,{source:'pelunaton'}).length,1);
assert.equal(filterGroups(feed,sources,{language:'es'}).length,1);
assert.equal(filterGroups(feed,sources,{query:'Sosa'}).length,1);
assert.equal(filterGroups(feed,sources,{query:'alert'}).length,0);
assert.equal(filterGroups(feed,sources,{status:'confirmed'}).length,0);
setSpoilersEnabled(true);
let html=groupCard(reviewed,sources);
assert.ok(!html.includes('alert(1)'));
revealResult('rumor-group:'+reviewed.id);
html=groupCard(reviewed,sources);
assert.ok(html.includes('&lt;script&gt;') && !html.includes('<script>'));
assert.ok(html.includes(candidates[0].postUrl) && html.includes(candidates[1].postUrl));
assert.ok(html.includes('Cita a @KOlmeneroMMA'));
setLanguage('en');assert.ok(groupCard(reviewed,sources).includes(values.summary.en));setLanguage('es');
for (const mutate of [g=>g.fighterNames=['Sosa','Sosa'],g=>g.summary.es='',g=>g.reports[0].postUrl='javascript:alert(1)',g=>g.reports[0].sourceId='unknown',g=>g.reports[0].attributedAccounts=['bad<script>'],g=>g.official={url:'https://ufc.com'},g=>g.reviewedAt='invalid']) {
 const bad=structuredClone(feed);mutate(bad.groups[0]);assert.equal(validateGroupFeed(bad,sources),false);
}
assert.equal(validateGroupFeed({...feed,groups:[reviewed,reviewed]},sources),false);
assert.throws(()=>candidateImport({...groupCandidates({candidates}),candidates:[{...candidates[0],postUrl:'https://evil.test'}]},sources));
assert.throws(()=>candidateImport({candidates:[candidates[0],candidates[0]],groups:[]},sources));
console.log('PASS: private import, source validation, grouped publication, summaries, attribution, spoilers and escaped rendering');
