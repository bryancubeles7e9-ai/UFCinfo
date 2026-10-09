import assert from 'node:assert/strict';
import { initializeMobileNavigation } from '../assets/js/mobile-navigation.js';

// Exercise the menu with keyboard, touch-style clicks and viewport changes.
class Element extends EventTarget {
  constructor() {
    super();
    this.attributes = new Map();
    const classes = new Set();
    this.classList = {
      add: value => classes.add(value),
      contains: value => classes.has(value),
      toggle: (value, enabled) => enabled ? classes.add(value) : classes.delete(value),
    };
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name); }
  focus() { document.activeElement = this; }
  closest(selector) { return selector === 'a[data-nav]' && this.link ? this : null; }
}
const header = new Element(), toggle = new Element(), navigation = new Element(), main = new Element();
const media = new EventTarget();
media.matches = true;
header.contains = element => [header, toggle, navigation].includes(element);
globalThis.document = new EventTarget();
document.querySelector = () => header;
document.getElementById = id => ({'mobile-menu-toggle': toggle, 'main-navigation': navigation, main}[id]);
globalThis.window = new EventTarget();
window.matchMedia = () => media;
window.requestAnimationFrame = callback => callback();
toggle.setAttribute('aria-expanded', 'false');
initializeMobileNavigation();
const click = element => element.dispatchEvent(new Event('click'));
const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';
assert.equal(toggle.hidden, false);
assert.equal(isOpen(), false);
click(toggle);
assert.equal(isOpen(), true);
assert.equal(header.classList.contains('mobile-menu-open'), true);
const escape = new Event('keydown');
Object.defineProperty(escape, 'key', {value: 'Escape'});
document.dispatchEvent(escape);
assert.equal(isOpen(), false);
assert.equal(document.activeElement, toggle);
click(toggle);
navigation.link = true;
click(navigation);
assert.equal(isOpen(), false);
assert.equal(document.activeElement, main);
click(toggle);
document.dispatchEvent(new Event('click'));
assert.equal(isOpen(), false);
click(toggle);
window.dispatchEvent(new Event('hashchange'));
assert.equal(isOpen(), false);
click(toggle);
media.matches = false;
media.dispatchEvent(new Event('change'));
assert.equal(isOpen(), false);
document.activeElement = navigation;
media.matches = true;
media.dispatchEvent(new Event('change'));
assert.equal(document.activeElement, toggle);
console.log('PASS: mobile menu opens, closes on Escape/outside/navigation, restores focus and resets on resize');
