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
    const key = pickKey(bout), value = saved?.[key];
    if (selection(value, bout)) valid[key] = value;
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

export const pickMethods = ['general', 'ko', 'submission', 'decision'];
export function selection(value, bout) {
  if (typeof value === 'string') value = {winner:value, method:'general'};
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === 2 && [bout.red,bout.blue].includes(value.winner) &&
    pickMethods.includes(value.method) ? value : null;
}
export function resultMethod(value) {
  const text = String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if (/\b(ko|tko|knockout)\b/.test(text)) return 'ko';
  if (/\b(sub|submission|sumision)\b/.test(text)) return 'submission';
  if (/\b(dec|ud|sd|md|decision)\b/.test(text)) return 'decision';
  if (/\b(dq|disqualification|descalificacion)\b/.test(text)) return 'other';
  return null;
}
// Match server scoring; missing methods remain pending rather than guessed.
export function pickResult(bout, picks) {
  const outcome = String(bout.outcome || bout.method || '').trim().toLowerCase().replaceAll('-', ' ');
  if (bout._void || ['empate','nc','n/c','cancelled','canceled'].includes(outcome) || ['draw','empate','no contest'].some(word=>outcome.includes(word))) return 'void';
  if (![bout.red,bout.blue].includes(bout.winner)) return 'pending';
  const chosen = selection(picks?.[pickKey(bout)], bout);
  if (!chosen) return 'unpicked';
  if (chosen.winner !== bout.winner) return 'wrong';
  if (chosen.method === 'general') return 'correct';
  const method = resultMethod(bout.method);
  return method === null ? 'pending' : method === chosen.method ? 'correct' : 'wrong';
}
export function pickPoints(bout, picks) {
  return pickResult(bout, picks) === 'correct' ? selection(picks[pickKey(bout)], bout).method === 'general' ? 100 : 350 : 0;
}
export function pickSummary(event, picks) {
  const counts = {correct:0, wrong:0, unpicked:0, pending:0, void:0};
  for (const bout of event.bouts) counts[pickResult(bout, picks)]++;
  return counts;
}
