// Renders the brand images with the site's own fonts: the preview shown when the home page is
// shared (1200×630) and the app icons for the installable web app.
// Usage: node scripts/build-brand-images.mjs   (needs Playwright and Chromium)
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const out = name => `${root}assets/images/brand/${name}`;
// Fonts embedded as data URLs: a page opened with setContent cannot read local files.
const font = file => `url(data:font/woff2;base64,${readFileSync(`${root}assets/fonts/${file}`).toString('base64')})`;
const fonts = `@font-face{font-family:Barlow;font-weight:800;src:${font('barlow-condensed-latin-00a5e45f.woff2')}}
@font-face{font-family:Barlow;font-weight:700;src:${font('barlow-condensed-latin-e7616768.woff2')}}
@font-face{font-family:DM;font-weight:400 700;src:${font('dm-sans-latin-002a94d0.woff2')}}`;
const mark = (size) => `<svg width="${size}" height="${size}" viewBox="0 0 48 48"><path d="M20 7H10L3 24l7 17h10l-7-17Z" fill="#f4512b"/><path d="M28 7h10l7 17-7 17H28l7-17Z" fill="#f3f1ec"/><path d="m24 19 5 5-5 5-5-5Z" fill="#f4512b"/></svg>`;

const share = `<html><head><style>${fonts}
*{margin:0;box-sizing:border-box} body{width:1200px;height:630px;background:#101010;color:#f3f1ec;font-family:DM;overflow:hidden;position:relative}
.glow{position:absolute;inset:0;background:radial-gradient(circle at 85% 20%,#f4512b40,transparent 45%),radial-gradient(circle at 10% 110%,#a78bfa2a,transparent 40%)}
.grid{position:absolute;inset:0;background-image:linear-gradient(#ffffff08 1px,transparent 1px),linear-gradient(90deg,#ffffff08 1px,transparent 1px);background-size:60px 60px}
.oct{position:absolute;right:-90px;top:50%;width:560px;height:560px;transform:translateY(-50%);clip-path:polygon(30% 0,70% 0,100% 30%,100% 70%,70% 100%,30% 100%,0 70%,0 30%);border:0;background:linear-gradient(135deg,#f4512b22,#f4512b05)}
.oct2{position:absolute;right:-20px;top:50%;width:420px;height:420px;transform:translateY(-50%);clip-path:polygon(30% 0,70% 0,100% 30%,100% 70%,70% 100%,30% 100%,0 70%,0 30%);background:#101010}
.big{position:absolute;right:70px;top:50%;transform:translateY(-50%)}
main{position:absolute;left:80px;top:90px;width:720px}
.brand{display:flex;align-items:center;gap:18px;font:800 64px/1 Barlow;letter-spacing:.01em}
.brand b{color:#f4512b;font-weight:800}
h1{font:800 84px/.95 Barlow;text-transform:uppercase;margin:46px 0 26px}
h1 span{color:#f4512b}
p{font-size:28px;line-height:1.4;color:#c9c6c0;max-width:640px}
.tags{position:absolute;left:80px;bottom:62px;display:flex;gap:12px}
.tags span{padding:10px 18px;border:1px solid #ffffff2e;border-radius:999px;font-size:21px;font-weight:600;color:#e9e6e0}
</style></head><body><div class="glow"></div><div class="grid"></div><div class="oct"></div><div class="oct2"></div><div class="big">${mark(330)}</div>
<main><div class="brand">${mark(66)}<div>UFC<b>info</b></div></div><h1>Inside the fight<span>.</span></h1>
<p>Carteleras, luchadores, rankings y Pick’em de UFC. Datos oficiales, en español, inglés y catalán.</p></main>
<div class="tags"><span>Carteleras</span><span>Luchadores</span><span>Rankings</span><span>Pick’em</span><span>Leyendas</span></div></body></html>`;

// App icon: the logo mark on the dark background. "maskable" keeps it inside the safe zone.
const icon = (size, padding, radius) => `<html><head><style>*{margin:0}body{width:${size}px;height:${size}px;background:transparent}
div{width:${size}px;height:${size}px;background:#101010;border-radius:${radius}px;display:grid;place-items:center}</style></head>
<body><div>${mark(Math.round(size * (1 - 2 * padding)))}</div></body></html>`;

const browser = await chromium.launch();
async function render(html, width, height, file, transparent = false) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out(file), omitBackground: transparent, type: file.endsWith('.jpg') ? 'jpeg' : 'png', ...(file.endsWith('.jpg') ? { quality: 88 } : {}) });
  await page.close();
}
await render(share, 1200, 630, 'ufcinfo-share.jpg');
await render(icon(192, 0.14, 40), 192, 192, 'icon-192.png', true);
await render(icon(512, 0.14, 108), 512, 512, 'icon-512.png', true);
await render(icon(512, 0.24, 0), 512, 512, 'icon-maskable-512.png');
await render(icon(180, 0.14, 0), 180, 180, 'apple-touch-icon.png');
await browser.close();
console.log('Imágenes de marca generadas en assets/images/brand/');
