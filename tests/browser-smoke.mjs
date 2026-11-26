// Opens the real site in Chromium, on desktop and mobile, and fails on any visible breakage.
// Usage: node tests/browser-smoke.mjs http://127.0.0.1:8780
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const base = process.argv[2] || 'http://127.0.0.1:8780';
const views = ['inicio', 'eventos', 'luchadores', 'rankings', 'laboratorio', 'pickem', 'rumores', 'guardados'];
const devices = { ordenador: { width: 1440, height: 900 }, movil: { width: 390, height: 844, isMobile: true, hasTouch: true } };
const problems = [];

const browser = await chromium.launch();
for (const [device, viewport] of Object.entries(devices)) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.isMobile, hasTouch: viewport.hasTouch });
  const report = message => problems.push(`[${device}] ${message}`);
  page.on('pageerror', error => report(`error de JavaScript: ${error.message}`));
  // Only the site's own files count; external photos or fonts may fail without breaking it.
  page.on('response', response => {
    if (response.url().startsWith(base) && response.status() >= 400) report(`${response.status()} en ${response.url().slice(base.length)}`);
  });
  for (const view of views) {
    await page.goto(`${base}/#${view}`);
    await page.waitForLoadState('networkidle').catch(() => {});
    const state = await page.evaluate(view => {
      const section = document.querySelector(`[data-view="${view}"]`);
      return { visible: Boolean(section && !section.hidden), text: (section?.innerText || '').trim().length,
               overflow: document.documentElement.scrollWidth - window.innerWidth };
    }, view);
    if (!state.visible) report(`#${view} no se muestra`);
    else if (state.text < 40) report(`#${view} aparece vacía`);
    if (state.overflow > 2) report(`#${view} se desborda ${state.overflow}px en horizontal`);
  }
  // Key interactions: a fighter profile and a fight card open with content.
  const step = async (label, action) => {
    try { await action(); } catch (error) { report(`${label}: ${error.message.split('\n')[0]}`); }
  };
  await step('la ficha de un luchador no se abre', async () => {
    await page.goto(`${base}/#luchadores`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.locator('[data-profile]:visible').first().click({ timeout: 5000 });
    await page.locator('#fighter-dialog[open] h2').first().waitFor({ timeout: 5000 });
    await page.keyboard.press('Escape');
  });
  await step('la cartelera de una velada no se abre', async () => {
    await page.goto(`${base}/#eventos`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.locator('[data-official-event]:visible').first().click({ timeout: 5000 });
    await page.locator('#event-dialog[open] .bout').first().waitFor({ timeout: 5000 });
    await page.keyboard.press('Escape');
  });
  // Switching language must translate the interface without errors.
  if (device === 'ordenador') await step('el cambio de idioma no se aplica', async () => {
    await page.selectOption('#language-select', 'en', { timeout: 5000 });
    await page.waitForFunction(() => document.documentElement.lang === 'en', null, { timeout: 5000 });
  });
  await page.close();
}
await browser.close();

if (problems.length) {
  console.error(`La web tiene ${problems.length} problema(s):\n- ` + problems.join('\n- '));
  process.exit(1);
}
console.log(`PASS: ${views.length} secciones en ordenador y móvil, ficha, cartelera e idioma sin errores`);
