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

// Small switch shown next to the measurements (fighter profile and Fight Lab).
export function unitsToggle() {
  const option = (value, label) => `<button type="button" data-units="${value}" aria-pressed="${units === value}">${label}</button>`;
  return `<div class="units-toggle" role="group" aria-label="Unidades de medida" translate="no">${option('metric', 'cm · kg')}${option('imperial', 'ft · lb')}</div>`;
}

export function initializeUnits() {
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-units]');
    if (!button || button.getAttribute('aria-pressed') === 'true') return;
    setUnits(button.dataset.units);
    // Keep keyboard focus on the switch after the redraw.
    const scope = button.closest('dialog') ? `#${button.closest('dialog').id} ` : '';
    setTimeout(() => document.querySelector(`${scope}.units-toggle [data-units="${button.dataset.units}"]`)?.focus({ preventScroll: true }), 60);
  });
}
