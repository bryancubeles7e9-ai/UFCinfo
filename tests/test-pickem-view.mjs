import assert from 'node:assert/strict';
import {pickKey} from '../assets/js/pickem-model.js';
const listeners = {};
let tick; const timerNode={textContent:""};
const root = {innerHTML:'',addEventListener(name,handler){listeners[name]=handler;},querySelector(selector){return selector==='#pickem-countdown' && this.innerHTML.includes('id="pickem-countdown"') ? timerNode : null;}};
globalThis.document = {querySelector:()=>root,addEventListener(){}};
globalThis.window = {localStorage:{getItem:()=>null},addEventListener(){}};
globalThis.setInterval = fn=>{tick=fn;return 0;};
const bout = {red:'A',blue:'B',winner:'A',section:'main',division:'Lightweight'};
const past = {id:'past',title:'Past event',date:'2026-10-24T18:00:00Z',status:'completed',type:'official',bouts:[bout]};
const next = {...past,id:'next',title:'Next event',date:'2027-01-01T18:00:00Z',status:'scheduled',bouts:[{...bout,winner:null}]};
const state = {serverTime:Date.now(),authenticated:true,alias:'Tester',nextEventId:'next',events:[
 {event:next,joined:false,closed:false,closesAt:Date.now()+3600000,picks:{},revision:0},
 {event:past,joined:true,closed:true,closesAt:1,picks:{[pickKey(bout)]:'A'},revision:1,result:{score:100,correct:1,total:1,final:true,void:false}}
]};
const requests=[];
let submitted=null; let board={rows:[],total:0}; let saveFails=false;
globalThis.fetch = async (url,options)=>{
 requests.push(url);
 if(url.endsWith('/me/pickem')){
  submitted=JSON.parse(options.body);
  if(saveFails)return new Response(JSON.stringify({error:'Save failed'}),{status:500,headers:{'Content-Type':'application/json'}});
 }
 return new Response(JSON.stringify(url.includes('ranking')?board:url.endsWith('/auth/session')?{user:{username:'Tester'},csrf:'fake'}:state),{headers:{'Content-Type':'application/json'}});
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
assert.ok(root.innerHTML.includes('data-pick-side="0" data-pick-method="general" aria-pressed="true" disabled'));
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

assert.equal((root.innerHTML.match(/data-pick-method=/g)||[]).length,8);
const methodButton = {dataset:{pickBout:'0',pickSide:'0',pickMethod:'ko'}};
listeners.click({target:{closest:selector=>selector==='[data-pick-bout]'?methodButton:null}});
assert.ok(root.innerHTML.includes('data-pick-method="ko" aria-pressed="true"'));
assert.ok(!root.innerHTML.includes('data-pick-method="general" aria-pressed="true"'));
assert.ok(root.innerHTML.includes('Cambios sin guardar'));
console.log('PASS Pick’em method selection: four options per fighter, one selection per bout');

saveFails=true;
await listeners.click({target:{closest:selector=>selector==='#pickem-save'?{}:null}});
assert.ok(!root.innerHTML.includes('class="action-confirmation"'),'A failed save must not show a success check');
assert.ok(root.innerHTML.includes('data-pick-method="ko" aria-pressed="true"'),'Failed save preserves the draft');
saveFails=false;
await listeners.click({target:{closest:selector=>selector==='#pickem-save'?{}:null}});
assert.ok(root.innerHTML.includes('class="action-confirmation"'),'A confirmed save shows its check');
const feedbackNow=Date.now;
try {
 const later=feedbackNow()+1000;Date.now=()=>later;app.render();
 assert.ok(root.innerHTML.includes('--check-delay:-360ms'),'A ranking rerender must not restart the check drawing');
} finally {Date.now=feedbackNow;}
listeners.click({target:{closest:selector=>selector==='[data-pick-bout]'?methodButton:null}});
assert.ok(!root.innerHTML.includes('class="action-confirmation"'),'A new edit clears the saved confirmation');
console.log('PASS save feedback: confirmed response only, no check on failure, draft preserved, no animation replay and reset on edit');
assert.deepEqual(submitted.picks[pickKey(bout)],{winner:'A',method:'ko'});
assert.equal(submitted.eventId,'next');
assert.equal(submitted.revision,0);
state.events[1].picks={[pickKey(bout)]:{winner:'A',method:'ko'}};
state.events[1].event.bouts[0].method='KO/TKO';
state.events[1].result.score=350;
await listeners.click({target:{closest:selector=>selector==='#pickem-refresh'?{}:null}});
listeners.change({target:{id:'pickem-event',value:'past'}});
assert.ok(root.innerHTML.includes('<dt>Puntos</dt><dd>350</dd>'));
assert.ok(root.innerHTML.includes('Pick acertado</strong> · 350'));
assert.ok(root.innerHTML.includes('data-pick-method="ko" aria-pressed="true" disabled'));
console.log('PASS Pick’em save and history: method sent to API and 350-point result shown');

const me={alias:'Tester',position:51,score:350,correct:1,total:1,played:1,pending:0,isYou:true};
board={rows:[],total:51,me,myPage:2};
listeners.change({target:{id:'pickem-scope',value:'all'}});
await new Promise(resolve=>setTimeout(resolve,0));
assert.ok(root.innerHTML.includes('Tu clasificación'));
assert.ok(root.innerHTML.includes('#51'));
assert.ok(root.innerHTML.includes('Ver mi posición en la tabla'));
board.rows=[me];
await listeners.click({target:{closest:selector=>selector==='#pickem-find-me'?{}:null}});
assert.ok(requests.at(-1).includes('page=2'));
assert.ok(root.innerHTML.includes('<tr class="is-you">'));
assert.ok(root.innerHTML.includes('pickem-you">Tú'));
const realNow=Date.now; let fakeNow=Date.parse('2026-10-25T10:00:00Z');
Date.now=()=>fakeNow;
try {
  state.serverTime=fakeNow;state.events[0].closesAt=fakeNow+3000;
  await listeners.click({target:{closest:selector=>selector==='#pickem-refresh'?{}:null}});
  listeners.change({target:{id:'pickem-event',value:'next'}});
  listeners.click({target:{closest:selector=>selector==='[data-pick-bout]'?methodButton:null}});
  assert.ok(root.innerHTML.includes('00:00:03'));
  const before=root.innerHTML;fakeNow+=1000;tick();
  assert.equal(timerNode.textContent,'00:00:02');
  assert.equal(root.innerHTML,before); // Tick must not discard picks or focus.
  fakeNow+=2001;tick();
  assert.ok(!root.innerHTML.includes('id="pickem-countdown"'));
  assert.ok(root.innerHTML.includes('Pronósticos cerrados'));
  assert.ok(root.innerHTML.includes('data-pick-method="ko" aria-pressed="true" disabled'));
} finally {Date.now=realNow;}
console.log('PASS personal ranking and countdown: off-page summary, find-me, row highlight, ticking without rerender and deadline lock');
