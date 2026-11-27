// Shareable addresses: /luchadores/<nombre> and /carteleras/<velada>. The server answers them with
// the page's own title, description and photo (assets/data/share-index.json) so links preview well.
import { directoryFighters } from './fighter-directory.js';
import { fullName } from './data.js';
import { getLanguage } from './i18n.js';

export const pathSlug = text => String(text || '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

let slugs = null;
// One slug per fighter; namesakes fall back to their stable id.
function fighterSlugs() {
  if (slugs) return slugs;
  const counts = new Map();
  for (const f of directoryFighters) counts.set(pathSlug(fullName(f)), (counts.get(pathSlug(fullName(f))) || 0) + 1);
  slugs = { byId: new Map(), bySlug: new Map() };
  for (const f of directoryFighters) {
    const name = pathSlug(fullName(f));
    const slug = counts.get(name) > 1 || !name ? pathSlug(f.id) : name;
    slugs.byId.set(f.id, slug);
    slugs.bySlug.set(slug, f.id);
  }
  return slugs;
}

export const fighterPath = fighter => `/luchadores/${fighterSlugs().byId.get(fighter.id) || pathSlug(fighter.id)}`;
export const fighterIdFromSlug = slug => fighterSlugs().bySlug.get(slug) || null;
export const eventPath = event => `/carteleras/${pathSlug(event.id)}`;
// /rankings/peso-ligero, /rankings/peso-paja-femenino, /rankings/libra-por-libra-masculino.
const rankingName = label => /^Libra por libra/.test(label) ? label : label.replace(/ · Masculino$/, '');
export const rankingPath = category => `/rankings/${pathSlug(rankingName(category.label))}`;

export function parseSharePath(pathname) {
  const match = /^\/(luchadores|carteleras|rankings)\/([a-z0-9-]{1,120})\/?$/.exec(pathname || '');
  return match ? { kind: { luchadores: 'fighter', carteleras: 'event', rankings: 'ranking' }[match[1]], slug: match[2] } : null;
}

// Shared from the English or Catalan site, the link carries ?lang so its preview uses that language.
export function shareUrl(path, language = getLanguage(), origin = location.origin) {
  const url = new URL(path, origin);
  if (language === 'en' || language === 'ca') url.searchParams.set('lang', language);
  return url.href;
}

// Native share sheet on phones; copy to the clipboard elsewhere. Returns what happened.
export async function shareLink({ title, url }) {
  if (navigator.share) {
    try { await navigator.share({ title, url }); return 'shared'; }
    catch (error) { if (error?.name === 'AbortError') return 'cancelled'; }
  }
  try { await navigator.clipboard.writeText(url); return 'copied'; }
  catch { return 'failed'; }
}
