import { escapeHTML as esc } from './utils.js';
import { getLocale } from './i18n.js';

const minute = 60000;
export const scheduleExplanation = 'Horas por pelea orientativas, no oficiales. Usamos el inicio oficial de cada bloque cuando está disponible; si falta, estimamos preliminares 2 h antes y previas 4 h antes de la principal. Calculamos 30 min por combate de 3 asaltos y 50 min por uno de 5; sin duración confirmada usamos 30 min. Ajustamos las preliminares al bloque y ampliamos el margen hacia el final. Pueden cambiar por duración, pausas o cambios de cartelera.';

// Cards are stored top-to-bottom (headliner first), but fought bottom-to-top
// within each section. Elapsed time in bout.time is a RESULT, never a start.
export function estimateBoutWindow(event, bout) {
  if (!['announced', 'scheduled', 'live'].includes(event.status)) return null;
  const mainStart = Date.parse(event.date);
  if (!Number.isFinite(mainStart) || !Array.isArray(event.bouts)) return null;
  // An unclassified, partially announced list does not establish running order.
  if (!event.bouts.length || event.bouts.some(b => !['main', 'prelims', 'early-prelims'].includes(b.section))) return null;
  const section = bout.section;
  const active = b => !b._void && !['cancelled','canceled'].includes(b.status);
  const peers = event.bouts.filter(b => b.section === section && active(b));
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
  const plannedMinutes = b => b.scheduledRounds === 5 ? 50 : 30;
  const preceding = peers.slice(index + 1); // Earlier fights in running order.
  const scale = section === 'main' ? 1 : Math.min(1, Math.max(0, duration) / peers.reduce((sum,b) => sum + plannedMinutes(b),0));
  const minutes = preceding.reduce((sum,b) => sum + plannedMinutes(b),0) * scale;
  const roundFive = value => Math.round(value / (5 * minute)) * 5 * minute;
  const center = roundFive(start + minutes * minute);
  const tolerance = (preceding.length >= 3 ? 15 : 10) + (preceding.some(b => b.scheduledRounds === 5) ? 5 : 0);
  const low = preceding.length ? Math.max(start, center - tolerance * minute) : center;
  const latest = center + (preceding.length ? tolerance : 10) * minute;
  const high = section === 'main' ? latest : Math.min(end, latest);
  return {start:new Date(roundFive(low)).toISOString(), end:new Date(roundFive(high)).toISOString(), estimate:new Date(center).toISOString()};
}

// Keep the central estimate available to existing consumers and tests.
export function estimateBoutStart(event, bout) {
  return estimateBoutWindow(event,bout)?.estimate || null;
}

export function renderBoutTime(event, bout) {
  if (!['announced', 'scheduled', 'live'].includes(event.status)) return '';
  const window = estimateBoutWindow(event, bout);
  const lang = getLocale().slice(0, 2);
  const labels = {
    es: ['Franja estimada', 'hora local', 'Horario por confirmar'],
    en: ['Estimated window', 'local time', 'Time to be confirmed'],
    ca: ['Franja estimada', 'hora local', 'Horari per confirmar'],
  }[lang] || ['Franja estimada', 'hora local', 'Horario por confirmar'];
  if (!window) return `<p class="bout-estimate" translate="no">${labels[2]}</p>`;
  const from = new Date(window.start), to = new Date(window.end);
  const crossesClockChange = from.getTimezoneOffset() !== to.getTimezoneOffset();
  const time = value => new Intl.DateTimeFormat(getLocale(), {hour:'2-digit',minute:'2-digit',hourCycle:'h23',...(crossesClockChange?{timeZoneName:'shortOffset'}:{})}).format(value);
  const day = value => new Intl.DateTimeFormat(getLocale(), {day:'numeric',month:'short'}).format(value);
  const sameDay = new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'}).format(from) === new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'}).format(to);
  const first = sameDay ? time(from) : `${time(from)} · ${day(from)}`;
  const last = `${time(to)} · ${day(to)}`;
  return `<p class="bout-estimate" translate="no"><span>${labels[0]}</span> <time datetime="${esc(window.start)}">${esc(first)}</time> – <time datetime="${esc(window.end)}">${esc(last)}</time> <small>${labels[1]}</small></p>`;
}
