// Profile figures count up from zero when a fighter profile opens.
// Only values made of numbers and untranslated units are animated, so i18n keeps its originals.
const animatable = /^[\d\s.,%·/-]*\d[\d\s.,%·/-]*(?:\s?(?:cm|kg))?$/;
const numberPattern = /\d+(?:[.,]\d+)?/g;
const running = new WeakMap();

export function canCountFigure(text) {
  return animatable.test(String(text || '').trim());
}
// Rebuild the text with every number scaled by progress, keeping separators and decimals.
export function figureFrame(text, progress) {
  if (progress >= 1) return text;
  return text.replace(numberPattern, token => {
    const separator = token.match(/[.,]/)?.[0];
    const decimals = separator ? token.length - token.indexOf(separator) - 1 : 0;
    const target = Number(separator ? token.replace(separator, '.') : token);
    const current = (target * Math.max(0, progress)).toFixed(decimals);
    return separator ? current.replace('.', separator) : current;
  });
}
function easeOut(t) {return 1 - (1 - t) ** 3;}

export function countProfileFigures(root, {duration = 720} = {}) {
  if (typeof window === 'undefined' || !window.matchMedia?.('(prefers-reduced-motion: no-preference)').matches) return;
  const nodes = [...(root?.querySelectorAll?.('.profile-metrics dd, .extended-fighter-info dd') || [])]
    .filter(node => !node.closest('[hidden]') && node.children.length === 0 && canCountFigure(node.textContent));
  nodes.forEach((node, index) => {
    cancelAnimationFrame(running.get(node));
    const text = node.textContent;
    const delay = Math.min(index * 30, 240);
    let start = null;
    const step = now => {
      if (!node.isConnected) return running.delete(node);
      start ??= now + delay;
      const progress = Math.min(1, Math.max(0, (now - start) / duration));
      node.textContent = figureFrame(text, easeOut(progress));
      if (progress < 1) running.set(node, requestAnimationFrame(step));
      else running.delete(node);
    };
    node.textContent = figureFrame(text, 0);
    running.set(node, requestAnimationFrame(step));
  });
}
