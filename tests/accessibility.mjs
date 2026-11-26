// Audits the main screens with axe-core (WCAG 2.1 A/AA and best practices) on a running server.
// Usage: node tests/accessibility.mjs http://127.0.0.1:8780   (needs playwright and axe-core)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const base = process.argv[2] || 'http://127.0.0.1:8780';
const b = await chromium.launch();
const results = {};
async function audit(name, setup, vp = {width:390,height:844}) {
  const ctx = await b.newContext({viewport: vp, isMobile: vp.width < 500});
  const p = await ctx.newPage();
  await setup(p, ctx);
  await p.waitForTimeout(900);
  await p.addScriptTag({path: AXE});
  const r = await p.evaluate(async () => {
    const res = await axe.run(document, {runOnly: {type:'tag', values:['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice']}});
    return res.violations.map(v => ({id:v.id, impact:v.impact, n:v.nodes.length, help:v.help, targets:v.nodes.slice(0,3).map(n=>n.target.join(' ')+' :: '+(n.failureSummary||'').split('\n')[1])}));
  });
  results[name] = r; await ctx.close();
}
await audit('portada', async p => { await p.goto(base+'/'); await p.waitForLoadState('networkidle'); });
await audit('salon-leyendas', async p => { await p.goto(base+'/#luchadores'); await p.waitForLoadState('networkidle'); await p.click('[data-fighter-scope="legend"]'); });
await audit('ficha-leyenda', async p => { await p.goto(base+'/luchadores/anderson-silva'); await p.waitForLoadState('networkidle'); });
await audit('ficha-luchador', async p => { await p.goto(base+'/luchadores/ilia-topuria'); await p.waitForLoadState('networkidle'); });
await audit('cartelera', async p => { await p.goto(base+'/carteleras/ufc-335'); await p.waitForLoadState('networkidle'); });
await audit('rankings', async p => { await p.goto(base+'/rankings/peso-ligero'); await p.waitForLoadState('networkidle'); });
await audit('rumores', async p => { await p.goto(base+'/#rumores'); await p.waitForLoadState('networkidle'); });
await audit('privacidad', async p => { await p.goto(base+'/privacidad'); });
await audit('404', async p => { await p.goto(base+'/no-existe'); });
await audit('sin-conexion', async (p, ctx) => { await p.goto(base+'/'); await p.waitForLoadState('networkidle'); await ctx.setOffline(true); await p.evaluate(()=>window.dispatchEvent(new Event('offline'))); });
await audit('ordenador-leyendas', async p => { await p.goto(base+'/#luchadores'); await p.waitForLoadState('networkidle'); await p.click('[data-fighter-scope="legend"]'); }, {width:1440,height:900});
await audit('tema-claro-leyenda', async p => { await p.goto(base+'/'); await p.waitForLoadState('networkidle'); await p.evaluate(()=>document.getElementById('theme-button').click()); await p.goto(base+'/luchadores/royce-gracie'); await p.waitForLoadState('networkidle'); });
let total = 0;
for (const [k, v] of Object.entries(results)) { total += v.length; for (const x of v) { console.error(`[${k}] ${x.impact} ${x.id} (${x.n}): ${x.help}`); x.targets.forEach(t=>console.error('      ', t.slice(0,180))); } }
await b.close();
if (total) { console.error(`Accesibilidad: ${total} problema(s)`); process.exit(1); }
console.log(`PASS: accesibilidad sin problemas en ${Object.keys(results).length} pantallas`);
