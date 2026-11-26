import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
// Every file the service worker saves for offline use exists, so its install never comes up short.
const sw = readFileSync(new URL('../assets/sw.js', import.meta.url), 'utf8');
assert.doesNotMatch(sw, /^\s*(import|export)\s/m, 'A classic service worker cannot use import/export');
const list = [...sw.match(/const PRECACHE = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]).concat(['/assets/updating.html']);
assert.ok(list.includes('/') && list.includes('/assets/js/app.bundle.js') && list.includes('/assets/data/ufc-events.json'));
for (const path of list.filter(p => p.startsWith('/assets/'))) assert.ok(existsSync(new URL('..' + path, import.meta.url)), `Falta ${path}`);
// Every stylesheet, font preload and data module the page asks for is saved.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
for (const [, href] of html.matchAll(/<(?:link|script)[^>]+(?:href|src)="(assets\/[^"]+\.(?:css|js|woff2))"/g)) assert.ok(list.includes('/' + href), `No se guarda /${href}`);
// The notice shows offline and goes away when the connection returns.
const { initializeOfflineNotice } = await import('../assets/js/client-errors.js');
const listeners = {}, added = [];
const body = { append: node => added.push(node) };
const win = { navigator: { onLine: false }, addEventListener: (type, fn) => (listeners[type] = fn),
  document: { body, createElement: () => ({ setAttribute() {}, set innerHTML(v) {}, querySelector: () => ({}), remove() { added.pop(); } }) } };
initializeOfflineNotice(win);
assert.equal(added.length, 1);
win.navigator.onLine = true; listeners.online();
assert.equal(added.length, 0);
console.log(`PASS: ${list.length} archivos para usar la web sin conexión y aviso de modo sin conexión`);
