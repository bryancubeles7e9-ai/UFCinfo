// Measurement units: metric (cm, kg) or US customary (feet and inches, pounds).
// Visitors whose browser is set to US English start with US units; anyone can switch in the header.
import { getLocale } from './i18n.js';

const storageKey = 'ufcinfo-units';
let units = 'metric';
try {
  const saved = globalThis.localStorage?.getItem(storageKey);
  units = saved === 'imperial' || saved === 'metric' ? saved : (globalThis.navigator?.language === 'en-US' ? 'imperial' : 'metric');
} catch { /* Metric remains available without storage. */ }

export const getUnits = () => units;
const known = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
const number = (value, digits = 1) => new Intl.NumberFormat(getLocale(), { maximumFractionDigits: digits }).format(value);

// 180 cm → "180 cm" or 5′ 11″
export function formatHeight(cm, missing = '—') {
  if (!known(cm)) return missing;
  if (units === 'metric') return `${number(cm, 0)} cm`;
  const inches = Math.round(cm / 2.54);
  return `${Math.floor(inches / 12)}′ ${inches % 12}″`;
}
// Reach and leg reach: 185 cm → "185 cm" or 73″
export function formatLength(cm, missing = '—') {
  if (!known(cm)) return missing;
  return units === 'metric' ? `${number(cm, 1)} cm` : `${number(cm / 2.54, 0)}″`;
}
// 70.3 kg → "70,3 kg" or "155 lb"
export function formatWeight(kg, missing = '—') {
  if (!known(kg)) return missing;
  return units === 'metric' ? `${number(kg, 1)} kg` : `${number(kg * 2.20462, 0)} lb`;
}

export function setUnits(next) {
  if (next !== 'metric' && next !== 'imperial') return false;
  units = next;
  try { globalThis.localStorage?.setItem(storageKey, next); } catch { /* Works for this visit. */ }
  // Same redraw as a language change: lists, open profiles and Fight Lab keep their state.
  if (typeof document !== 'undefined') document.dispatchEvent(new Event('ufcinfo:language-changed'));
  return true;
}

export function initializeUnits() {
  const select = document.querySelector('#units-select');
  if (!select) return;
  select.value = units;
  select.addEventListener('change', event => setUnits(event.target.value));
}
