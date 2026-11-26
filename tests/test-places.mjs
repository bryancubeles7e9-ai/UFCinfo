// Venues, birthplaces and the rankings date come from UFC.com in English: they are shown in the visitor's language.
import assert from 'node:assert/strict';
import { formatLocation } from '../assets/js/utils.js';
import { publishedLabel } from '../assets/js/rankings.js';

assert.equal(formatLocation('T-Mobile Arena, Las Vegas United States'), 'T-Mobile Arena, Las Vegas, Estados Unidos');
assert.equal(formatLocation('T-Mobile Arena, Las Vegas, United States'), 'T-Mobile Arena, Las Vegas, Estados Unidos');
assert.equal(formatLocation('The Venue, Riyadh Saudi Arabia'), 'The Venue, Riyadh, Arabia Saudí');
assert.equal(formatLocation('Etihad Arena, Yas Island/Yas West United Arab Emirates'), 'Etihad Arena, Yas Island/Yas West, Emiratos Árabes Unidos');
assert.equal(formatLocation('Galaxy Arena, Macao'), 'Galaxy Arena, Macao');
assert.equal(formatLocation('Meta APEX'), 'Meta APEX');
assert.equal(formatLocation('Germany'), 'Alemania');
assert.equal(formatLocation('Manchester, England'), 'Manchester, Inglaterra');
assert.equal(formatLocation(''), '');

assert.equal(publishedLabel({ published: 'Tuesday, Nov. 24', synchronizedAt: '2026-11-26T20:49:59Z' }), 'martes, 24 de noviembre de 2026');
// A December list read in January belongs to the previous year.
assert.match(publishedLabel({ published: 'Tuesday, Dec. 29', synchronizedAt: '2027-01-02T08:00:00Z' }), /29 de diciembre de 2026/);
assert.equal(publishedLabel({ published: 'Sin fecha' }), 'Sin fecha');
console.log('PASS: sedes, lugares de nacimiento y fecha de rankings en el idioma de la web');
