import assert from 'node:assert/strict';
import {initializeMobileFilters} from '../assets/js/mobile-filters.js';

class Control extends EventTarget {
  constructor(value = '') {
    super(); this.value = value; this.attributes = new Map();
    const classes = new Set();
    this.classList = {add: c => classes.add(c), toggle: (c, on) => on ? classes.add(c) : classes.delete(c)};
  }
  setAttribute(k, v) { this.attributes.set(k, v); }
  getAttribute(k) { return this.attributes.get(k); }
  click() { this.dispatchEvent(new Event('click')); }
  focus() { document.activeElement = this; }
}
const ids = ['fighter-filter-controls', 'fighter-filters', 'fighter-filter-toggle', 'fighter-filter-reset', 'fighter-active-filters', 'favorites-only', 'style-filter', 'division-filter', 'stance-filter', 'championship-filter', 'fighter-sort', 'fighter-search'];
const elements = Object.fromEntries(ids.map(id => [id, new Control()]));
for (const id of ['style-filter', 'division-filter', 'stance-filter', 'championship-filter']) elements[id].value = 'all';
elements['fighter-sort'].value = 'featured';
elements['fighter-search'].value = 'Topuria';
const followed = elements['favorites-only'];
followed.setAttribute('aria-pressed', 'false');
followed.addEventListener('click', () => followed.setAttribute('aria-pressed', String(followed.getAttribute('aria-pressed') !== 'true')));
const media = new EventTarget(); media.matches = true;
globalThis.document = {getElementById: id => elements[id]};
globalThis.window = {matchMedia: () => media};
elements['fighter-filters'].contains = el => el === elements['division-filter'];
const toggle = elements['fighter-filter-toggle'];
toggle.setAttribute('aria-expanded', 'false');
initializeMobileFilters();
assert.equal(elements['fighter-active-filters'].hidden, true);
toggle.click();
assert.equal(toggle.getAttribute('aria-expanded'), 'true');
elements['division-filter'].value = 'Lightweight';
elements['division-filter'].dispatchEvent(new Event('change'));
followed.click();
assert.equal(elements['fighter-active-filters'].textContent, '2');
toggle.click();
assert.equal(toggle.getAttribute('aria-expanded'), 'false');
assert.equal(elements['division-filter'].value, 'Lightweight');
assert.equal(followed.getAttribute('aria-pressed'), 'true');
let refreshes = 0;
elements['division-filter'].addEventListener('change', () => refreshes++);
elements['fighter-filter-reset'].click();
assert.equal(refreshes, 1);
assert.equal(elements['division-filter'].value, 'all');
assert.equal(followed.getAttribute('aria-pressed'), 'false');
assert.equal(elements['fighter-search'].value, 'Topuria');
assert.equal(elements['fighter-filter-reset'].hidden, true);
assert.equal(document.activeElement, toggle);
document.activeElement = elements['division-filter'];
media.dispatchEvent(new Event('change'));
assert.equal(toggle.getAttribute('aria-expanded'), 'true');
console.log('PASS: filters retain selections when collapsed, count active values, reset and refresh results, preserve search and focused input');
