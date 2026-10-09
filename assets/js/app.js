import { initializeRumors } from "./rumors.js";
import { initializeMobileNavigation } from "./mobile-navigation.js";
import { getLocale, initializeLanguage } from "./i18n.js";
import { spoilersEnabled, setSpoilersEnabled, revealResult, resultHidden, hiddenResult } from "./spoilers.js";
import { initializeAccount } from "./account.js";
import { eventCalendar } from "./calendar.js";
import { followingActivity, followingFighterCard, followingBoutCard, resolvePinnedBout, boutPinKey } from "./following.js";
import { additionalFighters, directoryFighters, directoryFighterById, fighterNameLink, normalizeFighterName } from "./fighter-directory.js";
import { refreshFighterRecords } from "./fighter-records-feed.js";
import { renderExtendedFighterInfo, renderFighterConsultation } from "./fighter-info.js";
import { eventsFeed, refreshEvents } from "./events-feed.js";
import {
  fighters,
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
  eventKindFilter = "all",
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
  return `<div class="profile-layout">${portrait(fighter, "large")}<div class="profile-copy"><p class="eyebrow">${esc(fighter.division)} · PERFIL UFC</p><h2>${esc(fighter.first)}<br>${esc(fighter.last)}</h2><section class="official-facts"><span class="badge orange">DATOS DEL PERFIL UFC</span><dl>${rows.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>${renderFighterConsultation(fighter)}</section>${renderExtendedFighterInfo(fighter)}<a class="button small" href="${esc(fighter.source)}" target="_blank" rel="noopener noreferrer">Perfil oficial UFC ↗</a>${followButton(fighter)}<p class="data-note">Fotografía y datos del perfil oficial de UFC. El lugar de nacimiento no implica nacionalidad deportiva.</p></div></div>`;
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
function eventKindLabel(event) {
  return event.eventKind === "special" ? "UFC EVENTO ESPECIAL" : event.eventKind === "fight-night" ? "UFC FIGHT NIGHT" : "UFC NUMERADO";
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
  $("#event-feed-status").textContent = `${feedNote()} Fechas y horas en tu zona local. Eventos numerados, Fight Night y especiales: próximos anunciados y finalizados de este año. Solo cartelera principal.`;
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
  return `<article class="event-card official-event-card ${featured ? "featured" : ""}"><div class="event-info"><span class="badge orange">${eventKindLabel(event)} · ${eventStatus(event)}</span><p class="eyebrow">CARTELERA PRINCIPAL · ${event.bouts.length ? `${event.bouts.length} COMBATES${upcoming ? " ANUNCIADOS" : ""}` : "PENDIENTE DE ANUNCIO"}</p><h3 translate="no">${esc(event.title)}</h3><p>${esc(event.subtitle)}</p><div class="event-location" translate="no">${esc(event.location)}</div><div class="event-date">${formatDate(event.date)} · ${formatTime(event.date)} <small>hora local</small></div>${upcoming ? `<div class="countdown" data-official-countdown="${esc(event.date)}"></div>` : ""}<button class="button small" data-official-event="${esc(event.id)}">${upcoming ? "Ver combates anunciados" : "Ver cartelera y resultados"} ↗</button><p><a class="text-link" href="${esc(event.source)}" target="_blank" rel="noopener noreferrer">Evento oficial UFC ↗</a></p>${upcoming ? '<p class="data-note">Cartelera anunciada; los combates y horarios pueden cambiar.</p>' : ""}</div>${eventPoster(event, featured)}</article>`;
}
function showOfficialEvent(id) {
  const event = availableOfficialEvents().find(e => e.id === id);
  if (!event) return;
  const upcoming = isUpcomingEvent(event);
  $("#event-detail").dataset.officialEventId = id;
  $("#event-detail").innerHTML = `<p class="eyebrow">${eventKindLabel(event)} · ${eventStatus(event)}</p><h2 class="event-dialog-title" translate="no">${esc(event.title)} · ${esc(event.subtitle)}</h2><p class="muted"><span translate="no">${esc(event.location)}</span> · ${formatDate(event.date)} · ${formatTime(event.date)} (hora local)</p><p class="data-note">${upcoming ? "Combates anunciados de la cartelera principal; pueden cambiar antes del evento." : "Todos los combates de la cartelera principal."} ${esc(feedNote())}</p><div class="bout-list">${event.bouts.length ? event.bouts.map((b,i) => `<article class="bout"><div class="bout-heading"><span>${i === 0 ? "COMBATE ESTELAR" : i === 1 ? "COMBATE COESTELAR" : `COMBATE ${i+1}`}</span><span>${esc(b.division)}</span></div><div class="official-bout-names">${fighterNameLink(b.red, "bout-fighter-name")}<span>VS</span>${fighterNameLink(b.blue, "bout-fighter-name")}</div><p class="official-result">${upcoming ? "Combate anunciado · Sin resultado" : officialResult(b, boutPinKey(event, b))}</p></article>`).join("") : empty("La cartelera principal todavía no se ha anunciado.")}</div><a class="button small" href="${esc(event.source)}" target="_blank" rel="noopener noreferrer">Cartelera oficial UFC ↗</a>`;
  if (!$("#event-dialog").open) $("#event-dialog").showModal();
}
function renderOverview() {
  $("#fighter-count").textContent = String(directoryFighters.length).padStart(2, "0");
  $("#event-count").textContent = String(availableOfficialEvents().length).padStart(
    2,
    "0",
  );
  $("#pick-count").textContent = String(store.state.favorites.length).padStart(2, "0");
  const official = availableOfficialEvents();
  const latestOfficial = official.filter(isUpcomingEvent).sort((a,b) => Date.parse(a.date)-Date.parse(b.date))[0] || official.filter(e => !isUpcomingEvent(e)).sort((a,b) => Date.parse(b.date)-Date.parse(a.date))[0];
  $("#featured-event-label").textContent = latestOfficial && isUpcomingEvent(latestOfficial) ? "PRÓXIMO EVENTO UFC" : "ÚLTIMO EVENTO UFC";
  $("#featured-event-title").textContent = latestOfficial && isUpcomingEvent(latestOfficial) ? "La próxima noche de combate." : "Así terminó la noche.";
  $("#featured-event").innerHTML = latestOfficial
    ? officialEventCard(latestOfficial, true)
    : empty("No hay eventos UFC disponibles.");
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
function renderHomeBanner() {
  const upcoming = availableOfficialEvents().filter(isUpcomingEvent)
    .sort((a, b) => (a.status === "live" ? -1 : 0) - (b.status === "live" ? -1 : 0) || Date.parse(a.date) - Date.parse(b.date));
  const event = upcoming[0];
  const banner = $("#home-event-banner");
  if (!event) {
    banner.innerHTML = `<div class="hero-copy"><p class="eyebrow">TU AGENDA UFC</p><h1>La próxima noche<br>está por anunciar.</h1><p>No hay próximos eventos UFC en los datos disponibles.</p><a class="button" href="#eventos">Ver todas las carteleras ↗</a><p class="data-note">${esc(feedNote())}</p></div><aside class="hero-agenda"><p class="eyebrow">EXPLORA UFCINFO</p><a class="outline-button" href="#rankings">Rankings ↗</a><a class="outline-button" href="#luchadores">Explorar luchadores ↗</a><a class="outline-button" href="#laboratorio">Entrar al Fight Lab →</a></aside>`;
    return;
  }
  const main = event.bouts[0];
  banner.innerHTML = `<div class="hero-copy"><div class="hero-tag"><span>${event.status === "live" ? "EN CURSO" : "PRÓXIMO EVENTO UFC"}</span><span translate="no">${esc(event.title)}</span></div><h1 translate="no">${main ? `${esc(main.red)}<span class="hero-versus">vs</span>${esc(main.blue)}` : esc(event.title)}</h1><dl class="hero-facts"><div><dt>FECHA Y HORA LOCAL</dt><dd>${formatDate(event.date)} · ${formatTime(event.date)}</dd></div><div><dt>SEDE</dt><dd translate="no">${esc(event.location)}</dd></div></dl><div class="hero-buttons"><button class="button" data-official-event="${esc(event.id)}">Ver combates anunciados ↗</button><a class="outline-button" href="#eventos">Ver todas las carteleras ↗</a></div><p class="data-note">${esc(feedNote())}</p></div><aside class="hero-agenda"><p class="eyebrow">CARTELERA PRINCIPAL</p><h2>${event.bouts.length ? `${event.bouts.length} <span>combates anunciados</span>` : "Pendiente de anuncio"}</h2>${event.status === "live" ? '<p class="badge orange">EN CURSO</p>' : `<div class="countdown" data-official-countdown="${esc(event.date)}"></div>`}<div class="hero-bouts">${event.bouts.slice(0, 3).map((bout, i) => `<div><span class="eyebrow">${i === 0 ? "COMBATE ESTELAR" : i === 1 ? "COMBATE COESTELAR" : "COMBATE ANUNCIADO"}</span><p translate="no">${esc(bout.red)} <span>vs</span> ${esc(bout.blue)}</p><small translate="no">${esc(bout.division)}</small></div>`).join("")}</div><p class="data-note">Cartelera anunciada; los combates y horarios pueden cambiar.</p><a class="text-link" href="${esc(event.source)}" target="_blank" rel="noopener noreferrer">Evento oficial UFC ↗</a></aside>`;
}
function renderEvents() {
  renderHomeBanner();
  renderEventFeedStatus();
  const query = $("#event-search").value.toLocaleLowerCase("es").trim();
  const list = availableOfficialEvents()
    .filter(e => eventKindFilter === "all" || (e.type === "official" && (e.eventKind || "numbered") === eventKindFilter))
    .filter(
      (e) =>
        (eventFilter === "all" || (eventFilter === "upcoming" && isUpcomingEvent(e)) || (eventFilter === "completed" && !isUpcomingEvent(e))) &&
        `${e.title} ${e.subtitle || ""} ${e.location} ${e.type === "official" ? e.bouts.map(b => `${b.red} ${b.blue}`).join(" ") : ""}`.toLocaleLowerCase("es").includes(query),
    )
    .sort((a, b) => {
      const au = isUpcomingEvent(a), bu = isUpcomingEvent(b);
      if (au !== bu) return au ? -1 : 1;
      return au ? Date.parse(a.date) - Date.parse(b.date) : Date.parse(b.date) - Date.parse(a.date);
    });
  $("#event-list").innerHTML = list.length
    ? list.map((e) => officialEventCard(e)).join("")
    : empty("No hay carteleras con estos filtros. Prueba otra selección.");
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
  $("#following-feed-status").textContent = `${feedNote()} Carteleras principales de eventos numerados, Fight Night y especiales disponibles. Fechas y horas en tu zona local.`;
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
    `<div class="profile-layout">${portrait(fighter, "large")}<div class="profile-copy"><p class="eyebrow">${esc(fighter.country)} · ${styleNames[fighter.style]}</p><h2>${esc(fighter.first)}<br>${esc(fighter.last)}</h2><p>${esc(fighter.tagline)}</p><section class="official-facts"><span class="badge orange">DATOS DEL PERFIL UFC</span><dl><div><dt>División</dt><dd>${esc(fighter.division)}</dd></div><div><dt>Récord · V-D-E</dt><dd>${esc(fighter.record)}</dd></div><div><dt>Apodo</dt><dd>${esc(fighter.nickname || "No indicado")}</dd></div><div><dt>Estilo indicado por UFC</dt><dd>${esc(fighter.officialStyle || "No indicado")}</dd></div><div><dt>Altura / alcance</dt><dd>${fighter.heightCm ?? "—"} cm / ${fighter.reachCm ?? "—"} cm</dd></div><div><dt>Lugar de nacimiento</dt><dd>${esc(fighter.birthplace || "No indicado")}</dd></div></dl>${renderFighterConsultation(fighter)}</section>${renderCombatDetails(fighter)}${renderChampionships(fighter)}${renderExtendedFighterInfo(fighter)}<a class="button small" href="${fighter.source}" target="_blank" rel="noopener noreferrer">Perfil oficial UFC ↗</a><button class="outline-button small" data-favorite="${fighter.id}">${store.state.favorites.includes(id) ? "✓ Siguiendo · Dejar de seguir" : "♡ Seguir luchador"}</button><p class="data-note">Fotografía y datos consultados en el perfil oficial de UFC. Consulta la fuente para cambios posteriores.</p></div></div>`;
  if (!$("#fighter-dialog").open) $("#fighter-dialog").showModal();
}
function updateCountdowns() {
  document.querySelectorAll("[data-official-countdown]").forEach(element => {
    const time = countdown(element.dataset.officialCountdown);
    element.innerHTML = time.ended ? "<span class='ended-label'>Evento en curso · Pendiente de actualización</span>" : `<span>${time.days}<small>DÍAS</small></span><b>:</b><span>${time.hours}<small>HORAS</small></span><b>:</b><span>${time.minutes}<small>MIN</small></span>`;
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
function download(blob, filename) {
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportCalendar(id) {
  const event = availableOfficialEvents().find(e => e.id === id);
  if (!event) return;
  download(new Blob([eventCalendar(event)], { type: "text/calendar;charset=utf-8" }), `${event.id}.ics`);
  toast("Calendario descargado");
}
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
document.querySelectorAll("[data-event-kind]").forEach(button => {
  button.addEventListener("click", () => {
    eventKindFilter = button.dataset.eventKind;
    document.querySelectorAll("[data-event-kind]").forEach(b => {
      b.classList.toggle("active", b === button);
      b.setAttribute("aria-pressed", String(b === button));
    });
    renderEvents();
  });
});
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
async function updateFighterRecords() {
  if (await refreshFighterRecords()) {
    renderAll();
    if ($("#fighter-dialog").open && $("#fighter-detail").dataset.fighterId) showProfile($("#fighter-detail").dataset.fighterId);
  }
}
updateFighterRecords();
setInterval(updateFighterRecords, 300000);
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
  }
  if ($("#fighter-dialog").open && $("#fighter-detail").dataset.fighterId) showProfile($("#fighter-detail").dataset.fighterId);
});
initializeMobileNavigation();
initializeLanguage();
