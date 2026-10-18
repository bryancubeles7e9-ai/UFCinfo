// A delayed result feed must never make a started event disappear.
export function isAwaitingResults(event, now = Date.now()) {
  return event.type === 'official' && ['announced', 'scheduled'].includes(event.status) && Date.parse(event.date) < now;
}
export function visibleOfficialEvents(events, now = Date.now()) {
  const year = new Date(now).getUTCFullYear();
  return events.filter(e => e.type === 'official' &&
    ((e.status || 'completed') === 'completed'
      ? new Date(e.date).getUTCFullYear() === year && Date.parse(e.date) < now
      : Date.parse(e.date) >= now || e.status === 'live' || new Date(e.date).getUTCFullYear() === year));
}
