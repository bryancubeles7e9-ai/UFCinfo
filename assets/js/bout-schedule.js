import { escapeHTML as esc } from './utils.js';
import { getLocale } from './i18n.js';

const minute = 60000;
export const scheduleExplanation = 'Horas por pelea orientativas, no oficiales. Usamos el inicio oficial de cada bloque cuando está disponible; si falta, estimamos preliminares 2 h antes y previas 4 h antes de la principal. Hasta 30 min por pelea, ajustados al bloque. Pueden cambiar por duración, pausas o cambios de cartelera.';

// Cards are stored top-to-bottom (headliner first), but fought bottom-to-top
// within each section. Elapsed time in bout.time is a RESULT, never a start.
export function estimateBoutStart(event, bout) {
  if (!['announced', 'scheduled', 'live'].includes(event.status)) return null;
  const mainStart = Date.parse(event.date);
  if (!Number.isFinite(mainStart) || !Array.isArray(event.bouts)) return null;
  // An unclassified, partially announced list does not establish running order.
  if (!event.bouts.length || event.bouts.some(b => !['main', 'prelims', 'early-prelims'].includes(b.section))) return null;
  const section = bout.section;
  const peers = event.bouts.filter(b => b.section === section);
  const index = peers.indexOf(bout);
  if (index < 0) return null;
  const offset = {main: 0, prelims: -120, 'early-prelims': -240}[section];
  const schedule = event.sectionSchedule;
  const times = schedule?.eventDate === event.date && schedule?.source === event.source ? schedule.starts : {};
  const officialStart = Date.parse(times?.[section]);
  const start = Number.isFinite(officialStart) && officialStart <= mainStart && officialStart >= mainStart - 12 * 60 * minute ? officialStart : mainStart + offset * minute;
  const nextSection = section === 'early-prelims' ? 'prelims' : 'main';
  const officialEnd = Date.parse(times?.[nextSection]);
  const end = Number.isFinite(officialEnd) && officialEnd > start && officialEnd <= mainStart ? officialEnd : section === 'early-prelims' ? mainStart - 120 * minute : mainStart;
  const duration = (end - start) / minute;
  const slot = section === 'main' ? 30 : Math.min(30, Math.max(0, duration) / peers.length);
  const minutes = (peers.length - 1 - index) * slot;
  // Five-minute precision communicates an estimate rather than a live clock.
  return new Date(Math.round((start + minutes * minute) / (5 * minute)) * 5 * minute).toISOString();
}

export function renderBoutTime(event, bout) {
  if (!['announced', 'scheduled', 'live'].includes(event.status)) return '';
  const start = estimateBoutStart(event, bout);
  const lang = getLocale().slice(0, 2);
  const labels = {
    es: ['Hora aproximada', 'hora local', 'Horario por confirmar'],
    en: ['Approximate time', 'local time', 'Time to be confirmed'],
    ca: ['Hora aproximada', 'hora local', 'Horari per confirmar'],
  }[lang] || ['Hora aproximada', 'hora local', 'Horario por confirmar'];
  if (!start) return `<p class="bout-estimate" translate="no">${labels[2]}</p>`;
  const date = new Date(start);
  const time = new Intl.DateTimeFormat(getLocale(), {hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date);
  const day = new Intl.DateTimeFormat(getLocale(), {day:'numeric',month:'short'}).format(date);
  return `<p class="bout-estimate" translate="no"><span>${labels[0]}</span> <time datetime="${esc(start)}">≈ ${esc(time)} · ${esc(day)}</time> <small>${labels[1]}</small></p>`;
}
