const preference = window.matchMedia('(prefers-reduced-motion: no-preference)');
const active = new Set();
const updates = new WeakMap();
const pulses = new WeakMap();
const ease = 'cubic-bezier(.2,.7,.3,1)';
const allowed = node => preference.matches && typeof node.animate === 'function';
preference.addEventListener?.('change', () => {
  if (!preference.matches) for (const animation of active) animation.cancel();
});
function play(node, frames, options) {
  const animation = node.animate(frames, options);
  active.add(animation);
  animation.finished.catch(() => {}).finally(() => active.delete(animation));
  return animation;
}

export function enterEventBouts(detail, skipShared = false) {
  if (!allowed(detail)) return;
  const bouts = [...detail.querySelectorAll(skipShared ? '.bout:not(.is-shared)' : '.bout')];
  bouts.forEach((bout, index) => play(bout,
    [{opacity:0, transform:'translateY(12px)'}, {opacity:1, transform:'none'}],
    {duration:280, delay:Math.min(index * 35, 175), easing:ease, fill:'backwards'}));
}

export function pulseSharedBout(bout, dialog) {
  pulses.get(dialog)?.();
  if (!bout || !allowed(bout)) return;
  const detail = bout.closest('#event-detail');
  const key = detail.dataset.sharedBoutKey, eventId = detail.dataset.officialEventId;
  let timer, animation;
  const stop = () => { clearTimeout(timer); dialog.removeEventListener('scrollend', start); animation?.cancel(); };
  const start = () => {
    clearTimeout(timer);
    dialog.removeEventListener('scrollend', start);
    const target = detail.dataset.sharedBoutKey === key && detail.dataset.officialEventId === eventId ? detail.querySelector('.bout.is-shared') : null;
    if (!target?.isConnected || !dialog.open || !allowed(target)) {
      if (pulses.get(dialog) === stop) pulses.delete(dialog);
      return;
    }
    animation = play(target, [
      {boxShadow:'0 0 0 0 rgba(255,101,62,0)', outlineColor:'#ff653e'},
      {boxShadow:'0 0 0 5px rgba(255,101,62,.22)', outlineColor:'#ffb39d', offset:.45},
      {boxShadow:'0 0 0 11px rgba(255,101,62,0)', outlineColor:'#ff653e'}
    ], {duration:600, iterations:2, easing:'ease-out'});
    animation.finished.catch(() => {}).finally(() => { if (pulses.get(dialog) === stop) pulses.delete(dialog); });
  };
  pulses.set(dialog, stop);
  // Start once the jump arrives; the timeout covers browsers without scrollend.
  dialog.addEventListener('scrollend', start, {once:true});
  timer = setTimeout(start, 650);
}

export async function transitionEventList(container, render, animate = false) {
  const previous = updates.get(container);
  previous?.animations.forEach(animation => animation.cancel());
  const operation = {animations:[]};
  updates.set(container, operation);
  const enabled = animate && allowed(container) && !container.closest('[hidden]');
  if (!enabled) { render(); updates.delete(container); return; }
  const before = new Map([...container.children].map(node => [node.dataset.eventCard, node.getBoundingClientRect()]));
  if (container.children.length) {
    const exit = play(container, [{opacity:1}, {opacity:.2}], {duration:90, easing:'ease-out', fill:'forwards'});
    operation.animations.push(exit);
    try { await exit.finished; } catch { /* Newer filters or reduced motion cancel the fade. */ }
    if (updates.get(container) !== operation) return;
    render();
    exit.cancel();
  } else render();
  if (allowed(container)) [...container.children].forEach((node, index) => {
    const rect = node.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight + 80) return;
    const old = before.get(node.dataset.eventCard);
    const dx = old ? Math.max(-64, Math.min(64, old.left - rect.left)) : 0;
    const dy = old ? Math.max(-64, Math.min(64, old.top - rect.top)) : 12;
    operation.animations.push(play(node,
      [{opacity:.2, transform:`translate(${dx}px, ${dy}px)`}, {opacity:1, transform:'none'}],
      {duration:230, delay:Math.min(index * 20, 80), easing:ease, fill:'backwards'}));
  });
  await Promise.allSettled(operation.animations.map(animation => animation.finished));
  if (updates.get(container) === operation) updates.delete(container);
}
