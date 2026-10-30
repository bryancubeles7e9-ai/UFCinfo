import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source = readFileSync(new URL('../assets/js/adsense.js', import.meta.url), 'utf8');
const {validAdConfig, consentAllowsAds, initializeAdSense} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const config = {enabled:true, client:'ca-pub-1234567890123456', slots:{home:'1234567890',events:'0987654321'}, certifiedCmpReady:true, privacyUrl:'/assets/privacy.html'};
const origin = 'https://ufcinfo.example';
const granted = () => ({cmpStatus:'loaded',eventStatus:'tcloaded',gdprApplies:true,tcString:'consent-from-certified-cmp',vendor:{consents:{755:true}},purpose:{consents:{1:true,3:true,4:true}}});
assert.equal(validAdConfig(config, origin), true);
for (const altered of [{enabled:false},{client:''},{slots:{home:'123',events:'0987654321'}},{certifiedCmpReady:false},{privacyUrl:''},{privacyUrl:'https://external.example/privacy'},{privacyUrl:'//external.example/privacy'}]) {
  assert.equal(validAdConfig({...config,...altered}, origin), false);
}
assert.equal(consentAllowsAds(granted(),true), true);
for (const data of [undefined,{}, {...granted(),gdprApplies:undefined},{...granted(),tcString:''}, {...granted(),vendor:{consents:{755:false}}}, {...granted(),purpose:{consents:{1:true,3:false,4:true}}}]) assert.equal(consentAllowsAds(data,true),false);
assert.equal(consentAllowsAds(granted(),false),false);

class Element {
  constructor(key) { this.dataset={adPlacement:key}; this.hidden=true; this.clientWidth=400; this.children=[]; this.attributes={}; this.events={}; this.caption={textContent:''}; this.viewHidden=key==='events'; }
  closest() { return this.hidden || this.viewHidden ? this : null; }
  querySelector() { return this.caption; }
  append(node) { this.children.push(node); }
  setAttribute(k,v) { this.attributes[k]=v; }
  addEventListener(k,fn) { this.events[k]=fn; }
}
function fixture(settings=config, cmp=true) {
  const nodes=[new Element('home'),new Element('events')], scripts=[], timers=[], pageEvents={}, docEvents={};
  let consentCallback, reloads=0;
  const privacy=new Element();
  const win={location:{origin,reload(){reloads++;}},setTimeout(fn){timers.push(fn);},addEventListener(k,fn){pageEvents[k]=fn;},
    IntersectionObserver:class {constructor(fn){win.intersection=fn;} observe(){} disconnect(){win.disconnected=true;}}};
  if(cmp) win.__tcfapi=(command,version,fn)=>{assert.equal(command,'addEventListener');assert.equal(version,2);consentCallback=fn;};
  const doc={documentElement:{lang:'es'},head:{append(node){scripts.push(node);}},querySelectorAll(){return nodes;},querySelector(){return privacy;},createElement(){return new Element();},addEventListener(k,fn){(docEvents[k]??=[]).push(fn);}};
  return {win,doc,nodes,scripts,timers,privacy,pageEvents,docEvents,get reloads(){return reloads;}, consent(data,success=true){consentCallback(data,success);}, intersect(node=nodes[0]){win.intersection([{target:node,isIntersecting:true}]);}, start:()=>initializeAdSense({doc,win,fetcher:async()=>({ok:true,json:async()=>settings})})};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const off=fixture({...config,enabled:false}); await off.start(); assert.equal(off.scripts.length,0); assert.ok(off.nodes.every(n=>n.hidden)); assert.equal(off.privacy.hidden,true);
const absent=fixture(config,false); await absent.start(); for(let i=0;i<30;i++) absent.timers.shift()?.(); assert.equal(absent.scripts.length,0); assert.ok(absent.nodes.every(n=>n.hidden)); assert.equal(absent.timers.length,0);
const f=fixture(); await f.start(); assert.equal(f.scripts.length,0); f.consent({...granted(),purpose:{consents:{}}}); assert.ok(f.nodes.every(n=>n.hidden));
f.consent(granted()); assert.equal(f.scripts.length,0,'permission alone does not load Google');
f.intersect(f.nodes[1]); assert.equal(f.scripts.length,0,'hidden routes do not request ads');
f.nodes[0].clientWidth=0;f.intersect();assert.equal(f.scripts.length,0,'zero-width slots wait');f.nodes[0].clientWidth=400;
f.intersect();f.intersect();assert.equal(f.scripts.length,1,'script loads once');assert.equal(f.nodes[0].children.length,0);
f.scripts[0].events.load(); await tick(); assert.equal(f.nodes[0].children.length,1);assert.equal(f.win.adsbygoogle.length,1);assert.equal(f.nodes[0].children[0].attributes['data-ad-slot'],config.slots.home);
f.consent({...granted(),eventStatus:'cmpuishown'});assert.equal(f.reloads,0,'opening privacy controls is not withdrawal');
f.pageEvents.hashchange();f.intersect();await tick();assert.equal(f.win.adsbygoogle.length,1,'navigation does not duplicate slots');
f.nodes[0].viewHidden=true;f.nodes[1].viewHidden=false;f.pageEvents.hashchange();f.intersect(f.nodes[1]);await tick();assert.equal(f.win.adsbygoogle.length,2);assert.equal(f.scripts.length,1);
f.consent({...granted(),eventStatus:'useractioncomplete',purpose:{consents:{}}});assert.equal(f.reloads,1);assert.ok(f.nodes.every(n=>n.hidden));f.intersect();await tick();assert.equal(f.win.adsbygoogle.length,2);
const blocked=fixture();await blocked.start();blocked.consent(granted());blocked.intersect();blocked.scripts[0].events.error();await tick();assert.ok(blocked.nodes.every(n=>n.hidden));assert.equal(blocked.win.adsbygoogle,undefined);
const pending=fixture();await pending.start();pending.consent(granted());pending.intersect();pending.consent({...granted(),purpose:{consents:{}}});pending.scripts[0].events.load();await tick();assert.equal(pending.win.adsbygoogle,undefined,'withdrawal while script is loading must not enqueue an ad');
const liveConfig=JSON.parse(readFileSync(new URL('../assets/data/adsense.json',import.meta.url),'utf8'));assert.equal(liveConfig.enabled,false);assert.equal(liveConfig.client,'');
console.log('PASS: configuration gates, CMP unknown/denied/granted/withdrawn, lazy visible slots, no duplicate ads, blocker isolation; no external requests.');
