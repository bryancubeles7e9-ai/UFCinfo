// The site starts in the visitor's browser language; crawlers keep the Spanish original.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
globalThis.localStorage = { getItem() {}, setItem() {} };
const { preferredLanguage } = await import('../assets/js/i18n.js');
const chrome = 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36';
assert.equal(preferredLanguage(['ca-ES', 'es-ES'], chrome), 'ca');
assert.equal(preferredLanguage(['es-MX', 'en-US'], chrome), 'es');
assert.equal(preferredLanguage(['gl-ES'], chrome), 'es');
assert.equal(preferredLanguage(['eu'], chrome), 'es');
assert.equal(preferredLanguage(['en-US'], chrome), 'en');
assert.equal(preferredLanguage(['fr-FR', 'es-ES'], chrome), 'es');
assert.equal(preferredLanguage(['de-DE'], chrome), 'en');
assert.equal(preferredLanguage([], chrome), 'es');
assert.equal(preferredLanguage(['en-US'], 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'), 'es');
assert.equal(preferredLanguage(['en-US'], 'Mozilla/5.0 HeadlessChrome/130.0'), 'es');
// index.html, 404.html and privacy.html carry the same rule inline (before any script loads).
for (const file of ['index.html', 'assets/404.html', 'privacy.html']) {
  const text = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  const rule = text.match(/function ufcLang\(\)\{[\s\S]*?return l\.length&&l\[0\]\?"en":"es";\}/)?.[0];
  assert.ok(rule, `${file} has the language rule`);
  const ufcLang = (languages, userAgent, saved = null) => new Function('localStorage', 'navigator', rule + 'return ufcLang();')({ getItem: () => saved }, { languages, language: languages[0], userAgent });
  assert.equal(ufcLang(['ca-ES'], chrome), 'ca', file);
  assert.equal(ufcLang(['de-DE'], chrome), 'en', file);
  assert.equal(ufcLang(['en-US'], 'Googlebot/2.1'), 'es', file);
  assert.equal(ufcLang(['en-US'], chrome, 'es'), 'es', file);
}
console.log('PASS: idioma inicial según el navegador, elección guardada y buscadores en español');
