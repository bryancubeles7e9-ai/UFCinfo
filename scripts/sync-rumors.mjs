import {readFile,writeFile,rename,mkdir,open,unlink} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {automaticFeed,boxingPattern} from './rumor-auto-feed.mjs';
import {githubRumorState} from './github-rumor-state.mjs';

const root=resolve(import.meta.dirname,'..');
const endpoint='https://api.twitterapi.io/twitter/tweet/advanced_search';
const keywords='("in talks" OR "targeted" OR "expected to face" OR "set to face" OR "booking" OR "negociaciones" OR "pelea" OR "combate" OR "vs" OR "versus" OR "fight" OR "against" OR "rumor" OR "rumour" OR "posible" OR "rival" OR "enfrentamiento" OR "offers" OR "challenges" OR "call out" OR "reto" OR "desafia")';
async function readJSON(path,fallback) {
  try {return JSON.parse((await readFile(path,'utf8')).replace(/^\uFEFF/,''));}
  catch(error) {if (error.code==='ENOENT' && fallback!==undefined) return fallback;throw error;}
}
async function atomicJSON(path,data) {
  await mkdir(dirname(path),{recursive:true});
  const temporary=path+'.'+process.pid+'.tmp';
  await writeFile(temporary,JSON.stringify(data,null,2)+'\n',{encoding:'utf8',mode:0o600});
  await rename(temporary,path);
}
export async function syncRumors({projectRoot=root,fromFile,fetchImpl=fetch,now=new Date(),configOverride,stateStore,backfillHours}={}) {
  const config=configOverride ?? await readJSON(resolve(projectRoot,'scripts/rumor-sync.config.json'));
  const sources=(await readJSON(resolve(projectRoot,'assets/data/ufc-rumors.json'))).sources;
  if (!sources.length || sources.some(source=>!/^\w{1,15}$/.test(source.handle))) throw Error('Invalid configured sources.');
  const output=resolve(projectRoot,'assets/data/ufc-rumor-groups.json');
  const previous=await readJSON(output,{schemaVersion:1,updatedAt:null,groups:[]});
  const statePath=resolve(projectRoot,'.ufcinfo-data/rumor-sync-state.json');
  await mkdir(dirname(statePath),{recursive:true});
  const lockPath=statePath+'.lock';
  let lock;
  try {lock=await open(lockPath,'wx',0o600);} catch(error) {if(error.code==='EEXIST') throw Error('Another sync is running, or a stale sync lock requires inspection.');throw error;}
  try {
    if (fromFile) {
      const payload=await readJSON(resolve(fromFile));
      const result=automaticFeed(payload,sources,previous,now);
      await atomicJSON(output,result.feed);
      return {...result,requests:0,mode:'offline'};
    }
    if (!config.enabled && process.env.UFCINFO_RUMORS_ENABLED!=='true') throw Error('Automatic collection disabled. Configure frequency and credit limit before enabling. No API request made.');
    for (const [field,min,max] of [['intervalMinutes',5,1440],['maxPagesPerRun',1,10],['creditLimit',300,1000000],['creditsPerTweet',15,15],['lookbackHours',1,168]]) {
      if (!Number.isInteger(config[field]) || config[field]<min || config[field]>max) throw Error(`Invalid ${field}. No API request made.`);
    }
    const emptyState={schemaVersion:1,reservedCredits:0,estimatedCredits:0,lastSuccessAt:null,pending:null,archive:[]};
    const state=(stateStore ? await stateStore.load() : await readJSON(statePath,emptyState)) ?? emptyState;
    if (state.schemaVersion!==1 || !Number.isSafeInteger(state.reservedCredits) || state.reservedCredits<0 || !Number.isSafeInteger(state.estimatedCredits) || state.estimatedCredits<0 || !Array.isArray(state.archive) || (state.lastSuccessAt!==null && !Number.isFinite(Date.parse(state.lastSuccessAt))) || (state.pending!==null && (typeof state.pending?.query!=='string' || typeof state.pending.cursor!=='string' || !Number.isFinite(Date.parse(state.pending.until))))) throw Error('Invalid accounting state. No API request made.');
    const saveState=async()=>{await atomicJSON(statePath,state);if(stateStore)await stateStore.save(state);};
    if (backfillHours!==undefined && (!Number.isInteger(backfillHours) || backfillHours<1 || backfillHours>168)) throw Error('Invalid backfill window. No API request made.');
    if (!backfillHours && !state.pending && state.lastSuccessAt && now.getTime()-Date.parse(state.lastSuccessAt)<config.intervalMinutes*60000) return {feed:previous,added:0,skipped:0,requests:0,mode:'not-due'};
    const key=process.env.TWITTERAPI_IO_KEY?.trim() || (await readFile(resolve(projectRoot,'.ufcinfo-data/twitterapi.key'),'utf8')).trim();
    if (!key) throw Error('Missing TwitterAPI.io key.');
    const end=Math.floor(now.getTime()/1000);
    const start=backfillHours ? end-backfillHours*3600 : state.lastSuccessAt ? Math.max(Math.floor(Date.parse(state.lastSuccessAt)/1000)-120,end-168*3600) : end-config.lookbackHours*3600;
    const query=state.pending?.query ?? `(${sources.map(source=>'from:'+source.handle).join(' OR ')}) ${keywords} -filter:retweets -filter:replies since_time:${start} until_time:${end}`;
    const until=state.pending?.until ?? now.toISOString();
    let cursor=state.pending?.cursor ?? '',requests=0,truncated=false;
    const known=new Map(state.archive.map(report=>[report.id,report]));
    const collectionSkips={};
    for (let page=0;page<(backfillHours ? 10 : config.maxPagesPerRun);page++) {
      // Reserve a full documented page before sending, including failed requests.
      const reservation=20*config.creditsPerTweet;
      if (state.reservedCredits+reservation>config.creditLimit) {truncated=true;break;}
      state.reservedCredits+=reservation;
      await saveState();
      const url=new URL(endpoint);url.searchParams.set('query',query);url.searchParams.set('queryType','Latest');if(cursor)url.searchParams.set('cursor',cursor);
      const response=await fetchImpl(url,{headers:{'X-API-Key':key,Accept:'application/json'},signal:AbortSignal.timeout(25000),redirect:'error'});
      requests++;
      if (!response.ok) throw Error(`TwitterAPI.io HTTP ${response.status}; no retries. Reserved credits retained.`);
      const body=await response.text();
      if (body.length>4_000_000) throw Error('API response too large.');
      const data=JSON.parse(body);
      if (!Array.isArray(data.tweets) || data.tweets.length>20 || typeof data.has_next_page!=='boolean') throw Error('Unexpected API response; feed preserved.');
      state.estimatedCredits+=(Math.max(1,data.tweets.length)*config.creditsPerTweet);
      for (const tweet of data.tweets) {
        const source=sources.find(source=>source.handle.toLowerCase()===String(tweet.author?.userName).toLowerCase());
        const reason=!source ? 'unknown-source' : typeof tweet.id!=='string' || !/^\d{10,22}$/.test(tweet.id) || typeof tweet.text!=='string' || !tweet.text.trim() || tweet.text.length>30000 ? 'invalid-post' : tweet.isReply ? 'reply' : tweet.retweeted_tweet || tweet.text.startsWith('RT @') ? 'retweet' : boxingPattern.test(tweet.text) ? 'boxing' : null;
        if(reason){collectionSkips[reason]=(collectionSkips[reason]??0)+1;continue;}
        const date=new Date(tweet.createdAt);if(!Number.isFinite(date.getTime()) || date>now){collectionSkips['invalid-post-date']=(collectionSkips['invalid-post-date']??0)+1;continue;}
        known.set(tweet.id,{id:tweet.id,sourceId:source.id,postUrl:`https://x.com/${source.handle}/status/${tweet.id}`,text:tweet.text,publishedAt:date.toISOString(),language:['es','en'].includes(tweet.lang)?tweet.lang:source.language,status:'unverified'});
      }
      state.archive=[...known.values()].filter(report=>Date.parse(report.publishedAt)>=now.getTime()-7*86400000).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,500);
      if (data.has_next_page) {
        if (typeof data.next_cursor!=='string' || !data.next_cursor || data.next_cursor===cursor) throw Error('Invalid pagination cursor.');
        cursor=data.next_cursor;state.pending={query,cursor,until};truncated=true;
      } else {state.pending=null;state.lastSuccessAt=until;truncated=false;}
      await saveState();
      if (!data.has_next_page)break;
    }
    const result=automaticFeed({checkedAt:now.toISOString(),candidates:state.archive},sources,previous,now);
    await atomicJSON(output,result.feed);
    return {...result,collectionSkips,requests,truncated,reservedCredits:state.reservedCredits,estimatedCredits:state.estimatedCredits,mode:'automatic'};
  } finally {await lock.close();await unlink(lockPath);}
}

