import {animateInterface} from './action-feedback.js';

export function growLabBars(container) {
  if (container?.closest?.('[hidden]')) return;
  for (const bar of container?.querySelectorAll?.('.lab-percent > span') || []) {
    animateInterface(bar, [{transform:'scaleX(0)'}, {transform:'scaleX(1)'}],
      {duration:460, easing:'cubic-bezier(.2,.7,.3,1)'});
  }
}
export function revealResultMotion(target) {
  if (!target) return;
  target.setAttribute('tabindex','-1');
  target.focus({preventScroll:true});
  animateInterface(target,
    [{clipPath:'inset(0 100% 0 0)', opacity:.25}, {clipPath:'inset(0 0 0 0)', opacity:1}],
    {duration:360, easing:'ease-out'});
}
export function transitionCatalog(container, render) {
  if (container.closest('[hidden]')) {render();return;}
  const key = node => node.querySelector('[data-profile]')?.dataset.profile;
  const before = new Map([...container.children].map(node => [key(node), node.getBoundingClientRect()]));
  render(); // Keep selections and the latest view synchronous, even on rapid clicks.
  [...container.children].forEach((node,index) => {
    const rect=node.getBoundingClientRect();
    if (rect.bottom<0 || rect.top>window.innerHeight+60) return;
    const old=before.get(key(node));
    const dx=old?Math.max(-40,Math.min(40,old.left-rect.left)):0;
    const dy=old?Math.max(-40,Math.min(40,old.top-rect.top)):10;
    animateInterface(node,[{opacity:.2,transform:`translate(${dx}px,${dy}px)`},{opacity:1,transform:'none'}],
      {duration:280, delay:Math.min(index*20,80), easing:'cubic-bezier(.2,.7,.3,1)',fill:'backwards'});
  });
}

const groupsSelector='.segmented, .catalog-scopes, .catalog-view-switch, .profile-section-switch';
export function initializeFilterIndicators() {
  const records=new WeakMap();
  let frame=0;
  function update() {
    frame=0;
    for (const group of document.querySelectorAll(groupsSelector)) {
      let record=records.get(group);
      if (!record) {
        const marker=document.createElement('span');
        marker.className='filter-indicator';marker.setAttribute('aria-hidden','true');marker.hidden=true;
        group.classList.add('has-filter-indicator');group.append(marker);
        record={marker};records.set(group,record);
        resize?.observe(group);
      }
      const selected=group.querySelector('button[aria-pressed="true"]');
      if (!selected || group.closest('[hidden]') || !group.getClientRects().length) {record.marker.hidden=true;continue;}
      const parent=group.getBoundingClientRect(), button=selected.getBoundingClientRect();
      const transform=`translate(${button.left-parent.left-group.clientLeft+8}px,${button.bottom-parent.top-group.clientTop-3}px)`;
      const width=`${Math.max(1,button.width-16)}px`;
      const marker=record.marker;
      if (!marker.hidden && marker.style.transform===transform && marker.style.width===width) continue;
      const previous=marker.hidden?null:{transform:marker.style.transform,width:marker.style.width};
      marker.style.transform=transform;marker.style.width=width;marker.hidden=false;
      if (previous) animateInterface(marker,[previous,{transform,width}],{duration:240,easing:'cubic-bezier(.2,.7,.3,1)'});
    }
  }
  function schedule() {if (!frame) frame=requestAnimationFrame(update);}
  const resize=typeof ResizeObserver==='undefined'?null:new ResizeObserver(schedule);
  new MutationObserver(records => {
    if (records.some(r=>r.type==='childList' || (r.type==='attributes' && r.target.matches('button[aria-pressed]')) || (r.type==='characterData' && r.target.parentElement?.closest(groupsSelector)))) schedule();
  }).observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-pressed','hidden']});
  window.addEventListener('resize',schedule);
  window.addEventListener('hashchange',schedule);
  document.addEventListener('ufcinfo:language-changed',schedule);
  schedule();
}
