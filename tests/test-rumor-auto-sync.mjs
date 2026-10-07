import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {automaticFeed} from '../scripts/rumor-auto-feed.mjs';
import {syncRumors} from '../scripts/sync-rumors.mjs';
import {validateGroupFeed,groupCard} from '../assets/js/rumor-groups.js';
// Keep mocked API tests independent of production credentials.
process.env.TWITTERAPI_IO_KEY='fake-test-key';
const now=new Date('2026-10-07T16:00:00Z');
const sources=[{id:'kolmenero',name:'Álvaro Colmenero',handle:'KOlmeneroMMA',language:'es',profile:'https://x.com/KOlmeneroMMA'},{id:'pelunaton',name:'Pelunaton',handle:'pelunaton',language:'es',profile:'https://x.com/pelunaton'}];
const candidate=(id,text,sourceId='kolmenero')=>({id,sourceId,postUrl:`https://x.com/${sources.find(s=>s.id===sourceId).handle}/status/${id}`,text,publishedAt:'2026-10-07T08:19:22Z',language:'es'});
const first=candidate('2107747599155708089','Hecher Sosa vs Abdul Hussein is set for UFC Saudi Arabia on November 28\nVía: ABC MMA');
const second=candidate('2107750144795975680','Hecher Sosa se enfrentará a Abdul Hussein el 28 de noviembre en UFC. Vía @KOlmeneroMMA','pelunaton');
const payload={checkedAt:now.toISOString(),candidates:[first,second,candidate('2107834082587459654','Póster oficial de la pelea entre Aleksandre Topuria y Santiago Luna del 21 de noviembre en UFC'),candidate('2107838271237558664','Esta pelea dos días después de salir GTA 6 me va a robar el tiempo')]};
const result=automaticFeed(payload,sources,undefined,now);
assert.equal(result.feed.groups.length,1);
assert.equal(result.skipped,2);
assert.equal(result.skipReasons['official-announcement'],1);
assert.equal(result.skipReasons['fighters-not-detected'],1);
assert.equal(result.skipReasons['date-not-detected'],undefined);
const undatedPayload={...payload,candidates:[candidate('2107747599155708095','Hecher Sosa vs Abdul Hussein is targeted')]};
const undated=automaticFeed(undatedPayload,sources,undefined,now);
assert.equal(undated.feed.groups.length,1);
assert.equal(undated.skipReasons['no-ufc-reference'],undefined);
assert.equal(undated.feed.groups[0].eventDateHint,null);
assert.ok(undated.feed.groups[0].summary.es.includes('sin fecha exacta indicada'));
assert.ok(undated.feed.groups[0].summary.en.includes('no exact date stated'));
assert.ok(validateGroupFeed(undated.feed,sources));
assert.equal(automaticFeed(undatedPayload,sources,undated.feed,now).feed.groups.length,1);
assert.equal(result.feed.groups[0].reports.length,2);
assert.equal(result.feed.groups[0].reports[0].attribution,'ABC MMA');
assert.equal(result.feed.groups[0].reviewedAt,null);
assert.ok(validateGroupFeed(result.feed,sources));
assert.ok(groupCard(result.feed.groups[0],sources).includes('Recopilado automáticamente'));
assert.equal(automaticFeed(payload,sources,result.feed,now).feed.groups.length,1);
assert.equal(automaticFeed({...payload,candidates:[candidate('2107747599155708090','Hecher Sosa vs Abdul Hussein is set for UFC Saudi Arabia on December 28')]},sources,result.feed,now).feed.groups.length,2);
assert.equal(automaticFeed({...payload,candidates:[candidate('2107747599155708091','I wish Hecher Sosa vs Abdul Hussein on November 28')]},sources,undefined,now).feed.groups.length,1);
const community=automaticFeed({...payload,candidates:[candidate('2107747599155708092','¿Hecher Sosa vs Abdul Hussein? Me gustaría esa pelea.')]},sources,undefined,now);
assert.equal(community.feed.groups.length,1);
assert.equal(community.feed.groups[0].official,null);
assert.equal(community.skipReasons['no-booking-language'],undefined);

const examples=[
 ['2106844191712223558','Sean O’Malley responds to Payton Talbott accusing him of running from a fight 👀',["Payton Talbott","Sean O'Malley"],'respuesta pública'],
 ['2106866511814005038','Nassourdine Imavov offers Sean Strickland $500K if he beats him 😳',['Nassourdine Imavov','Sean Strickland'],'reto público'],
 ['2107009056577667336','Ian Garry reveals he’s agreed to a main-event fight with Michael Morales and the "date is locked in" 👀',['Ian Garry','Michael Morales'],'haber aceptado'],
];
for(const [id,text,names,description] of examples){
 const feed=automaticFeed({...payload,candidates:[candidate(id,text)]},sources,undefined,now);
 assert.equal(feed.feed.groups.length,1);
 assert.deepEqual(feed.feed.groups[0].fighterNames,names);
 assert.ok(feed.feed.groups[0].summary.es.includes(description));
 assert.equal(feed.feed.groups[0].eventDateHint,null);
 assert.equal(feed.feed.groups[0].official,null);
}

