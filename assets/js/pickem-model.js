// Browser-local predictions use the matchup, never its position on the card.
export const pickKey = bout => JSON.stringify([bout.red, bout.blue].sort());
export function closingTime(event) {
  const main = Date.parse(event.date);
  const schedule = event.sectionSchedule;
  const starts = schedule?.eventDate === event.date && schedule?.source === event.source
    ? Object.values(schedule.starts || {}).map(Date.parse).filter(t => Number.isFinite(t) && t <= main && t >= main - 12 * 3600000) : [];
  // Without verified block times, close conservatively before the main card.
  const sections = [...new Set(event.bouts.map(b => b.section))];
  const complete = sections.length && sections.every(section => ['main', 'prelims', 'early-prelims'].includes(section) &&
    schedule?.eventDate === event.date && schedule?.source === event.source &&
    starts.includes(Date.parse(schedule.starts?.[section])));
  return complete ? Math.min(...starts) : main - 4 * 3600000;
}
export function nextPickEvent(events, now = Date.now()) {
  return events.filter(e => e.type === 'official' && ['scheduled', 'announced', 'live'].includes(e.status) &&
    Number.isFinite(Date.parse(e.date)) && Date.parse(e.date) + 12 * 3600000 > now)
    .sort((a,b) => Date.parse(a.date) - Date.parse(b.date))[0] || null;
}
export function picksFor(event, saved) {
  const valid = {};
  for (const bout of event.bouts) {
    const key = pickKey(bout), winner = saved?.[key];
    if ([bout.red, bout.blue].includes(winner)) valid[key] = winner;
  }
  return valid;
}
export function isClosed(event, now = Date.now()) {
  return !['scheduled', 'announced'].includes(event.status) || !Number.isFinite(closingTime(event)) || now >= closingTime(event);
}
export function readPicks(storage) {
  try {
    const value = JSON.parse(storage.getItem('ufcinfo-pickem-v1'));
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  } catch { /* Invalid or blocked storage must not prevent using the page. */ }
  return {};
}
