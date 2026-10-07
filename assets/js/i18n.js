import { english } from './i18n/en.js';
const storageKey = 'ufcinfo-language';
let language = 'es';
try { if (globalThis.localStorage?.getItem(storageKey) === 'en') language = 'en'; } catch { /* Spanish remains available without storage. */ }
export const getLanguage = () => language;
export const getLocale = () => language === 'en' ? 'en-US' : 'es-ES';
const normalize = text => text.replace(/\s+/g, ' ').trim();
const escapePattern = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const phrases = Object.keys(english).sort((a, b) => b.length - a.length);
const pattern = new RegExp(`(?<![\\p{L}])(?:${phrases.map(escapePattern).join('|')})(?![\\p{L}])`, 'gu');
export function translate(text) {
  if (language !== 'en') return text;
  const source = normalize(String(text));
  if (english[source]) return String(text).replace(/\S[\s\S]*\S|\S/, english[source]);
  return String(text).replace(pattern, match => english[match])
    .replace(/(\d+) de (\d+) luchadores/g, '$1 of $2 fighters')
    .replace(/(\d+) publicaciones/g, '$1 posts')
    .replace(/\+ campeón/g, '+ champion')
    .replace(/ frente a /g, ' vs ')
    .replace(/(\d+) años\b/g, '$1 years')
    .replace(/ \(actual\)/g, ' (current)').replace(/ \(anterior\)/g, ' (former)');
}
export function setLanguage(next) {
  if (!['es', 'en'].includes(next)) return false;
  language = next;
  try { globalThis.localStorage?.setItem(storageKey, next); } catch { /* Selection still works for this visit. */ }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next;
    document.dispatchEvent(new Event('ufcinfo:language-changed'));
  }
  return true;
}

// Keep Spanish originals so switching back never translates already translated text.
// Observe new interface copy as async feeds and dialogs are rendered.
export function initializeLanguage() {
  const originals = new WeakMap();
  const excluded = 'script, style, noscript, [translate="no"], [data-no-translate]';
  const attributes = ['aria-label', 'placeholder', 'title', 'alt', 'content'];
  let observer;
  function apply(node, field, current, write) {
    let record = originals.get(node);
    if (!record) { record = {}; originals.set(node, record); }
    const previous = record[field];
    const source = previous && current === previous.output ? previous.source : current;
    const output = translate(source);
    record[field] = { source, output };
    if (output !== current) write(output);
  }
  function walk(root) {
    if (root.nodeType === Node.TEXT_NODE) {
      if (root.parentElement?.closest(excluded)) return;
      apply(root, 'text', root.nodeValue, value => { root.nodeValue = value; });
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE || root.closest(excluded)) return;
    for (const attr of attributes) {
      if (root.hasAttribute(attr)) apply(root, attr, root.getAttribute(attr), value => root.setAttribute(attr, value));
    }
    for (const child of root.childNodes) walk(child);
  }
  const config = {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:attributes};
  function update(roots = [document.documentElement]) {
    observer.disconnect();
    for (const root of roots) if (root.isConnected) walk(root);
    document.documentElement.lang = language;
    document.querySelector('#language-select').value = language;
    observer.observe(document.documentElement, config);
  }
  observer = new MutationObserver(records => {
    const roots = new Set();
    for (const record of records) {
      if (record.type === 'childList') for (const node of record.addedNodes) roots.add(node);
      else roots.add(record.target);
    }
    update(roots);
  });
  document.querySelector('#language-select').addEventListener('change', event => setLanguage(event.target.value));
  document.addEventListener('ufcinfo:language-changed', () => update());
  update();
}
