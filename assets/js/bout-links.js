import {directoryFighterByName, normalizeFighterName} from './fighter-directory.js';
import {fullName} from './data.js';

const identity = name => {
  const fighter = directoryFighterByName(name);
  return normalizeFighterName(fighter ? fullName(fighter) : name);
};
// Participants, not their changing card position or red/blue corner.
export const boutShareKey = bout => [bout.red, bout.blue].map(identity).sort().join('~');
export function boutShareUrl(event, bout, base = location.href) {
  const url = new URL(base);
  url.search = '';
  url.hash = 'eventos?' + new URLSearchParams({evento:event.id, combate:boutShareKey(bout)});
  return url.href;
}
export function parseBoutLink(hash) {
  const [view, query] = hash.replace(/^#/, '').split('?');
  if (view !== 'eventos' || !query) return null;
  const params = new URLSearchParams(query);
  const eventId = params.get('evento'), boutKey = params.get('combate');
  if (params.getAll('evento').length !== 1 || params.getAll('combate').length !== 1 ||
      !/^[a-z0-9-]{1,160}$/.test(eventId || '') || !/^[a-z0-9~]{1,400}$/.test(boutKey || '') ||
      boutKey.split('~').length !== 2 || boutKey.split('~').some(name => !name)) return null;
  return {eventId, boutKey};
}
export function resolveBoutLink(events, link) {
  const event = events.find(e => e.type === 'official' && e.id === link.eventId && !['cancelled','postponed'].includes(e.status));
  if (!event) return {event:null, bout:null, index:-1};
  const key = link.boutKey.split('~').map(identity).sort().join('~');
  const index = event.bouts.findIndex(b => boutShareKey(b) === key);
  return {event, bout:event.bouts[index] || null, index};
}
