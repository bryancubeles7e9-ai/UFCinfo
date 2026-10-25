const preference = window.matchMedia('(prefers-reduced-motion: no-preference)');
const desktop = window.matchMedia('(min-width: 701px)');
// Same effects on both layouts; slightly more room and time on desktop.
const profile = () => desktop.matches
  ? {entry:360, step:45, stagger:225, distance:18, exit:110, filter:300, filterStep:25, filterStagger:100, travel:88, pulse:750, ring:6, spread:14}
  : {entry:280, step:35, stagger:175, distance:12, exit:90, filter:230, filterStep:20, filterStagger:80, travel:64, pulse:600, ring:5, spread:11};
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
  const motion = profile();
  const bouts = [...detail.querySelectorAll(skipShared ? '.bout:not(.is-shared)' : '.bout')];
  bouts.forEach((bout, index) => play(bout,
    [{opacity:0, transform:`translateY(${motion.distance}px)`}, {opacity:1, transform:'none'}],
    {duration:motion.entry, delay:Math.min(index * motion.step, motion.stagger), easing:ease, fill:'backwards'}));
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
    const motion = profile();
    animation = play(target, [
      {boxShadow:'0 0 0 0 rgba(255,101,62,0)', outlineColor:'#ff653e'},
      {boxShadow:`0 0 0 ${motion.ring}px rgba(255,101,62,.22)`, outlineColor:'#ffb39d', offset:.45},
      {boxShadow:`0 0 0 ${motion.spread}px rgba(255,101,62,0)`, outlineColor:'#ff653e'}
    ], {duration:motion.pulse, iterations:2, easing:'ease-out'});
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
  const motion = profile();
  const before = new Map([...container.children].map(node => [node.dataset.eventCard, node.getBoundingClientRect()]));
  if (container.children.length) {
    const exit = play(container, [{opacity:1}, {opacity:.2}], {duration:motion.exit, easing:'ease-out', fill:'forwards'});
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
    const dx = old ? Math.max(-motion.travel, Math.min(motion.travel, old.left - rect.left)) : 0;
    const dy = old ? Math.max(-motion.travel, Math.min(motion.travel, old.top - rect.top)) : motion.distance;
    operation.animations.push(play(node,
      [{opacity:.2, transform:`translate(${dx}px, ${dy}px)`}, {opacity:1, transform:'none'}],
      {duration:motion.filter, delay:Math.min(index * motion.filterStep, motion.filterStagger), easing:ease, fill:'backwards'}));
  });
  await Promise.allSettled(operation.animations.map(animation => animation.finished));
  if (updates.get(container) === operation) updates.delete(container);
}
