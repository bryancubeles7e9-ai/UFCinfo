import {escapeHTML as esc} from './utils.js';
import {parseCandidateFile,reviewedGroup,validateGroupFeed} from './rumor-groups.js';

export function initializeRumorReview({getSources,getPublished}) {
  const panel=document.querySelector('#rumor-review');
  // Files are selected locally; no upload, credentials or privileged server route.
  if (!['localhost','127.0.0.1','[::1]'].includes(location.hostname) && new URLSearchParams(location.search).get('review') !== 'local') return;
  panel.hidden=false;
  const fileInput=document.querySelector('#rumor-candidate-file');
  const list=document.querySelector('#rumor-review-list');
  const status=document.querySelector('#rumor-review-status');
  const exportButton=document.querySelector('#rumor-review-export');
  let candidates=[],approved=[];
  const notify=message=>{status.textContent=message;};
  function draw() {
    exportButton.disabled=approved.length===0;
    list.innerHTML=candidates.map(candidate=>`<article class="panel rumor-review-card" data-review-id="${esc(candidate.id)}"><h3 translate="no">${esc(candidate.fighters.length===2 ? candidate.fighters.join(' vs ') : 'Publicación sin pelea identificada')}</h3><p class="data-note">${candidate.reports.length} publicaciones · Revisión pendiente</p>${candidate.reports.map(report=> {
      const source=getSources().find(s=>s.id===report.sourceId);
      return `<details class="rumor-review-post"><summary translate="no">${esc(source.name)} · @${esc(source.handle)}</summary><p class="rumor-review-text" translate="no">${esc(report.text)}</p>${report.encodingWarning ? '<p class="data-note">El texto contiene caracteres dañados. Consulta la publicación original.</p>' : ''}<a class="text-link" href="${esc(report.postUrl)}" target="_blank" rel="noopener noreferrer">Ver publicación original en X ↗</a></details>`;
    }).join('')}<form class="rumor-review-form"><div class="rumor-review-names"><label>Primer luchador<input name="fighter1" maxlength="100" required value="${esc(candidate.fighters[0] || '')}" autocomplete="off"></label><label>Segundo luchador<input name="fighter2" maxlength="100" required value="${esc(candidate.fighters[1] || '')}" autocomplete="off"></label></div><label>Resumen en español<textarea name="summaryEs" maxlength="600" rows="3" required></textarea></label><label>Resumen en inglés<textarea name="summaryEn" maxlength="600" rows="3" required></textarea></label><label class="rumor-review-check"><input type="checkbox" name="spoilers" checked>Puede contener resultados</label><label class="rumor-review-check"><input type="checkbox" name="reviewed" required>He comprobado las fuentes y se trata de un reporte pendiente de confirmación oficial</label><div class="rumor-actions"><button class="button small" type="submit">Aprobar para exportar</button><button class="outline-button small" type="button" data-review-discard="${esc(candidate.id)}">Descartar grupo</button></div></form></article>`).join('');
  }
  fileInput.addEventListener('change',async()=> {
    const file=fileInput.files?.[0];
    if (!file) return;
    if (file.size>5_000_000) {notify('Archivo demasiado grande.');return;}
    notify(`Leyendo ${file.name}…`);
    try {
      const next=parseCandidateFile(await file.text(),getSources());
      candidates=next;approved=[];draw();notify(`${next.length} grupos cargados desde ${file.name}. El archivo permanece en este navegador.`);
    } catch(error) {notify(error.message || 'No se pudo leer el archivo.');}
  });
  list.addEventListener('click',event=> {
    const discard=event.target.closest('[data-review-discard]');
    if (!discard) return;
    candidates=candidates.filter(candidate=>candidate.id!==discard.dataset.reviewDiscard);discard.closest('[data-review-id]').remove();notify('Grupo descartado de esta revisión. El archivo original se conserva.');
  });
  list.addEventListener('submit',event=> {
    event.preventDefault();
    const form=event.target;
    if (!form.reportValidity()) return;
    const id=form.closest('[data-review-id]').dataset.reviewId;
    const candidate=candidates.find(candidate=>candidate.id===id);
    try {
      const group=reviewedGroup(candidate,{fighterNames:[form.elements.fighter1.value,form.elements.fighter2.value],summary:{es:form.elements.summaryEs.value,en:form.elements.summaryEn.value},containsSpoilers:form.elements.spoilers.checked,checked:form.elements.reviewed.checked});
      const feed={schemaVersion:1,updatedAt:new Date().toISOString(),groups:[...getPublished().groups,...approved,group]};
      if (!validateGroupFeed(feed,getSources())) throw Error('Comprueba los nombres, resúmenes y posibles publicaciones duplicadas.');
      approved.push(group);candidates=candidates.filter(candidate=>candidate.id!==id);form.closest('[data-review-id]').remove();exportButton.disabled=false;notify(`${approved.length} grupos aprobados para exportar. Aún no se han publicado.`);
    } catch(error) {notify(error.message || 'No se pudo aprobar el grupo.');}
  });
  exportButton.addEventListener('click',()=> {
    const feed={schemaVersion:1,updatedAt:new Date().toISOString(),groups:[...getPublished().groups,...approved]};
    if (!approved.length || !validateGroupFeed(feed,getSources())) {notify('No hay un archivo válido para exportar.');return;}
    const url=URL.createObjectURL(new Blob([JSON.stringify(feed,null,2)+'\n'],{type:'application/json;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='ufc-rumor-groups.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    notify('Archivo exportado. Para publicar, sustituye assets/data/ufc-rumor-groups.json en el proyecto y despliega la actualización.');
  });
}
