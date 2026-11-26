// Metric and US units for height, reach and weight.
import assert from 'node:assert/strict';
const store = {};
globalThis.localStorage = { getItem: key => store[key] ?? null, setItem: (key, value) => { store[key] = value; } };
// A visitor from Spain starts with metric units (a US English browser would start with US units).
Object.defineProperty(globalThis, 'navigator', { value: { language: 'es-ES' }, configurable: true });
const { formatHeight, formatLength, formatWeight, getUnits, setUnits } = await import('../assets/js/units.js');

assert.equal(getUnits(), 'metric');
assert.equal(formatHeight(180), '180 cm');
assert.equal(formatLength(185), '185 cm');
assert.equal(formatWeight(70.3), '70,3 kg');
assert.equal(formatHeight(null), '—');
assert.equal(formatWeight(undefined, 'No indicado'), 'No indicado');

assert.equal(setUnits('imperial'), true);
assert.equal(store['ufcinfo-units'], 'imperial');
assert.equal(formatHeight(180), '5′ 11″');
assert.equal(formatHeight(193), '6′ 4″');
assert.equal(formatHeight(152), '5′ 0″');
assert.equal(formatLength(185.4), "73″");
assert.equal(formatLength(175), "69″");
assert.equal(formatWeight(70.3), '155 lb');
assert.equal(formatWeight(120.2), '265 lb');
assert.equal(formatLength(0), '—');
assert.equal(setUnits('nautical'), false);
assert.equal(getUnits(), 'imperial');
console.log('PASS: medidas en cm/kg y en pies, pulgadas y libras');