const root=await mkdtemp(join(tmpdir(),'ufcinfo-auto-test-'));
try {
 await mkdir(join(root,'assets/data'),{recursive:true});await mkdir(join(root,'.ufcinfo-data'));
 await writeFile(join(root,'assets/data/ufc-rumors.json'),JSON.stringify({sources}));
 await writeFile(join(root,'.ufcinfo-data/twitterapi.key'),'fake-test-key');
 await writeFile(join(root,'candidates.json'),JSON.stringify(payload));
 const config={enabled:true,intervalMinutes:60,maxPagesPerRun:2,creditLimit:600,creditsPerTweet:15,lookbackHours:24};
 let calls=0;
 const api=async(url,options)=> {
   calls++;assert.equal(options.headers['X-API-Key'],'fake-test-key');assert.ok(!String(url).includes('fake-test-key'));
   if(calls===2)assert.equal(url.searchParams.get('cursor'),'next');
   const c=calls===1?first:second;
   return new Response(JSON.stringify({tweets:[{id:c.id,text:c.text,author:{userName:sources.find(s=>s.id===c.sourceId).handle},createdAt:c.publishedAt,lang:c.language}],has_next_page:calls===1,next_cursor:calls===1?'next':''}));
 };
 const live=await syncRumors({projectRoot:root,configOverride:config,fetchImpl:api,now});
 assert.equal(calls,2);assert.equal(live.feed.groups.length,1);assert.equal(live.feed.groups[0].reports.length,2);assert.equal(live.reservedCredits,600);
 const due=await syncRumors({projectRoot:root,configOverride:config,fetchImpl:api,now});assert.equal(due.requests,0);
 const limited=await syncRumors({projectRoot:root,configOverride:config,fetchImpl:api,now:new Date(now.getTime()+3600001)});assert.equal(limited.requests,0);assert.equal(calls,2);
 const offline=await syncRumors({projectRoot:root,configOverride:config,fromFile:join(root,'candidates.json'),fetchImpl:()=>{throw Error('Must not fetch');},now});assert.equal(offline.requests,0);
 const before=await readFile(join(root,'assets/data/ufc-rumor-groups.json'),'utf8');
 await writeFile(join(root,'.ufcinfo-data/rumor-sync-state.json'),JSON.stringify({schemaVersion:1,reservedCredits:0,estimatedCredits:0,lastSuccessAt:null,pending:null,archive:[]}));
 await assert.rejects(syncRumors({projectRoot:root,configOverride:config,fetchImpl:async()=>new Response('',{status:429}),now}));
 assert.equal(await readFile(join(root,'assets/data/ufc-rumor-groups.json'),'utf8'),before);
 assert.equal(JSON.parse(await readFile(join(root,'.ufcinfo-data/rumor-sync-state.json'),'utf8')).reservedCredits,300);
 await assert.rejects(syncRumors({projectRoot:root,configOverride:{...config,enabled:false},fetchImpl:()=>{throw Error('Must not fetch');},now}),/disabled/);
 let durableSaved=false,paidCalls=0;
 const stateStore={load:async()=>({schemaVersion:1,reservedCredits:0,estimatedCredits:0,lastSuccessAt:null,pending:null,archive:[]}),save:async state=>{assert.ok(state.reservedCredits>=300);durableSaved=true;}};
 await syncRumors({projectRoot:root,configOverride:config,stateStore,fetchImpl:async()=>{assert.ok(durableSaved);paidCalls++;return new Response(JSON.stringify({tweets:[],has_next_page:false}));},now});
 assert.equal(paidCalls,1);
 let broadCalls=0;
 const broad=await syncRumors({projectRoot:root,configOverride:config,backfillHours:168,stateStore:{load:async()=>({schemaVersion:1,reservedCredits:0,estimatedCredits:0,lastSuccessAt:now.toISOString(),pending:null,archive:[]}),save:async()=>{}},fetchImpl:async url=>{broadCalls++;assert.ok(url.searchParams.get('query').includes(`since_time:${Math.floor(now.getTime()/1000)-168*3600}`));return new Response(JSON.stringify({tweets:[],has_next_page:false}));},now});
 assert.equal(broad.requests,1);assert.equal(broadCalls,1);
 await assert.rejects(syncRumors({projectRoot:root,configOverride:config,backfillHours:169,fetchImpl:()=>{throw Error('Must not fetch');},now}),/Invalid backfill/);
 await assert.rejects(syncRumors({projectRoot:root,configOverride:config,stateStore:{...stateStore,save:async()=>{throw Error('GitHub unavailable');}},fetchImpl:()=>{throw Error('Must not make paid request');},now}),/GitHub unavailable/);
} finally {await rm(root,{recursive:true,force:true});}
console.log('PASS: automatic bilingual feed, filters, attribution, rematches, pagination, deduplication, interval, credit cap, offline processing and preserved data on API failure');

