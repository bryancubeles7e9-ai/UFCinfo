import assert from 'node:assert/strict';
import {pickKey} from '../assets/js/pickem-model.js';
const listeners = {};
const root = {innerHTML:'',addEventListener(name,handler){listeners[name]=handler;},querySelector(){return null;}};
globalThis.document = {querySelector:()=>root,addEventListener(){}};
globalThis.window = {localStorage:{getItem:()=>null},addEventListener(){}};
globalThis.setInterval = ()=>0;
const bout = {red:'A',blue:'B',winner:'A',section:'main',division:'Lightweight'};
const past = {id:'past',title:'Past event',date:'2026-10-24T18:00:00Z',status:'completed',type:'official',bouts:[bout]};
const next = {...past,id:'next',title:'Next event',date:'2027-01-01T18:00:00Z',status:'scheduled',bouts:[{...bout,winner:null}]};
const state = {serverTime:Date.now(),authenticated:true,alias:'Tester',nextEventId:'next',events:[
 {event:next,joined:false,closed:false,closesAt:Date.now()+3600000,picks:{},revision:0},
 {event:past,joined:true,closed:true,closesAt:1,picks:{[pickKey(bout)]:'A'},revision:1,result:{score:100,correct:1,total:1,final:true,void:false}}
]};
const requests=[];
globalThis.fetch = async url=>{
 requests.push(url);
 return new Response(JSON.stringify(url.includes('ranking')?{rows:[],total:0}:state),{headers:{'Content-Type':'application/json'}});
};
const {initializePickem} = await import('../assets/js/pickem.js');
const app=initializePickem();app.update([next,past]);
await new Promise(resolve=>setTimeout(resolve,0));
assert.ok(!root.innerHTML.includes('Resumen de tus resultados'));
assert.ok(!root.innerHTML.includes('value="year"'));
listeners.change({target:{id:'pickem-event',value:'past'}});
assert.ok(root.innerHTML.includes('Resumen de tus resultados'));
assert.ok(root.innerHTML.includes('Puntuación final'));
assert.ok(root.innerHTML.includes('<dt>Puntos</dt><dd>100</dd>'));
assert.ok(root.innerHTML.includes('Pick acertado'));
assert.ok(root.innerHTML.includes('Ganador'));
assert.ok(root.innerHTML.includes('data-pick-side="0" aria-pressed="true" disabled'));
listeners.change({target:{id:'pickem-scope',value:'event'}});
await new Promise(resolve=>setTimeout(resolve,0));
assert.ok(requests.some(url=>url.includes('scope=past')));
console.log('PASS Pick’em view: past results, saved choices, locked history, event leaderboard and no season filter');

assert.ok(root.innerHTML.includes('value="past"'));
listeners.change({target:{id:'pickem-event',value:'next'}});
listeners.change({target:{id:'pickem-scope',value:'past'}});
await new Promise(resolve=>setTimeout(resolve,0));
assert.ok(requests.at(-1).includes('scope=past'));
console.log('PASS Pick’em ranking: previous completed event remains available when next event is selected');
