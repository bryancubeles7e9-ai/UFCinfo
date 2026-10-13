import {getLocale} from './i18n.js';
import {escapeHTML as esc} from './utils.js';
const feeds=[['events','ufc-events'],['rankings','ufc-rankings'],['records','fighter-records'],['photos','fighter-photos'],['rumors','ufc-rumor-groups']];
const labels={es:['Estado de los datos','Carteleras y resultados','Rankings','Récords y estadísticas','Fotografías','Rumores','Consulta reciente','Actualización retrasada','Actualización parcial','Sin fecha verificable','No se pudo comprobar','Última consulta','Se conserva la última información disponible.','Los horarios de consulta no garantizan que la fuente haya actualizado sus datos.','Publicaciones recibidas','Rumores añadidos','Perfiles pendientes'],en:['Data status','Events and results','Rankings','Records and statistics','Photos','Rumors','Recently checked','Update delayed','Partial update','No verifiable date','Unable to check','Last checked','Last available information is retained.','A check does not guarantee the source has updated its data.','Posts received','Rumors added','Pending profiles'],ca:['Estat de les dades','Cartelleres i resultats','Rànquings','Rècords i estadístiques','Fotografies','Rumors','Consulta recent','Actualització endarrerida','Actualització parcial','Sense data verificable','No s’ha pogut comprovar','Última consulta','Es conserva l’última informació disponible.','Una consulta no garanteix que la font hagi actualitzat les dades.','Publicacions rebudes','Rumors afegits','Perfils pendents']};
export function assessFeed(kind,feed,now=Date.now()) {
  const stamp=kind==='rumors'?feed?.lastSearchedAt:kind==='records'?feed?.lastSync?.checkedAt:feed?.synchronizedAt;
  const time=Date.parse(stamp);
  const failures=kind==='records'?feed?.pendingProfileIds:feed?.failedIds;
  const pending=Array.isArray(failures)?failures.length:0;
  const status=!Number.isFinite(time)||time>now+300000?'unknown':now-time>(kind==='rumors'?90:1200)*60000?'delayed':pending?'partial':'recent';
  return {stamp,status,pending};
}
export function initializeDataHealth() {
  const host=document.querySelector('#data-health');
  if(!host)return;
  const cache=new Map();let running=false;
  function render(){
    const text=labels[getLocale().slice(0,2)]||labels.es;
    host.querySelector('summary').textContent=text[0];
    host.querySelector('.data-health-list').innerHTML=feeds.map(([kind],i)=>{
      const entry=cache.get(kind),state=assessFeed(kind,entry?.feed);
      const status=entry?.unavailable?'unavailable':state.status;
      const label={recent:6,delayed:7,partial:8,unknown:9,unavailable:10}[status];
      const date=Number.isFinite(Date.parse(state.stamp))?new Date(state.stamp).toLocaleString(getLocale()):'—';
      const counts=entry?.feed?.lastCollection;
      const summary=kind==='rumors'&&counts&&counts.checkedAt===entry.feed.lastSearchedAt&&Number.isSafeInteger(counts.receivedPosts)&&Number.isSafeInteger(counts.added)?`<small>${text[14]}: ${counts.receivedPosts} · ${text[15]}: ${counts.added}</small>`:'';
      return `<div class="data-health-item"><strong>${text[i+1]}</strong><span class="data-health-state" data-status="${status}">${text[label]}</span><small>${text[11]}: ${esc(date)}</small>${state.pending?`<small>${text[16]}: ${state.pending}</small>`:''}${summary}${status!=='recent'?`<small>${text[12]}</small>`:''}</div>`;
    }).join('')+`<p class="data-note">${text[13]}</p>`;
  }
  async function refresh(){
    if(running)return;running=true;
    await Promise.allSettled(feeds.map(async([kind,file])=>{
      try{
        const response=await fetch(new URL(`../data/${file}.json`,import.meta.url),{cache:'no-store',signal:AbortSignal.timeout(12000)});
        if(!response.ok)throw Error('Unavailable');
        const feed=await response.json();if(feed?.schemaVersion!==1)throw Error('Invalid feed');
        cache.set(kind,{feed,unavailable:false});
      }catch{cache.set(kind,{...cache.get(kind),unavailable:true});}
    }));running=false;render();
  }
  render();refresh();setInterval(refresh,300000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  document.addEventListener('ufcinfo:language-changed',render);
}
