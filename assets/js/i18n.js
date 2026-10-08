import { english } from './i18n/en.js';
import { catalan } from './i18n/ca.js';
const dictionaries = { en: english, ca: catalan };
const locales = { es: 'es-ES', en: 'en-US', ca: 'ca-ES' };
const storageKey = 'ufcinfo-language';
let language = 'es';
try { const saved = globalThis.localStorage?.getItem(storageKey); if (Object.hasOwn(locales, saved)) language = saved; } catch { /* Spanish remains available without storage. */ }
export const getLanguage = () => language;
export const getLocale = () => locales[language];
const normalize = text => text.replace(/\s+/g, ' ').trim();
const escapePattern = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const phrases = [...new Set([...Object.keys(english), ...Object.keys(catalan)])].sort((a, b) => b.length - a.length);
const pattern = new RegExp(`(?<![\\p{L}])(?:${phrases.map(escapePattern).join('|')})(?![\\p{L}])`, 'gu');
export function translate(text) {
  if (language === 'es') return text;
  const dictionary = dictionaries[language];
  const source = normalize(String(text));
  if (dictionary[source]) return String(text).replace(/\S[\s\S]*\S|\S/, dictionary[source]);
  const translated = String(text).replace(pattern, match => dictionary[match] ?? match);
  if (language === 'ca') return translated
    .replace(/(\d+) de (\d+) luchadores/g, '$1 de $2 lluitadors')
    .replace(/(\d+) publicaciones/g, '$1 publicacions')
    .replace(/(\d+) reportes/g, '$1 informes')
    .replace(/\+ campeón/g, '+ campió')
    .replace(/ frente a /g, ' contra ')
    .replace(/(\d+) años\b/g, '$1 anys');
  return translated
    .replace(/(\d+) de (\d+) luchadores/g, '$1 of $2 fighters')
    .replace(/(\d+) publicaciones/g, '$1 posts')
    .replace(/(\d+) reportes/g, '$1 reports')
    .replace(/\+ campeón/g, '+ champion')
    .replace(/ frente a /g, ' vs ')
    .replace(/(\d+) años\b/g, '$1 years')
    .replace(/ \(actual\)/g, ' (current)').replace(/ \(anterior\)/g, ' (former)');
}
export function setLanguage(next) {
  if (!Object.hasOwn(locales, next)) return false;
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