if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const args=process.argv.slice(2);
  const fileIndex=args.indexOf('--from-file');
  if (fileIndex>=0 && !args[fileIndex+1]) {process.stderr.write('Specify a candidate file after --from-file.\n');process.exit(1);}
  const fromFile=fileIndex>=0 ? args[fileIndex+1] : undefined;
  async function run() {
    try {
      const stateStore=process.env.GITHUB_ACTIONS==='true' && !fromFile ? githubRumorState() : undefined;
      const backfillHours=process.env.UFCINFO_RUMOR_BACKFILL==='true' ? 168 : undefined;
      const result=await syncRumors({fromFile,stateStore,backfillHours});
      console.log(`Sync: ${result.mode}; requests: ${result.requests}; added: ${result.added}; published groups: ${result.feed.groups.length}; skipped: ${result.skipped}.`);
      const labels={'fighters-not-detected':'No se detectaron dos luchadores','date-not-detected':'No se detecto una fecha','no-ufc-reference':'Sin referencia a UFC','no-booking-language':'Sin lenguaje de negociacion o pelea prevista',boxing:'Boxeo','official-announcement':'Anuncio oficial',opinion:'Opinion','invalid-event-date':'Fecha de combate invalida','past-event':'Combate pasado','event-too-far-ahead':'Combate a mas de 183 dias','unknown-source':'Fuente no configurada','invalid-post':'Publicacion invalida',reply:'Respuesta',retweet:'Retuit','invalid-post-date':'Fecha de publicacion invalida'};
      for(const [reason,count] of Object.entries(result.collectionSkips??{}))console.log(`Descartes de publicaciones: ${labels[reason]??reason}: ${count}.`);
      for(const [reason,count] of Object.entries(result.skipReasons??{}))console.log(`Descartes de grupos: ${labels[reason]??reason}: ${count}.`);
      if(result.skipped)console.log('Un grupo puede tener varios motivos; los contadores no se suman.');
      if(result.truncated)console.log('More pages pending or credit limit reached; saved results preserved.');
    }
    catch {console.error('Sync failed. Check configuration, key permissions, API balance or sync lock. Existing public data preserved; no automatic retry.');process.exitCode=1;}
  }
  await run();
  if (args.includes('--watch') && !fromFile && !process.exitCode) {
    const config=await readJSON(resolve(root,'scripts/rumor-sync.config.json'));
    // A separate process keeps working; credentials are never sent to the browser.
    setInterval(run,config.intervalMinutes*60000);
  }
}

