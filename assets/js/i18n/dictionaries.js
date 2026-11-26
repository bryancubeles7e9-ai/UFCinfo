// English and Catalan dictionaries. Loaded only when a visitor chooses one of those languages,
// so Spanish visitors (the source language) never download them.
import { english } from './en.js';
import { catalan } from './ca.js';
import { martialNotes } from './martial-notes.js';
import { legendNotes } from './legend-notes.js';
import { legendsCopy } from './legends.js';
import { privacyCopy } from './privacy.js';
// Bout classes built by boutDivisionLabel() in utils.js, in every form it can produce.
const weights = [['mosca','Flyweight','mosca'], ['gallo','Bantamweight','gall'], ['pluma','Featherweight','ploma'], ['ligero','Lightweight','lleuger'],
  ['wélter','Welterweight','wèlter'], ['medio','Middleweight','mitjà'], ['semipesado','Light Heavyweight','semipesant'], ['pesado','Heavyweight','pesant'],
  ['paja','Strawweight','palla'], ['pactado','Catchweight','pactat']];
const boutClasses = { en: {}, ca: {} };
for (const [es, en, ca] of weights) for (const [women, enWomen, caWomen] of [['', '', ''], [' femenino', "Women's ", ' femení']]) {
  Object.assign(boutClasses.en, { [`Peso ${es}${women}`]: `${enWomen}${en}`, [`Título del peso ${es}${women}`]: `${enWomen}${en} title`, [`Título interino del peso ${es}${women}`]: `Interim ${enWomen}${en} title` });
  Object.assign(boutClasses.ca, { [`Peso ${es}${women}`]: `Pes ${ca}${caWomen}`, [`Título del peso ${es}${women}`]: `Títol del pes ${ca}${caWomen}`, [`Título interino del peso ${es}${women}`]: `Títol interí del pes ${ca}${caWomen}` });
}
export const dictionaries = { en: {...boutClasses.en, ...english, ...martialNotes.en, ...legendNotes.en, ...legendsCopy.en, ...privacyCopy.en}, ca: {...boutClasses.ca, ...catalan, ...martialNotes.ca, ...legendNotes.ca, ...legendsCopy.ca, ...privacyCopy.ca} };
