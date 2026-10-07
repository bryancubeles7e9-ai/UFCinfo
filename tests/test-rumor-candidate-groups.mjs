import assert from 'node:assert/strict';
import {groupCandidates} from '../scripts/group-rumor-candidates.mjs';
const texts = [
  'Hecher Sosa 🇪🇸 enfrentará a Abdul Hussein 🇱🇧🇫🇮 el próximo 28 de noviembre. Informó primero: @KOlmeneroMMA',
  '🇪🇸Hecher Sosa (15-1) se enfrentará al libanés Abdul Hussein (16-2) el próximo 28 de noviembre en Riad (vía @KOlmeneroMMA)',
  'Breaking: Hecher Sosa (15-1) 🇪🇸 vs Abdul Hussein 🇱🇧🇫🇮 (16-2) is set for UFC Saudi Arabia on November 28. Vía: ABC MMA',
  'Póster oficial de la pelea entre Aleksandre Topuria y Santiago Luna del 21 de noviembre en Doha',
  'Esta pelea dos días después de salir GTA 6 me va a robar el tiempo',
];
const payload = {checkedAt:'2026-10-07T15:07:27Z',candidates:texts.map((text,i)=>({id:String(i),sourceId:String(i),postUrl:`https://x.com/test/status/${i}`,text}))};
const result = groupCandidates(payload);
assert.equal(result.groups.length,3);
assert.equal(result.groups[0].reports.length,3);
assert.deepEqual(result.groups[0].fighters,['Abdul Hussein','Hecher Sosa']);
assert.deepEqual(result.groups[0].dateMention,{month:11,day:28,year:null});
assert.deepEqual(result.groups[0].reports[0].attributedAccounts,['KOlmeneroMMA']);
assert.deepEqual(result.candidates,payload.candidates);
assert.equal(result.groups[1].reports[0].text,texts[3]);
assert.equal(groupCandidates({...payload,candidates:[payload.candidates[2],{...payload.candidates[2],id:'other',text:texts[2].replace('November 28','December 28')}]}).groups.length,2);
assert.equal(groupCandidates({...payload,candidates:[{id:'1',text:'Hecher Sosa vs Abdul Hussein'},{id:'2',text:'Hecher Sosa vs Abdul Hussein'}]}).groups.length,2);
assert.deepEqual(groupCandidates({candidates:[]}).groups,[]);
const legacy = groupCandidates({...payload,candidates:[{id:'legacy',text:'Hecher Sosa enfrentar\u00c3\u00a1 a Abdul Hussein el 28 de noviembre'}]});
assert.equal(legacy.candidates[0].text,'Hecher Sosa enfrentará a Abdul Hussein el 28 de noviembre');
assert.ok(legacy.candidates[0].originalText);
assert.deepEqual(legacy.groups[0].fighters,['Abdul Hussein','Hecher Sosa']);
console.log('PASS: multilingual matchups, Unicode, shared dates, separate rematches, attribution and original reports');
const pastedTexts = [
  'Esta pelea dos dÃ­as despuÃ©s de salir GTA 6 me va a robar el tiempo',
  'PÃ³ster oficial de la pelea entre Aleksandre Topuria y Santiago Luna del 21 de noviembre en Doha',
  'ð¨ AtenciÃ³n EspaÃ±a ð¨\n\nHecher Sosa ðªð¸ enfrentarÃ¡ a Abdul Hussein ð±ð§ð«ð® el prÃ³ximo 28 de noviembre en el #UFCSaudiArabia PELEÃN\n\nDura pelea, pero vamos con todo Hecher ð®ð¨ðª\n\nInformÃ³ primero: @KOlmeneroMMA',
  'ð¨BREAKING NEWSð¨\n\nðªð¸Hecher Sosa (15-1) se enfrentarÃ¡ al libanÃ©s Abdul Hussein (16-2) el prÃ³ximo 28 de noviembre en Riad (Arabia Saudita) en su segunda pelea en la UFC\n\n(vÃ­a @KOlmeneroMMA)',
  'ð¨Breaking: Hecher Sosa (15-1) ðªð¸ vs Abdul Hussein ð±ð§ð«ð® (16-2) is set for UFC Saudi Arabia on November 28 in the bantamweight division\n\nVÃ­a: ABC MMA',
];
const pasted = groupCandidates({...payload,candidates:pastedTexts.map((text,i)=>({id:String(i),text}))});
assert.equal(pasted.groups.length,3);
assert.equal(pasted.groups.find(g=>g.fighters.includes('Hecher Sosa')).reports.length,3);
console.log('PASS: five pasted reports form three groups without absorbing the headline into fighter names');
