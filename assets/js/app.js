import { initializeRumors } from "./rumors.js";
import { getLocale, initializeLanguage } from "./i18n.js";
import { spoilersEnabled, setSpoilersEnabled, revealResult, resultHidden, hiddenResult } from "./spoilers.js";
import { initializeAccount } from "./account.js";
import { eventCalendar } from "./calendar.js";
import { followingActivity, followingFighterCard, followingBoutCard, resolvePinnedBout, boutPinKey } from "./following.js";
import { additionalFighters, directoryFighters, directoryFighterById, fighterNameLink, normalizeFighterName } from "./fighter-directory.js";
import { renderExtendedFighterInfo } from "./fighter-info.js";
import { eventsFeed, refreshEvents } from "./events-feed.js";
import {
  fighters,
  fighterById,
  fullName,
  styleNames,
} from "./data.js";
import { createStore, validateState } from "./store.js";
import {
  $,
  escapeHTML as esc,
  formatDate,
  formatTime,
  countdown,
  localDatetime,
  toast,
} from "./utils.js";
import { initializeLab } from "./lab.js";
import { initializeRankings, rankingCategories } from "./rankings.js";
import {
  stanceNames,
  hasCurrentBelt,
  championshipBadge,
  compactCombatInfo,
  renderCombatDetails,
  renderChampionships,
} from "./fighter-details.js";

const store = createStore();
let account = null;
initializeRankings();
let eventFilter = "upcoming",
  onlyFavorites = false,
  confirmAction = null;
