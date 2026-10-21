import {getLocale} from './i18n.js';
import {escapeHTML as esc} from './utils.js';
import {syncHealth} from './sync-health.js';
const feeds=[['events','ufc-events'],['rankings','ufc-rankings'],['records','fighter-records'],['photos','fighter-photos'],['rumors','ufc-rumor-groups'],['results','ufc-events']];
const labels={es:['Estado de los datos','Carteleras y resultados','Rankings','Récords y estadísticas','Fotografías','Rumores','Consulta reciente','Actualización retrasada','Actualización parcial','Sin fecha verificable','No se pudo comprobar','Última consulta','Se conserva la última información disponible.','Los horarios de consulta no garantizan que la fuente haya actualizado sus datos.','Publicaciones recibidas','Rumores añadidos','Perfiles pendientes'],en:['Data status','Events and results','Rankings','Records and statistics','Photos','Rumors','Recently checked','Update delayed','Partial update','No verifiable date','Unable to check','Last checked','Last available information is retained.','A check does not guarantee the source has updated its data.','Posts received','Rumors added','Pending profiles'],ca:['Estat de les dades','Cartelleres i resultats','Rànquings','Rècords i estadístiques','Fotografies','Rumors','Consulta recent','Actualització endarrerida','Actualització parcial','Sense data verificable','No s’ha pogut comprovar','Última consulta','Es conserva l’última informació disponible.','Una consulta no garanteix que la font hagi actualitzat les dades.','Publicacions rebudes','Rumors afegits','Perfils pendents']};
const statusText={es:{failed:'Último intento fallido',running:'Actualización en curso',interrupted:'Intento sin finalización confirmada',attempt:'Último intento conocido',success:'Última sincronización sin incidencias',results:'Resultados oficiales UFC',pending:'Elementos pendientes'},en:{failed:'Last attempt failed',running:'Update in progress',interrupted:'Attempt completion unconfirmed',attempt:'Last known attempt',success:'Last sync without issues',results:'Official UFC results',pending:'Pending items'},ca:{failed:'Últim intent fallit',running:'Actualització en curs',interrupted:'Intent sense finalització confirmada',attempt:'Últim intent conegut',success:'Última sincronització sense incidències',results:'Resultats oficials UFC',pending:'Elements pendents'}};
export const assessFeed=syncHealth;
export function renderHealthItem(kind,feed,{job=null,unavailable=false,locale='es-ES',now=Date.now()}={}) {
  const text=labels[locale.slice(0,2)]||labels.es,extra=statusText[locale.slice(0,2)]||statusText.es;
  const state=assessFeed(kind,feed,now,job),status=unavailable?'unavailable':state.status;
  const label={recent:6,delayed:7,partial:8,unknown:9,unavailable:10}[status];
  const format=stamp=>stamp?esc(new Date(stamp).toLocaleString(locale)):'—';
  const counts=feed?.lastCollection;
  const summary=kind==='rumors'&&counts&&counts.checkedAt===feed.lastSearchedAt&&Number.isSafeInteger(counts.receivedPosts)&&Number.isSafeInteger(counts.added)?`<small>${text[14]}: ${counts.receivedPosts} · ${text[15]}: ${counts.added}</small>`:'';
  const name=kind==='results'?extra.results:kind==='events'?({es:'Carteleras',en:'Events',ca:'Cartelleres'}[locale.slice(0,2)]||'Carteleras'):text[feeds.findIndex(([key])=>key===kind)+1];
  return `<div class="data-health-item"><strong>${name}</strong><span class="data-health-state" data-status="${status}">${extra[status]||text[label]}</span><small>${extra.attempt}: ${format(state.attemptStamp)}</small><small>${extra.success}: ${format(state.successStamp)}</small>${state.pending?`<small>${extra.pending}: ${state.pending}</small>`:''}${summary}${status!=='recent'?`<small>${text[12]}</small>`:''}</div>`;
}
export function initializeDataHealth() {
  const host=document.querySelector('#data-health');
  if(!host)return;
  const cache=new Map();let running=false;
  function render(){
    const text=labels[getLocale().slice(0,2)]||labels.es;
    host.querySelector('summary').textContent=text[0];
    host.querySelector('.data-health-list').innerHTML=feeds.map(([kind,file])=>{
      const entry=cache.get(file);
      return renderHealthItem(kind,entry?.feed,{job:cache.get('sync-health')?.feed?.jobs?.[kind],unavailable:entry?.unavailable,locale:getLocale()});
    }).join('')+`<p class="data-note">${text[13]}</p>`;
  }
  async function refresh(){
    if(running)return;running=true;
    await Promise.allSettled([...new Set([...feeds.map(([,file])=>file),'sync-health'])].map(async file=>{
      try{
        const response=await fetch(new URL(`../data/${file}.json`,import.meta.url),{cache:'no-store',signal:AbortSignal.timeout(12000)});
        if(!response.ok)throw Error('Unavailable');
        const feed=await response.json();if(feed?.schemaVersion!==1)throw Error('Invalid feed');
        cache.set(file,{feed,unavailable:false});
      }catch{cache.set(file,{...cache.get(file),unavailable:true});}
    }));running=false;render();
  }
  render();refresh();setInterval(refresh,300000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  document.addEventListener('ufcinfo:language-changed',render);
}
