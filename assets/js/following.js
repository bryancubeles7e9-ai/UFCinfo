import { renderBoutTime } from './bout-schedule.js';
import { isLegend, legendBadge } from "./fighter-legacy.js";
import { resultHidden, hiddenResult } from "./spoilers.js";
import { directoryFighterById, directoryFighterByName, fighterNameLink, normalizeFighterName } from "./fighter-directory.js";
import { fullName } from "./data.js";
import { escapeHTML as esc, formatDate, formatTime } from "./utils.js";

// Use the same catalogue identities as Mi esquina, including name aliases/accents.
export function followedBoutFighters(bout, ids = []) {
  const following = new Set(ids);
  return [...new Map([bout.red, bout.blue].map(directoryFighterByName)
    .filter(f => f && following.has(f.id)).map(f => [f.id, f])).values()];
}
export function followedBoutBadge(bout, ids = []) {
  const tracked = followedBoutFighters(bout, ids);
  if (!tracked.length) return '';
  return `<span class="followed-bout-badge"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg><span>Sigues a</span> <span translate="no">${esc(tracked.map(fullName).join(' · '))}</span></span>`;
}

// Identify the participants rather than their position in a changing card.
export function boutPinKey(event, bout) {
  return JSON.stringify([event.id, ...[bout.red, bout.blue].map(normalizeFighterName).sort()]);
}
export function resolvePinnedBout(key, events) {
  for (const event of events) {
    if (event.type !== "official") continue;
    const index = event.bouts.findIndex(bout => boutPinKey(event, bout) === key);
    if (index >= 0) return {event, bout: event.bouts[index], index, tracked: []};
  }
  return null;
}

export function followingActivity(ids, events, now = Date.now()) {
  const fighters = [...new Set(ids)].map(directoryFighterById).filter(Boolean);
  const following = new Set(fighters.map(f => f.id));
  const upcoming = [], recent = [];
  const seen = new Set();
  for (const event of events) {
    if (event.type !== "official" || seen.has(event.id) || !Number.isFinite(Date.parse(event.date))) continue;
    seen.add(event.id);
    const status = event.status || "completed";
    const future = status === "live" || (["announced", "scheduled"].includes(status) && Date.parse(event.date) >= now);
    const completed = status === "completed" && Date.parse(event.date) <= now;
    if (!future && !completed) continue;
    for (const [index, bout] of event.bouts.entries()) {
      const tracked = [bout.red, bout.blue].map(directoryFighterByName).filter(f => f && following.has(f.id));
      if (tracked.length) (future ? upcoming : recent).push({event, bout, index, tracked});
    }
  }
  upcoming.sort((a, b) => Date.parse(a.event.date) - Date.parse(b.event.date));
  recent.sort((a, b) => Date.parse(b.event.date) - Date.parse(a.event.date));
  return {
    fighters, upcoming, recent,
    upcomingEvents: new Set(upcoming.map(item => item.event.id)).size,
    withoutBout: fighters.filter(f => !upcoming.some(item => item.tracked.some(t => t.id === f.id))),
  };
}

export function fighterRankings(fighter, categories) {
  return categories.flatMap(c => {
    if (c.champion && directoryFighterByName(c.champion)?.id === fighter.id) return [`Campeón/a · ${c.label}`];
    const index = c.names.findIndex(name => directoryFighterByName(name)?.id === fighter.id);
    return index < 0 ? [] : [`#${c.ranks?.[index] ?? index + 1} · ${c.label}`];
  });
}

export function followingFighterCard(fighter, activity, categories) {
  const next = activity.upcoming.find(item => item.tracked.some(f => f.id === fighter.id));
  const ranks = fighterRankings(fighter, categories);
  return `<article class="followed-fighter ${isLegend(fighter) ? "fighter-legend" : ""}">${legendBadge(fighter)}<div class="followed-fighter-heading"><img src="${esc(fighter.image)}" alt="${esc(fullName(fighter))}" width="460" height="700" loading="lazy"><div><p class="eyebrow">${esc(fighter.division)}</p><button class="followed-fighter-name" data-profile="${esc(fighter.id)}">${esc(fullName(fighter))} ›</button><p>Récord: ${esc(fighter.record)}</p></div></div><p class="followed-ranking">${esc(isLegend(fighter) ? "Trayectoria histórica · Retiro documentado" : ranks.length ? ranks.join(" · ") : "Sin posición en el top 15 disponible")}</p><div class="followed-next"><p class="eyebrow">${next?.event.status === "live" ? "COMBATE EN EVENTO EN CURSO" : "PRÓXIMO COMBATE"}</p>${next ? `<strong>${esc(next.event.title)}</strong><p>${esc(next.bout.red)} vs ${esc(next.bout.blue)}</p><p>${formatDate(next.event.date)} · ${formatTime(next.event.date)}</p><button class="text-link" data-official-event="${esc(next.event.id)}">Ver cartelera ›</button>` : '<p>Sin próximo combate anunciado en las carteleras disponibles.</p>'}</div><button class="outline-button small" data-favorite="${esc(fighter.id)}" aria-pressed="true" aria-label="Dejar de seguir a ${esc(fullName(fighter))}">✓ Siguiendo · Dejar de seguir</button></article>`;
}

export function followingBoutCard(item, recent = false, pinnedKey = null) {
  const {event, bout, tracked} = item;
  const pinKey = boutPinKey(event, bout);
  const pinned = pinKey === pinnedKey;
  const result = bout.winner ? `Ganador: ${bout.winner}` : bout.outcome || "Resultado aún no disponible";
  const details = [bout.method, bout.round ? `R${bout.round}` : "", bout.time].filter(Boolean).join(" · ");
  return `<article class="following-bout"><div class="following-bout-top"><span class="badge ${recent ? "" : "orange"}">${esc(event.title)}${event.status === "live" ? " · EN CURSO" : ""}</span><span>${formatDate(event.date)} · ${formatTime(event.date)}</span></div><div class="following-bout-names">${fighterNameLink(bout.red, "bout-fighter-name")}<span>VS</span>${fighterNameLink(bout.blue, "bout-fighter-name")}</div><p class="data-note">${tracked.length ? `Sigues a ${esc(tracked.map(fullName).join(" y "))} · ` : ""}${esc(bout.division)}</p>${recent ? "" : renderBoutTime(event, bout)}${recent ? `<p class="following-result" data-result-key="${esc(pinKey)}">${resultHidden(pinKey) ? hiddenResult(pinKey) : `${esc(result)}${details ? ` · ${esc(details)}` : ""}`}</p>` : `<p>${esc(event.location)}</p>`}<div class="following-bout-actions"><button class="text-link" data-pin-bout="${esc(pinKey)}" aria-pressed="${pinned}">${pinned ? "Quitar fijado" : "Fijar combate"}</button><button class="text-link" data-official-event="${esc(event.id)}">${recent ? "Ver resultados" : "Ver cartelera"} ›</button>${recent ? "" : `<button class="text-link" data-save-event="${esc(event.id)}">Añadir al calendario ↓</button>`}</div></article>`;
}