const lab = initializeLab();
const rumors = initializeRumors();
function persist() {
  const saved = store.save();
  $("#storage-status").textContent = saved
    ? "● Guardado local"
    : "○ Sin guardado: exporta tus datos";
  account?.notifyLocalChange();
  if (!saved)
    toast("El navegador no permite guardar. Puedes exportar tus datos.");
}
function portrait(fighter, size = "") {
  return `<div class="fighter-portrait ${size}" style="--fighter-color:${fighter.color || "#d75032"}"><div class="portrait-grid"></div><span class="portrait-number">${esc(fighter.code || "UFC")}</span><span class="portrait-initials" aria-hidden="true">${fighter.first[0]}${fighter.last[0]}</span><img class="fighter-photo" src="${esc(fighter.image)}" alt="${esc(fullName(fighter))}, fotografía de su perfil oficial de UFC" loading="${size === "large" ? "eager" : "lazy"}" decoding="async" width="460" height="700"><span class="portrait-label">FOTOGRAFÍA: UFC · PERFIL OFICIAL</span></div>`;
}
function followButton(fighter, compact = false) {
  const following = store.state.favorites.includes(fighter.id);
  return `<button class="${compact ? `favorite-button ${following ? "selected" : ""}` : "outline-button small"}" data-favorite="${esc(fighter.id)}" aria-pressed="${following}" aria-label="${following ? "Dejar de seguir a" : "Seguir a"} ${esc(fullName(fighter))}">${compact ? following ? "♥" : "♡" : following ? "✓ Siguiendo · Dejar de seguir" : "♡ Seguir luchador"}</button>`;
}
function additionalFighterCard(fighter) {
  return `<article class="fighter-card">${portrait(fighter)}${followButton(fighter, true)}<div class="fighter-card-body"><div class="fighter-card-meta"><span>PERFIL OFICIAL UFC</span></div><button class="fighter-name" data-profile="${esc(fighter.id)}">${esc(fighter.first)}<strong>${esc(fighter.last)}</strong></button><p class="fighter-division">${esc(fighter.division)}</p><p>${esc(fighter.nickname || fighter.officialStyle || "Trayectoria y estadísticas oficiales")}</p><dl class="card-combat-info"><div><dt>RÉCORD · V-D-E</dt><dd>${esc(fighter.record)}</dd></div><div><dt>EQUIPO / GIMNASIO</dt><dd>${esc(fighter.info.gym || "No indicado")}</dd></div></dl><div class="fighter-card-footer"><span>EXPLORAR PERFIL</span><button class="icon-button" data-profile="${esc(fighter.id)}" aria-label="Ver ficha de ${esc(fullName(fighter))}">↗</button></div></div></article>`;
}
function additionalFighterProfile(fighter) {
  const dimension = (v) => v == null ? "No indicado" : `${v} cm`;
  const rows = [["División", fighter.division], ["Récord · V-D-E", fighter.record], ["Apodo", fighter.nickname || "No indicado"], ["Estilo indicado por UFC", fighter.officialStyle || "No indicado"], ["Altura", dimension(fighter.heightCm)], ["Alcance", dimension(fighter.reachCm)], ["Lugar de nacimiento", fighter.birthplace || "No indicado"]];
  return `<div class="profile-layout">${portrait(fighter, "large")}<div class="profile-copy"><p class="eyebrow">${esc(fighter.division)} · PERFIL UFC</p><h2>${esc(fighter.first)}<br>${esc(fighter.last)}</h2><section class="official-facts"><span class="badge orange">DATOS DEL PERFIL UFC</span><dl>${rows.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl><p>Consulta: ${formatDate(fighter.consulted + "T12:00:00Z")} · Copia fechada</p></section>${renderExtendedFighterInfo(fighter)}<a class="button small" href="${esc(fighter.source)}" target="_blank" rel="noopener noreferrer">Perfil oficial UFC ↗</a>${followButton(fighter)}<p class="data-note">Fotografía y datos del perfil oficial de UFC. El lugar de nacimiento no implica nacionalidad deportiva.</p></div></div>`;
}
function fighterCard(fighter) {
  const favorite = store.state.favorites.includes(fighter.id);
  return `<article class="fighter-card">${portrait(fighter)}<button class="favorite-button ${favorite ? "selected" : ""}" data-favorite="${fighter.id}" aria-label="${favorite ? "Dejar de seguir a" : "Seguir a"}: ${esc(fullName(fighter))}" aria-pressed="${favorite}">${favorite ? "♥" : "♡"}</button><div class="fighter-card-body"><div class="fighter-card-meta"><span>${esc(fighter.country)}</span><span>${styleNames[fighter.style]}</span></div>${championshipBadge(fighter)}<button class="fighter-name" data-profile="${fighter.id}">${esc(fighter.first)}<strong>${esc(fighter.last)}</strong></button><p class="fighter-division">${esc(fighter.division)}</p>${compactCombatInfo(fighter)}<p>${esc(fighter.tagline)}</p><div class="fighter-card-footer"><span>EXPLORAR PERFIL</span><button class="icon-button" data-profile="${fighter.id}" aria-label="Ver ficha de ${esc(fullName(fighter))}">↗</button></div></div></article>`;
}
function isUpcomingEvent(event) {
  return event.type === "official" && (event.status || "completed") !== "completed";
}
function availableOfficialEvents() {
  const now = new Date();
  return eventsFeed.events.filter(e => isUpcomingEvent(e)
    ? e.status === "live" || Date.parse(e.date) >= now.getTime()
    : new Date(e.date).getUTCFullYear() === now.getFullYear() && Date.parse(e.date) < now.getTime());
}
function eventStatus(event) {
  return { announced: "ANUNCIADO", scheduled: "PROGRAMADO", live: "EN CURSO", completed: "FINALIZADO" }[event.status || "completed"];
}
function eventPoster(event, featured = false) {
  return `<figure class="event-poster"><img class="event-poster-image" src="${esc(event.poster || "assets/images/event-poster-pending.svg")}" alt="${esc(event.poster ? event.posterAlt || `Imagen promocional oficial de ${event.title}` : `Póster pendiente de publicación: ${event.title}`)}" width="768" height="512" loading="${featured ? "eager" : "lazy"}" decoding="async"><figcaption>${event.poster ? "IMAGEN PROMOCIONAL: UFC" : "PÓSTER OFICIAL PENDIENTE"}</figcaption></figure>`;
}
function feedNote() {
  const date = new Date(eventsFeed.synchronizedAt).toLocaleString(getLocale(), { dateStyle: "medium", timeStyle: "short" });
  return `Fuente: ${eventsFeed.source} · Última ${eventsFeed.automatic ? "sincronización" : "consulta"}: ${date} · ${eventsFeed.unavailable ? "Últimos datos disponibles; no se pudo comprobar una actualización." : eventsFeed.automatic ? "Actualización programada cada 12 horas." : "Copia inicial; pendiente de activar la sincronización."}`;
}
function renderEventFeedStatus() {
  $("#event-feed-status").textContent = `${feedNote()} Fechas y horas en tu zona local. Eventos numerados: próximos anunciados y finalizados de este año. Solo cartelera principal.`;
  $("#event-feed-source").href = eventsFeed.sourceUrl;
  $("#event-feed-source").textContent = `Fuente: ${eventsFeed.source} ↗`;
}
function officialResult(bout, key) {
  if (resultHidden(key)) return hiddenResult(key);
  const details = [bout.method, bout.round ? `R${bout.round}` : "", bout.time].filter(Boolean).map(esc).join(" · ");
  if (bout.winner) return `Ganador: <strong>${esc(bout.winner)}</strong>${details ? ` · ${details}` : ""}`;
  if (bout.outcome) return `${esc(bout.outcome)}${details ? ` · ${details}` : ""}`;
  return "Resultado aún no disponible. Consulta el evento oficial.";
}
function officialEventCard(event, featured = false) {
  const upcoming = isUpcomingEvent(event);
  return `<article class="event-card official-event-card ${featured ? "featured" : ""}"><div class="event-info"><span class="badge orange">UFC NUMERADO · ${eventStatus(event)}</span><p class="eyebrow">CARTELERA PRINCIPAL · ${event.bouts.length ? `${event.bouts.length} COMBATES${upcoming ? " ANUNCIADOS" : ""}` : "PENDIENTE DE ANUNCIO"}</p><h3 translate="no">${esc(event.title)}</h3><p>${esc(event.subtitle)}</p><div class="event-location" translate="no">${esc(event.location)}</div><div class="event-date">${formatDate(event.date)} · ${formatTime(event.date)} <small>hora local</small></div>${upcoming ? `<div class="countdown" data-official-countdown="${esc(event.date)}"></div>` : ""}<button class="button small" data-official-event="${esc(event.id)}">${upcoming ? "Ver combates anunciados" : "Ver cartelera y resultados"} ↗</button><p><a class="text-link" href="${esc(event.source)}" target="_blank" rel="noopener noreferrer">Evento oficial UFC ↗</a></p>${upcoming ? '<p class="data-note">Cartelera anunciada; los combates y horarios pueden cambiar.</p>' : ""}</div>${eventPoster(event, featured)}</article>`;
}
function showOfficialEvent(id) {
  const event = availableOfficialEvents().find(e => e.id === id);
  if (!event) return;
  const upcoming = isUpcomingEvent(event);
  $("#event-detail").dataset.officialEventId = id;
  $("#event-detail").innerHTML = `<p class="eyebrow">UFC NUMERADO · ${eventStatus(event)}</p><h2 class="event-dialog-title" translate="no">${esc(event.title)} · ${esc(event.subtitle)}</h2><p class="muted"><span translate="no">${esc(event.location)}</span> · ${formatDate(event.date)} · ${formatTime(event.date)} (hora local)</p><p class="data-note">${upcoming ? "Combates anunciados de la cartelera principal; pueden cambiar antes del evento." : "Todos los combates de la cartelera principal."} ${esc(feedNote())}</p><div class="bout-list">${event.bouts.length ? event.bouts.map((b,i) => `<article class="bout"><div class="bout-heading"><span>${i === 0 ? "COMBATE ESTELAR" : i === 1 ? "COMBATE COESTELAR" : `COMBATE ${i+1}`}</span><span>${esc(b.division)}</span></div><div class="official-bout-names">${fighterNameLink(b.red, "bout-fighter-name")}<span>VS</span>${fighterNameLink(b.blue, "bout-fighter-name")}</div><p class="official-result">${upcoming ? "Combate anunciado · Sin resultado" : officialResult(b, boutPinKey(event, b))}</p></article>`).join("") : empty("La cartelera principal todavía no se ha anunciado.")}</div><a class="button small" href="${esc(event.source)}" target="_blank" rel="noopener noreferrer">Cartelera oficial UFC ↗</a>`;
  if (!$("#event-dialog").open) $("#event-dialog").showModal();
}
function eventCard(event, featured = false) {
  if (event.type === "official") return officialEventCard(event, featured);
  const red = fighterById(event.bouts[0][0]),
    blue = fighterById(event.bouts[0][1]);
  return `<article class="event-card ${featured ? "featured" : ""}"><div class="event-info"><div class="event-card-top"><span class="badge ${event.type === "demo" ? "" : "orange"}">${event.type === "demo" ? "CARTELERA DEMO" : "TU CARTELERA"}</span><button class="event-bookmark" data-save-event="${esc(event.id)}" aria-label="Exportar calendario de ${esc(event.title)}" title="Descargar calendario">↓</button></div><p class="eyebrow">${esc(event.subtitle || "TU NOCHE. TUS COMBATES.")}</p><h3 translate="no">${esc(event.title)}</h3><div class="event-location" translate="no">${esc(event.location)}</div><div class="event-date"><span>◷</span> ${formatDate(event.date)} · ${formatTime(event.date)} <small>hora local</small></div><div class="countdown" data-countdown="${esc(event.date)}"></div><button class="button small" data-event="${esc(event.id)}">Ver cartelera y pronosticar ↗</button>${event.type === "custom" ? `<button class="text-link delete-event" data-delete-event="${esc(event.id)}">Eliminar evento</button>` : ""}</div><div class="event-matchup"><span class="event-rounds">MAIN EVENT · ${event.rounds} ROUNDS</span><div class="matchup-name"><span>${esc(red.first)}</span><strong>${esc(red.last)}</strong></div><div class="vs-rule"><span>VS</span></div><div class="matchup-name blue-name"><span>${esc(blue.first)}</span><strong>${esc(blue.last)}</strong></div><p>ENFRENTAMIENTO HIPOTÉTICO · SIN RESULTADOS OFICIALES</p></div></article>`;
}
function renderOverview() {
  $("#fighter-count").textContent = String(directoryFighters.length).padStart(2, "0");
  $("#event-count").textContent = String(availableOfficialEvents().length).padStart(
    2,
    "0",
  );
  $("#pick-count").textContent = String(store.state.favorites.length).padStart(2, "0");
  const sorted = [...store.state.events].sort(
    (a, b) => Date.parse(a.date) - Date.parse(b.date),
  );
  const upcoming =
    sorted.find((e) => Date.parse(e.date) > Date.now()) || sorted[0];
  const official = availableOfficialEvents();
  const latestOfficial = official.filter(isUpcomingEvent).sort((a,b) => Date.parse(a.date)-Date.parse(b.date))[0] || official.filter(e => !isUpcomingEvent(e)).sort((a,b) => Date.parse(b.date)-Date.parse(a.date))[0];
  $("#featured-event-label").textContent = latestOfficial && isUpcomingEvent(latestOfficial) ? "PRÓXIMO EVENTO NUMERADO" : "ÚLTIMO EVENTO NUMERADO";
  $("#featured-event-title").textContent = latestOfficial && isUpcomingEvent(latestOfficial) ? "La próxima noche de combate." : "Así terminó la noche.";
  $("#featured-event").innerHTML = latestOfficial
    ? eventCard(latestOfficial, true)
    : upcoming ? eventCard(upcoming, true)
    : empty("Aún no hay eventos. Crea tu primera cartelera.");
  $("#featured-fighters").innerHTML = fighters
    .slice(0, 3)
    .map(fighterCard)
    .join("");
}
function renderFighters() {
  const query = $("#fighter-search").value.toLocaleLowerCase("es").trim(),
    style = $("#style-filter").value,
    division = $("#division-filter").value,
    stance = $("#stance-filter").value,
    belts = $("#championship-filter").value;
  let list = fighters.filter(
    (f) =>
      `${fullName(f)} ${f.country} ${f.nickname} ${f.division} ${f.officialStyle} ${f.martialBase} ${stanceNames[f.stance]?.short || ""} ${styleNames[f.style]}`
        .toLocaleLowerCase("es")
        .includes(query) &&
      (style === "all" || f.style === style) &&
      (division === "all" || f.division === division) &&
      (stance === "all" || f.stance === stance) &&
      (belts === "all" ||
        (belts === "current"
          ? hasCurrentBelt(f)
          : belts === "former"
            ? f.championships.some((belt) => belt.status === "former")
            : f.championships.length > 0)) &&
      (!onlyFavorites || store.state.favorites.includes(f.id)),
  );
  if (style === "all" && stance === "all" && belts === "all") {
    list.push(...additionalFighters.filter((f) =>
      normalizeFighterName(`${fullName(f)} ${f.aliases.join(" ")} ${f.nickname} ${f.division} ${f.birthplace || ""} ${f.officialStyle || ""} ${f.info.gym || ""}`).includes(normalizeFighterName(query)) &&
      (division === "all" || f.division === division) && (!onlyFavorites || store.state.favorites.includes(f.id))));
  }
  if ($("#fighter-sort").value === "name")
    list.sort((a, b) => fullName(a).localeCompare(fullName(b), "es"));
  if ($("#fighter-sort").value === "power")
    list.sort((a, b) => (b.stats?.[2] ?? -1) - (a.stats?.[2] ?? -1));
  $("#fighter-list").innerHTML = list.length
    ? list.map((f) => f.supplemental ? additionalFighterCard(f) : fighterCard(f)).join("")
    : empty("Ningún luchador coincide. Prueba otros filtros.");
}
function renderEvents() {
  renderEventFeedStatus();
  const query = $("#event-search").value.toLocaleLowerCase("es").trim();
  const list = [...availableOfficialEvents(), ...store.state.events]
    .filter(
      (e) =>
        (eventFilter === "all" || e.type === eventFilter || (eventFilter === "upcoming" && isUpcomingEvent(e)) || (eventFilter === "completed" && e.type === "official" && !isUpcomingEvent(e))) &&
        `${e.title} ${e.subtitle || ""} ${e.location} ${e.type === "official" ? e.bouts.map(b => `${b.red} ${b.blue}`).join(" ") : ""}`.toLocaleLowerCase("es").includes(query),
    )
    .sort((a, b) => {
      const au = isUpcomingEvent(a), bu = isUpcomingEvent(b);
      if (au !== bu) return au ? -1 : 1;
      return au ? Date.parse(a.date) - Date.parse(b.date) : Date.parse(b.date) - Date.parse(a.date);
    });
  $("#event-list").innerHTML = list.length
    ? list.map((e) => eventCard(e)).join("")
    : empty("No hay carteleras con estos filtros. Puedes crear la tuya.");
  updateCountdowns();
}
function empty(text) {
  return `<div class="empty-state"><span>◇</span><p>${esc(text)}</p></div>`;
}
function renderSaved() {
  const activity = followingActivity(store.state.favorites, availableOfficialEvents());
  const pinnedKey = store.state.pinnedBout;
  const pinned = resolvePinnedBout(pinnedKey, eventsFeed.events);
  $("#following-pinned-panel").hidden = !pinnedKey;
  $("#following-pinned").innerHTML = pinned
    ? followingBoutCard(pinned, pinned.event.status === "completed", pinnedKey)
    : pinnedKey ? '<p class="data-note">Este combate ya no está en la cartelera disponible.</p><button class="text-link" data-unpin-bout>Quitar fijado</button>' : "";
  $("#saved-count").textContent = activity.fighters.length;
  $("#following-count").textContent = activity.fighters.length;
  $("#following-bouts-count").textContent = activity.upcoming.length;
  $("#following-events-count").textContent = activity.upcomingEvents;
  $("#following-feed-status").textContent = `${feedNote()} Solo carteleras principales de eventos numerados disponibles. Fechas y horas en tu zona local.`;
  $("#saved-fighters").innerHTML = activity.fighters.length ? activity.fighters.map(f => followingFighterCard(f, activity, rankingCategories)).join("") : empty("Tu esquina está vacía. Añade un luchador para seguir sus próximos combates.");
  $("#following-upcoming").innerHTML = activity.upcoming.length ? activity.upcoming.map(item => followingBoutCard(item, false, pinnedKey)).join("") : empty(activity.fighters.length ? "Tus luchadores no tienen próximos combates anunciados en las carteleras disponibles." : "Sigue a tus luchadores favoritos para crear tu agenda de combates.");
  $("#following-recent").innerHTML = activity.recent.length ? activity.recent.slice(0, 6).map(item => followingBoutCard(item, true, pinnedKey)).join("") : empty(activity.fighters.length ? "No hay combates recientes de tus luchadores en el historial disponible." : "Aquí verás los resultados disponibles de los luchadores que sigues.");
  const select = $("#follow-fighter"), selected = select.value;
  const options = directoryFighters.filter(f => !store.state.favorites.includes(f.id)).sort((a, b) => fullName(a).localeCompare(fullName(b), "es"));
  select.innerHTML = options.length ? options.map(f => `<option value="${esc(f.id)}">${esc(fullName(f))} · ${esc(f.division)}</option>`).join("") : '<option value="">Ya sigues a todos los luchadores</option>';
  if (options.some(f => f.id === selected)) select.value = selected;
  select.disabled = $("#follow-selected").disabled = !options.length;
}
function refreshSpoilerViews() {
  renderSaved();
  rumors.draw();
  const id = $("#event-detail").dataset.officialEventId;
  if ($("#event-dialog").open && id) showOfficialEvent(id);
}
$("#spoiler-button").addEventListener("click", () => {
  setSpoilersEnabled(!spoilersEnabled());
  $("#spoiler-button").textContent = spoilersEnabled() ? "Sin spoilers: ON" : "Sin spoilers: OFF";
  $("#spoiler-button").setAttribute("aria-pressed", String(spoilersEnabled()));
  refreshSpoilerViews();
});
function renderAll() {
  document.body.classList.toggle("light", store.state.theme === "light");
  renderOverview();
  renderFighters();
  renderEvents();
  renderSaved();
}
function showProfile(id) {
  $("#fighter-detail").dataset.fighterId = id;
  const fighter = directoryFighterById(id);
  if (!fighter) return;
  if (fighter.supplemental) {
    $("#fighter-detail").innerHTML = additionalFighterProfile(fighter);
    if (!$("#fighter-dialog").open) $("#fighter-dialog").showModal();
    return;
  }
  $("#fighter-detail").innerHTML =
    `<div class="profile-layout">${portrait(fighter, "large")}<div class="profile-copy"><p class="eyebrow">${esc(fighter.country)} · ${styleNames[fighter.style]}</p><h2>${esc(fighter.first)}<br>${esc(fighter.last)}</h2><p>${esc(fighter.tagline)}</p><section class="official-facts"><span class="badge orange">DATOS DEL PERFIL UFC</span><dl><div><dt>División</dt><dd>${esc(fighter.division)}</dd></div><div><dt>Récord · V-D-E</dt><dd>${esc(fighter.record)}</dd></div><div><dt>Apodo</dt><dd>${esc(fighter.nickname || "No indicado")}</dd></div><div><dt>Estilo indicado por UFC</dt><dd>${esc(fighter.officialStyle || "No indicado")}</dd></div><div><dt>Altura / alcance</dt><dd>${fighter.heightCm ?? "—"} cm / ${fighter.reachCm ?? "—"} cm</dd></div><div><dt>Lugar de nacimiento</dt><dd>${esc(fighter.birthplace || "No indicado")}</dd></div></dl><p>Consulta: 2 de octubre de 2026 · Copia fechada</p></section>${renderCombatDetails(fighter)}${renderChampionships(fighter)}${renderExtendedFighterInfo(fighter)}<a class="button small" href="${fighter.source}" target="_blank" rel="noopener noreferrer">Perfil oficial UFC ↗</a><button class="outline-button small" data-favorite="${fighter.id}">${store.state.favorites.includes(id) ? "✓ Siguiendo · Dejar de seguir" : "♡ Seguir luchador"}</button><p class="data-note">Fotografía y datos consultados en el perfil oficial de UFC. Consulta la fuente para cambios posteriores.</p></div></div>`;
  if (!$("#fighter-dialog").open) $("#fighter-dialog").showModal();
}
function showEvent(id) {
  const event = store.state.events.find((e) => e.id === id);
  if (!event) return;
  delete $("#event-detail").dataset.officialEventId;
  $("#event-detail").dataset.eventId = id;
  $("#event-detail").innerHTML =
    `<p class="eyebrow">${event.type === "demo" ? "CARTELERA DE DEMOSTRACIÓN" : "CARTELERA DE AFICIONADOS"}</p><h2 class="event-dialog-title" translate="no">${esc(event.title)}</h2><p class="muted"><span translate="no">${esc(event.location)}</span> · ${formatDate(event.date)} · ${formatTime(event.date)}</p><p class="data-note">Combates imaginarios: pueden cruzar categorías de peso. Tus picks son opiniones personales y no apuestas.</p><div class="bout-list">${event.bouts
      .map(([redId, blueId], index) => {
        const red = fighterById(redId),
          blue = fighterById(blueId),
          key = `${event.id}:${index}`,
          picked = store.state.picks[key];
        return `<article class="bout"><div class="bout-heading"><span>${index === 0 ? "COMBATE ESTELAR" : `COMBATE ${index + 1}`}</span><span>${index === 0 ? event.rounds : 3} × 5 MIN</span></div><div class="bout-buttons"><button data-pick="${esc(key)}" data-winner="${redId}" class="pick-button ${picked === redId ? "picked" : ""}" aria-pressed="${picked === redId}"><small>ESQUINA ROJA</small><strong>${esc(fullName(red))}</strong><span>${picked === redId ? "✓ TU PICK" : "Elegir ganador"}</span></button><span class="bout-vs">VS</span><button data-pick="${esc(key)}" data-winner="${blueId}" class="pick-button blue-pick ${picked === blueId ? "picked" : ""}" aria-pressed="${picked === blueId}"><small>ESQUINA AZUL</small><strong>${esc(fullName(blue))}</strong><span>${picked === blueId ? "✓ TU PICK" : "Elegir ganador"}</span></button></div><button class="text-link" data-compare="${redId},${blueId}">Comparar en Fight Lab ↗</button></article>`;
      })
      .join("")}</div>`;
  if (!$("#event-dialog").open) $("#event-dialog").showModal();
}
function updateCountdowns() {
  document.querySelectorAll("[data-official-countdown]").forEach(element => {
    const time = countdown(element.dataset.officialCountdown);
    element.innerHTML = time.ended ? "<span class='ended-label'>Evento en curso · Pendiente de actualización</span>" : `<span>${time.days}<small>DÍAS</small></span><b>:</b><span>${time.hours}<small>HORAS</small></span><b>:</b><span>${time.minutes}<small>MIN</small></span>`;
  });
  document.querySelectorAll("[data-countdown]").forEach((element) => {
    const time = countdown(element.dataset.countdown);
    element.innerHTML = time.ended
      ? "<span class='ended-label'>Fecha de ejemplo alcanzada</span>"
      : [
          [time.days, "DÍAS"],
          [time.hours, "HORAS"],
          [time.minutes, "MIN"],
          [time.seconds, "SEG"],
        ]
          .map(
            ([value, label]) =>
              `<div><strong>${String(value).padStart(2, "0")}</strong><small>${label}</small></div>`,
          )
          .join("");
  });
}
function navigate() {
  let view = location.hash.slice(1) || "inicio";
  if (
    ![
      "inicio",
      "eventos",
      "luchadores",
      "rankings",
      "laboratorio",
      "guardados",
      "rumores",
    ].includes(view)
  )
    view = "inicio";
  document
    .querySelectorAll("[data-view]")
    .forEach((section) => (section.hidden = section.dataset.view !== view));
  document.querySelectorAll("[data-nav]").forEach((link) => {
    link.classList.toggle("active", link.dataset.nav === view);
    if (link.dataset.nav === view) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  document.title = view === "inicio" ? "UFCinfo — Carteleras UFC, luchadores y rankings MMA" : `${{ eventos: "Carteleras", luchadores: "Luchadores", rankings: "Rankings", laboratorio: "Fight Lab", guardados: "Mi esquina", rumores: "Rumores" }[view]} — UFCinfo`;
  window.scrollTo({ top: 0, behavior: "instant" });
}
function askDelete(title, action) {
  confirmAction = action;
  $("#confirm-title").textContent = title;
  $("#confirm-dialog").showModal();
}
function download(blob, filename) {
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportCalendar(id) {
  const event = availableOfficialEvents().find(e => e.id === id) || store.state.events.find(e => e.id === id);
  if (!event) return;
  download(new Blob([eventCalendar(event)], { type: "text/calendar;charset=utf-8" }), `${event.id}.ics`);
  toast("Calendario descargado");
}
const fighterOptions = fighters
  .map((f) => `<option value="${f.id}">${esc(fullName(f))}</option>`)
  .join("");
$("#builder-red").innerHTML = fighterOptions;
$("#builder-blue").innerHTML = fighterOptions;
function openBuilder() {
  const form = $("#builder-form");
  form.reset();
  form.elements.date.value = localDatetime(new Date(Date.now() + 86400000));
  form.elements.blue.value = "holloway";
  $("#builder-dialog").showModal();
}
$("#open-builder").addEventListener("click", openBuilder);
document
  .querySelectorAll("[data-builder]")
  .forEach((button) => button.addEventListener("click", openBuilder));
$("#builder-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.target),
    title = data.get("title").trim(),
    locationName = data.get("location").trim(),
    red = data.get("red"),
    blue = data.get("blue"),
    date = new Date(data.get("date"));
  if (!title || !locationName) {
    toast("Escribe un nombre y una ciudad.");
    return;
  }
  if (red === blue) {
    toast("Elige dos luchadores distintos.");
    return;
  }
  if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
    toast("Elige una fecha futura para tu evento.");
    return;
  }
  if (store.state.events.length >= 200) {
    toast("Exporta o elimina algún evento antes de crear más.");
    return;
  }
  store.state.events.push({
    id: crypto.randomUUID(),
    title,
    location: locationName,
    date: date.toISOString(),
    type: "custom",
    rounds: Number(data.get("rounds")),
    bouts: [[red, blue]],
  });
  persist();
  renderAll();
  $("#builder-dialog").close();
  location.hash = "eventos";
  toast("Tu cartelera está lista");
});
document.addEventListener("click", (event) => {
  const reveal = event.target.closest("[data-reveal-result]");
  if (reveal) {
    revealResult(reveal.dataset.revealResult);
    refreshSpoilerViews();
    return;
  }
  const pinButton = event.target.closest("[data-pin-bout], [data-unpin-bout]");
  if (pinButton) {
    const key = pinButton.dataset.pinBout;
    if (key && !resolvePinnedBout(key, eventsFeed.events)) return;
    store.state.pinnedBout = !key || store.state.pinnedBout === key ? null : key;
    persist();
    renderSaved();
    toast(store.state.pinnedBout ? "Combate fijado en tu esquina" : "Combate desfijado");
    return;
  }
  const officialButton = event.target.closest("[data-official-event]");
  if (officialButton) { showOfficialEvent(officialButton.dataset.officialEvent); return; }
  const favorite = event.target.closest("[data-favorite]");
  if (favorite) {
    const id = favorite.dataset.favorite;
    if (!directoryFighterById(id)) return;
    const index = store.state.favorites.indexOf(id);
    if (index < 0) store.state.favorites.push(id);
    else store.state.favorites.splice(index, 1);
    persist();
    renderAll();
    if ($("#fighter-dialog").open) {
      $("#fighter-dialog").close();
      showProfile(id);
    }
    toast(index < 0 ? "Siguiendo al luchador" : "Has dejado de seguir al luchador");
    return;
  }
  const profile = event.target.closest("[data-profile]");
  if (profile) {
    showProfile(profile.dataset.profile);
    return;
  }
  const eventButton = event.target.closest("[data-event]");
  if (eventButton) {
    showEvent(eventButton.dataset.event);
    return;
  }
  const pick = event.target.closest("[data-pick]");
  if (pick) {
    const key = pick.dataset.pick;
    if (store.state.picks[key] === pick.dataset.winner)
      delete store.state.picks[key];
    else store.state.picks[key] = pick.dataset.winner;
    persist();
    renderOverview();
    renderSaved();
    showEvent($("#event-detail").dataset.eventId);
    toast("Pronóstico actualizado");
    return;
  }
  const comparison = event.target.closest("[data-compare]");
  if (comparison) {
    const [red, blue] = comparison.dataset.compare.split(",");
    lab.compare(red, blue);
    $("#event-dialog").close();
    location.hash = "laboratorio";
    return;
  }
  const calendar = event.target.closest("[data-save-event]");
  if (calendar) {
    exportCalendar(calendar.dataset.saveEvent);
    return;
  }
  const deleteEvent = event.target.closest("[data-delete-event]");
  if (deleteEvent) {
    const id = deleteEvent.dataset.deleteEvent;
    askDelete("¿Eliminar tu cartelera?", () => {
      store.state.events = store.state.events.filter((e) => e.id !== id);
      Object.keys(store.state.picks)
        .filter((key) => key.startsWith(`${id}:`))
        .forEach((key) => delete store.state.picks[key]);
      persist();
      renderAll();
      toast("Cartelera eliminada");
    });
    return;
  }
  const close = event.target.closest("[data-close]");
  if (close) close.closest("dialog").close();
});
$("#cancel-confirm").addEventListener("click", () => {
  $("#confirm-dialog").close();
  confirmAction = null;
});
$("#accept-confirm").addEventListener("click", () => {
  if (confirmAction) confirmAction();
  confirmAction = null;
  $("#confirm-dialog").close();
});
for (const selector of [
  "#fighter-search",
  "#style-filter",
  "#division-filter",
  "#stance-filter",
  "#championship-filter",
  "#fighter-sort",
])
  $(selector).addEventListener(
    selector === "#fighter-search" ? "input" : "change",
    renderFighters,
  );
$("#follow-selected").addEventListener("click", () => {
  const id = $("#follow-fighter").value;
  if (!directoryFighterById(id) || store.state.favorites.includes(id)) return;
  store.state.favorites.push(id);
  persist();
  renderAll();
  toast("Luchador añadido a tu esquina");
});
$("#favorites-only").addEventListener("click", () => {
  onlyFavorites = !onlyFavorites;
  $("#favorites-only").setAttribute("aria-pressed", String(onlyFavorites));
  renderFighters();
});
$("#event-search").addEventListener("input", renderEvents);
document.querySelectorAll("[data-event-filter]").forEach((button) =>
  button.addEventListener("click", () => {
    eventFilter = button.dataset.eventFilter;
    document.querySelectorAll("[data-event-filter]").forEach((b) => {
      b.classList.toggle("active", b === button);
      b.setAttribute("aria-pressed", String(b === button));
    });
    renderEvents();
  }),
);
$("#theme-button").addEventListener("click", () => {
  store.state.theme = store.state.theme === "dark" ? "light" : "dark";
  persist();
  renderAll();
});
$("#export-data").addEventListener("click", () => {
  download(
    new Blob([JSON.stringify(store.state, null, 2)], {
      type: "application/json",
    }),
    "ufcinfo-backup.json",
  );
  toast("Copia de tu esquina exportada");
});
$("#import-data").addEventListener("click", () => $("#import-file").click());
$("#import-file").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 2000000) throw new Error("El archivo supera los 2 MB.");
    const data = JSON.parse(await file.text());
    if (!validateState(data))
      throw new Error("La copia no contiene datos válidos de UFCinfo.");
    $("#confirm-title").textContent = "¿Restaurar esta copia?";
    $("#confirm-dialog p").textContent =
      "Tu seguimiento y tus datos guardados se sustituirán por los de la copia.";
    $("#accept-confirm").textContent = "Restaurar";
    confirmAction = () => {
      store.replace(data);
      persist();
      renderAll();
      toast("Copia restaurada");
    };
    $("#confirm-dialog").showModal();
  } catch (error) {
    toast(
      error instanceof SyntaxError
        ? "El archivo no contiene JSON válido."
        : error.message,
    );
  } finally {
    event.target.value = "";
  }
});
$("#confirm-dialog").addEventListener("close", () => {
  $("#confirm-dialog p").textContent =
    "Esta acción lo quitará de tus datos guardados.";
  $("#accept-confirm").textContent = "Eliminar";
  confirmAction = null;
});
document.addEventListener("octagon:rankings-updated", renderSaved);
window.addEventListener("hashchange", navigate);
$("#current-date").textContent = new Date().toLocaleDateString(getLocale(), {
  day: "numeric",
  month: "long",
  year: "numeric",
});
document
  .querySelectorAll("[data-event-filter]")
  .forEach((button) =>
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.eventFilter === eventFilter),
    ),
  );
