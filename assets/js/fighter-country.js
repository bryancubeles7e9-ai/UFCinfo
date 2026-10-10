import { escapeHTML } from './utils.js';

export function countryLabel(fighter, locale = 'es') {
  if (!fighter.country || !fighter.code) return '';
  if (!fighter.countrySource) return fighter.country;
  const special = {
    EN: {es: 'Inglaterra', en: 'England', ca: 'Anglaterra'},
    SC: {es: 'Escocia', en: 'Scotland', ca: 'Escòcia'},
    WL: {es: 'Gales', en: 'Wales', ca: 'Gal·les'},
  };
  if (special[fighter.code]) return special[fighter.code][locale] || fighter.country;
  try {
    return new Intl.DisplayNames([locale], {type: 'region', fallback: 'none'}).of(fighter.code) || fighter.country;
  } catch {
    return fighter.country;
  }
}

export function countryBadge(fighter, locale = 'es') {
  const label = countryLabel(fighter, locale);
  if (!label) return '';
  return `<span class="portrait-number" title="${escapeHTML(label)}" aria-label="${escapeHTML(label)}">${escapeHTML(fighter.code)}</span>`;
}
