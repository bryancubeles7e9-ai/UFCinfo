const preference = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-reduced-motion: no-preference)') : null;
const active = new Set();
const byNode = new WeakMap();
const copies = new WeakMap();
const jumps = new WeakMap();
preference?.addEventListener?.('change', () => {
  if (!preference.matches) for (const animation of active) animation.cancel();
});
function run(node, frames, options) {
  if (!node?.isConnected || !preference?.matches || typeof node.animate !== 'function') return null;
  byNode.get(node)?.cancel();
  const animation = node.animate(frames, options);
  byNode.set(node, animation); active.add(animation);
  animation.finished.catch(() => {}).finally(() => {
    active.delete(animation);
    if (byNode.get(node) === animation) byNode.delete(node);
  });
  return animation;
}
export function confirmationIcon(elapsed = 0) {
  const delay = Math.min(360, Math.max(0, elapsed));
  return `<svg class="action-confirmation" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="--check-delay:-${delay}ms" aria-hidden="true" focusable="false"><path class="action-check-stroke" pathLength="1" d="m5 12 4 4L19 6"/></svg>`;
}
export function animatePickChoice(button) {
  run(button, [
    {transform:'scale(1)', boxShadow:'0 0 0 0 rgba(255,101,62,0)'},
    {transform:'scale(1.025)', boxShadow:'0 0 0 4px rgba(255,101,62,.2)', offset:.4},
    {transform:'scale(.99)', boxShadow:'0 0 0 6px rgba(255,101,62,0)', offset:.75},
    {transform:'scale(1)', boxShadow:'0 0 0 0 rgba(255,101,62,0)'}
  ], {duration:300, easing:'ease-out'});
}
export function resetCopyConfirmation(button) {
  clearTimeout(copies.get(button)); copies.delete(button);
  button.classList.remove('is-confirmed');
}
export function confirmCopy(button) {
  resetCopyConfirmation(button);
  if (!button.isConnected) return;
  button.classList.add('is-confirmed');
  copies.set(button, setTimeout(() => resetCopyConfirmation(button), 1600));
}
export function highlightSection(heading, dialog) {
  jumps.get(dialog)?.();
  if (!preference?.matches) return;
  const detail = heading.closest('#event-detail');
  const eventId = detail.dataset.officialEventId, id = heading.id;
  let timer, animation;
  const stop = () => { clearTimeout(timer); dialog.removeEventListener('scrollend', start); animation?.cancel(); };
  const start = () => {
    clearTimeout(timer); dialog.removeEventListener('scrollend', start);
    const target = detail.dataset.officialEventId === eventId ? document.getElementById(id) : null;
    if (dialog.open && target && dialog.contains(target)) animation = run(target, [
      {backgroundColor:'rgba(255,101,62,0)', borderBottomColor:'#ff653e'},
      {backgroundColor:'rgba(255,101,62,.12)', borderBottomColor:'#ffb39d', offset:.4},
      {backgroundColor:'rgba(255,101,62,0)', borderBottomColor:'#ff653e'}
    ], {duration:650, easing:'ease-out'});
    if (!animation && jumps.get(dialog) === stop) jumps.delete(dialog);
    animation?.finished.catch(() => {}).finally(() => {if (jumps.get(dialog) === stop) jumps.delete(dialog);});
  };
  jumps.set(dialog, stop);
  dialog.addEventListener('scrollend', start, {once:true});
  timer = setTimeout(start, 650);
}