$("#division-filter").innerHTML =
  '<option value="all">Todas las divisiones</option>' +
  [...new Set(directoryFighters.map((f) => f.division))]
    .sort((a, b) => a.localeCompare(b, "es"))
    .map(
      (division) =>
        `<option value="${esc(division)}">${esc(division)}</option>`,
    )
    .join("");
document.addEventListener(
  "error",
  (event) => {
    if (event.target.matches?.(".event-poster-image")) {
      if (event.target.dataset.fallback) return;
      event.target.dataset.fallback = "true";
      event.target.src = "assets/images/event-poster-pending.svg";
      event.target.alt = "Imagen del póster no disponible";
      event.target.closest("figure").querySelector("figcaption").textContent = "PÓSTER NO DISPONIBLE";
      return;
    }
    if (!event.target.matches?.(".fighter-photo")) return;
    event.target.hidden = true;
    const portrait = event.target.closest(".fighter-portrait");
    portrait.classList.add("photo-unavailable");
    portrait.querySelector(".portrait-label").textContent =
      "FOTO NO DISPONIBLE · VER PERFIL OFICIAL";
  },
  true,
);
account = initializeAccount({store, onChange: renderAll});
renderAll();
navigate();
updateCountdowns();
persist();
setInterval(updateCountdowns, 1000);

async function updateEventFeed() {
  await refreshEvents();
  renderOverview();
  renderEvents();
  renderSaved();
  const officialId = $("#event-detail").dataset.officialEventId;
  if ($("#event-dialog").open && officialId) showOfficialEvent(officialId);
}
updateEventFeed();
setInterval(updateEventFeed, 300000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) updateEventFeed();
});

// Preserve navigation, selections, spoiler state and open dialogs when switching language.
document.addEventListener("ufcinfo:language-changed", () => {
  renderAll();
  updateCountdowns();
  $("#current-date").textContent = new Date().toLocaleDateString(getLocale(), {day:"numeric", month:"long", year:"numeric"});
  const officialId = $("#event-detail").dataset.officialEventId;
  if ($("#event-dialog").open) {
    if (officialId) showOfficialEvent(officialId);
    else if ($("#event-detail").dataset.eventId) showEvent($("#event-detail").dataset.eventId);
  }
  if ($("#fighter-dialog").open && $("#fighter-detail").dataset.fighterId) showProfile($("#fighter-detail").dataset.fighterId);
});
initializeLanguage();
