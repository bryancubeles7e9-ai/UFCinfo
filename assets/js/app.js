import {revealResultMotion, transitionCatalog, initializeFilterIndicators} from './interface-motion.js';
import {confirmationIcon, confirmCopy, resetCopyConfirmation, highlightSection} from './action-feedback.js';
import {enterEventBouts, pulseSharedBout, transitionEventList} from './event-motion.js';
import {boutShareKey, boutShareUrl, parseBoutLink, resolveBoutLink} from './bout-links.js';
import {renderHomeHero} from './home-hero.js';
import {countProfileFigures} from './profile-figures.js';
import { initializePickem } from './pickem.js';
import { renderBoutTime, scheduleExplanation } from './bout-schedule.js';
import { compactFighterRow, fighterProfile } from './fighter-presentation.js';
import { isAwaitingResults, visibleOfficialEvents } from './event-visibility.js';
import { isLegend, legendBadge, renderLegacyDetails } from "./fighter-legacy.js";
import { createCatalogPagination } from "./catalog-pagination.js";
import { initializeDataHealth } from "./data-health.js";
import { applyFighterPhotos, refreshFighterPhotos } from "./fighter-photos-feed.js";
import { matchesChampionship } from "./fighter-championships.js";
import { countryBadge, countryLabel } from "./fighter-country.js";
import { initializeRumors } from "./rumors.js";
import { initializeMobileNavigation } from "./mobile-navigation.js";
import { initializeMobileFilters } from "./mobile-filters.js";
import { getLocale, initializeLanguage } from "./i18n.js";
import { spoilersEnabled, setSpoilersEnabled, revealResult, resultHidden, hiddenResult } from "./spoilers.js";
import { initializeAccount } from "./account.js";
import { eventCalendar } from "./calendar.js";
import { followingActivity, followingFighterCard, followingBoutCard, resolvePinnedBout, boutPinKey, followedBoutFighters, followedBoutBadge } from "./following.js";
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
  renderStanceDetails,
  matchesStance,
  renderChampionships,
} from "./fighter-details.js";

import { compactMartialInfo, renderMartialDetails, martialDetails } from "./fighter-martial.js";

const store = createStore();
let account = null;
let eventFeedReady = false, pendingBoutLink = null;
let catalogView = 'compact';
try { catalogView = localStorage.getItem('ufcinfo-catalog-view') === 'cards' ? 'cards' : 'compact'; } catch {}
initializeRankings();
let eventFilter = "upcoming",
  eventKindFilter = "all",
  onlyFollowingEvents = false,
  onlyFavorites = false,
  confirmAction = null;
const pickem = initializePickem({getFavoriteIds: () => store.state.favorites});
pickem.update(eventsFeed.events);
const lab = initializeLab();
lab.updateDefault(eventsFeed.events);
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
  return `<div class="fighter-portrait ${size} ${fighter.photoCredit === "ESPN" ? "neutral-headshot" : ""}" style="--fighter-color:${isLegend(fighter) ? "#8b6cbb" : fighter.color || "#d75032"}"><div class="portrait-grid"></div>${countryBadge(fighter, getLocale())}<span class="portrait-initials" aria-hidden="true">${fighter.first[0]}${fighter.last[0]}</span><img class="fighter-photo" src="${esc(fighter.image || "assets/images/fighter-placeholder.svg")}" alt="${esc(fullName(fighter))}, fotografía de ${esc(fighter.photoCredit || "UFC")}" loading="${size === "large" ? "eager" : "lazy"}" decoding="async" width="460" height="700"><span class="portrait-label">${fighter.image ? `FOTOGRAFÍA: ${esc(fighter.photoCredit || "UFC")}` : "FOTOGRAFÍA PENDIENTE"}</span></div>`;
}
function followButton(fighter, compact = false) {
  const following = store.state.favorites.includes(fighter.id);
  return `<button class="${compact ? `favorite-button ${following ? "selected" : ""}` : "outline-button small"}" data-favorite="${esc(fighter.id)}" aria-pressed="${following}" aria-label="${following ? "Dejar de seguir a" : "Seguir a"} ${esc(fullName(fighter))}">${compact ? following ? "♥" : "♡" : following ? "✓ Siguiendo · Dejar de seguir" : "♡ Seguir luchador"}</button>`;
}
function animateFollow(id, fromDialog = false) {
  if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return;
  const scope = fromDialog ? $("#fighter-dialog") : document.querySelector(".view:not([hidden])");
  if (!scope) return;
  const buttons = [...scope.querySelectorAll("[data-favorite]")].filter(button => button.dataset.favorite === id);
  for (const button of buttons) {
    button.classList.add("follow-celebrate");
    const card = button.closest(".fighter-card, .fighter-row, .followed-fighter, .fighter-profile-hero, .profile-copy");
    if (window.matchMedia("(min-width: 701px)").matches) card?.classList.add("follow-card-celebrate");
    window.setTimeout(() => {
      button.classList.remove("follow-celebrate");
      card?.classList.remove("follow-card-celebrate");
    }, 900);
  }
}
function additionalFighterCard(fighter) {
  return `<article class="fighter-card ${isLegend(fighter) ? "fighter-legend" : ""}">${portrait(fighter)}${followButton(fighter, true)}<div class="fighter-card-body"><div class="fighter-card-meta"><span>${esc(countryLabel(fighter, getLocale()) || "País no documentado")}</span></div>${legendBadge(fighter)}${championshipBadge(fighter)}<button class="fighter-name" data-profile="${esc(fighter.id)}">${esc(fighter.first)}<strong>${esc(fighter.last)}</strong></button><p class="fighter-division">${esc(fighter.division)}</p><p class="mobile-card-record"><span>RÉCORD · V-D-E</span><strong>${esc(fighter.record || "—")}</strong></p><p>${esc(fighter.nickname || fighter.officialStyle || "Trayectoria y estadísticas oficiales")}</p><dl class="card-combat-info"><div><dt>GUARDIA</dt><dd>${esc(stanceNames[fighter.stance]?.short || "No indicada")}</dd></div>${compactMartialInfo(fighter)}<div><dt>RÉCORD · V-D-E</dt><dd>${esc(fighter.record)}</dd></div><div><dt>EQUIPO / GIMNASIO</dt><dd>${esc(fighter.info.gym || "No indicado")}</dd></div></dl><div class="fighter-card-footer"><span>EXPLORAR PERFIL</span><button class="icon-button" data-profile="${esc(fighter.id)}" aria-label="Ver ficha de ${esc(fullName(fighter))}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m9 5 7 7-7 7"/></svg></button></div></div></article>`;
}
function fighterCard(fighter) {
  const favorite = store.state.favorites.includes(fighter.id);
  return `<article class="fighter-card ${isLegend(fighter) ? "fighter-legend" : ""}">${portrait(fighter)}<button class="favorite-button ${favorite ? "selected" : ""}" data-favorite="${fighter.id}" aria-label="${favorite ? "Dejar de seguir a" : "Seguir a"}: ${esc(fullName(fighter))}" aria-pressed="${favorite}">${favorite ? "♥" : "♡"}</button><div class="fighter-card-body"><div class="fighter-card-meta"><span>${esc(fighter.country)}</span><span>${styleNames[fighter.style]}</span></div>${legendBadge(fighter)}${championshipBadge(fighter)}<button class="fighter-name" data-profile="${fighter.id}">${esc(fighter.first)}<strong>${esc(fighter.last)}</strong></button><p class="fighter-division">${esc(fighter.division)}</p><p class="mobile-card-record"><span>RÉCORD · V-D-E</span><strong>${esc(fighter.record || "—")}</strong></p>${compactCombatInfo(fighter)}<p>${esc(fighter.tagline)}</p><div class="fighter-card-footer"><span>EXPLORAR PERFIL</span><button class="icon-button" data-profile="${fighter.id}" aria-label="Ver ficha de ${esc(fullName(fighter))}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m9 5 7 7-7 7"/></svg></button></div></div></article>`;
}
function isUpcomingEvent(event) {
  return event.type === "official" && (event.status || "completed") !== "completed";
}
function availableOfficialEvents() {
  return visibleOfficialEvents(eventsFeed.events);
}
function eventKindLabel(event) {
  return event.eventKind === "special" ? "UFC EVENTO ESPECIAL" : event.eventKind === "fight-night" ? "UFC FIGHT NIGHT" : "UFC NUMERADO";
}
function eventStatus(event) {
  if (isAwaitingResults(event)) return "RESULTADOS PENDIENTES";
  return { announced: "ANUNCIADO", scheduled: "PROGRAMADO", live: "EN CURSO", completed: "FINALIZADO" }[event.status || "completed"];
}
function eventPoster(event, featured = false) {
  return `<figure class="event-poster">${event.poster ? `<img class="poster-backdrop" src="${esc(event.poster)}" alt="" aria-hidden="true" loading="${featured ? "eager" : "lazy"}" decoding="async">` : ""}<img class="event-poster-image" src="${esc(event.poster || "assets/images/event-poster-pending.svg")}" alt="${esc(event.poster ? event.posterAlt || `Imagen promocional oficial de ${event.title}` : `Póster pendiente de publicación: ${event.title}`)}" width="768" height="512" loading="${featured ? "eager" : "lazy"}" decoding="async"><figcaption>${event.poster ? "IMAGEN PROMOCIONAL: UFC" : "PÓSTER OFICIAL PENDIENTE"}</figcaption></figure>`;
}
function feedNote() {
  const date = new Date(eventsFeed.synchronizedAt).toLocaleString(getLocale(), { dateStyle: "medium", timeStyle: "short" });
  return `Fuente: ${eventsFeed.source} · Última ${eventsFeed.automatic ? "sincronización" : "consulta"}: ${date} · ${eventsFeed.unavailable ? "Últimos datos disponibles; no se pudo comprobar una actualización." : eventsFeed.automatic ? "Actualización programada a las 08:00 y 14:00 (hora peninsular)." : "Copia inicial; pendiente de activar la sincronización."}`;
}
function renderEventFeedStatus() {
  $("#event-feed-status").textContent = `${feedNote()} Fechas y horas en tu zona local. Eventos numerados, Fight Night y especiales: próximos anunciados y finalizados de este año. Cartelera principal y preliminares disponibles.`;
  $("#event-feed-source").href = eventsFeed.sourceUrl;
  $("#event-feed-source").textContent = `Fuente: ${eventsFeed.source} ›`;
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
  return `<article class="event-card official-event-card ${featured ? "featured" : ""}" data-event-card="${esc(event.id)}"><div class="event-info"><span class="badge orange event-type-badge">${eventKindLabel(event)} · ${eventStatus(event)}</span><p class="eyebrow">CARTELERA · ${event.bouts.length ? `${event.bouts.length} COMBATES${upcoming ? " ANUNCIADOS" : ""}` : "PENDIENTE DE ANUNCIO"}</p><h3 translate="no">${esc(event.title)}</h3><p>${esc(event.subtitle)}</p><div class="event-location" translate="no">${esc(event.location)}</div><div class="event-date">${formatDate(event.date)} · ${formatTime(event.date)} <small>hora local · inicio de la principal</small></div>${upcoming ? `<div class="countdown" data-official-countdown="${esc(event.date)}"></div>` : ""}<button class="button small" data-official-event="${esc(event.id)}">${upcoming ? "Ver combates anunciados" : "Ver cartelera y resultados"} ›</button><p><a class="text-link" href="${esc(event.source)}" target="_blank" rel="noopener noreferrer">Evento oficial UFC ›</a></p>${upcoming ? '<p class="data-note">Cartelera anunciada; los combates y horarios pueden cambiar.</p>' : ""}</div>${eventPoster(event, featured)}</article>`;
}
function showOfficialEvent(id, focusBoutKey = undefined) {
  const event = eventsFeed.events.find(e => e.type === 'official' && e.id === id && !['cancelled', 'postponed'].includes(e.status));
  if (!event) return;
  const upcoming = isUpcomingEvent(event);
  const sections = [['main', 'Principal'], ['prelims', 'Preliminares'], ['early-prelims', 'Previas']]
    .filter(([section]) => event.bouts.some(b => (b.section || 'main') === section));
  const sectionNav = sections.length ? `<nav class="event-section-nav" aria-label="Bloques de la cartelera">${sections.map(([section, label]) => `<button type="button" data-event-section="${section}" aria-controls="event-section-${section}-${event.bouts.findIndex(b => (b.section || 'main') === section)}">${label}</button>`).join('')}</nav>` : '';
  const detail = $("#event-detail");
  const entering = !$("#event-dialog").open || detail.dataset.officialEventId !== id;
  const sharedKey = focusBoutKey !== undefined ? focusBoutKey || '' : (detail.dataset.officialEventId === id ? detail.dataset.sharedBoutKey || '' : '');
  const missingSharedBout = focusBoutKey === null || (focusBoutKey === undefined && detail.dataset.officialEventId === id && detail.dataset.sharedBoutMissing === 'true');
  detail.dataset.sharedBoutMissing = String(missingSharedBout);
  detail.dataset.sharedBoutKey = sharedKey;
  detail.dataset.officialEventId = id;
  detail.innerHTML = `<p class="eyebrow">${eventKindLabel(event)} · ${eventStatus(event)}</p><h2 class="event-dialog-title" translate="no">${esc(event.title)} · ${esc(event.subtitle)}</h2><p class="muted"><span translate="no">${esc(event.location)}</span> · ${formatDate(event.date)} · ${formatTime(event.date)} (hora local)</p>${missingSharedBout ? '<p class="bout-share-notice" role="status">La pelea compartida ya no está en esta cartelera.</p>' : ''}<p class="data-note">${upcoming ? "Combates anunciados; pueden cambiar antes del evento." : "Cartelera principal y preliminares disponibles."} ${esc(feedNote())}</p>${upcoming ? `<p class="data-note bout-schedule-note">${scheduleExplanation}</p>` : ""}${sectionNav}<div class="bout-list">${event.bouts.length ? event.bouts.map((b,i) => `${i === 0 || (b.section || 'main') !== (event.bouts[i-1].section || 'main') ? `<h3 class="bout-section-heading" id="event-section-${esc(b.section || 'main')}-${i}" tabindex="-1">${({'main':'Cartelera principal','prelims':'Preliminares','early-prelims':'Preliminares previas'})[b.section || 'main']}</h3>` : ''}<article class="bout${followedBoutFighters(b, store.state.favorites).length ? ' is-followed' : ''}${boutShareKey(b) === sharedKey ? ' is-shared' : ''}" id="event-bout-${i}" tabindex="-1">${followedBoutBadge(b, store.state.favorites)}<div class="bout-heading"><span>${(b.section || "main") === "main" && i === 0 ? "COMBATE ESTELAR" : (b.section || "main") === "main" && i === 1 ? "COMBATE COESTELAR" : `COMBATE ${i+1}`}</span><span>${esc(b.division)}</span></div><div class="official-bout-names">${fighterNameLink(b.red, "bout-fighter-name")}<span>VS</span>${fighterNameLink(b.blue, "bout-fighter-name")}</div>${renderBoutTime(event, b)}<p class="official-result" data-result-key="${esc(boutPinKey(event,b))}">${isAwaitingResults(event) ? "Resultados pendientes de actualización" : upcoming ? "Combate anunciado · Sin resultado" : officialResult(b, boutPinKey(event, b))}</p><div class="bout-share-actions"><span class="bout-share-status" role="status" aria-live="polite"></span><button type="button" class="text-link bout-share-button" data-share-bout="${esc(boutShareKey(b))}" aria-label="Compartir combate: ${esc(b.red)} vs ${esc(b.blue)}"><svg class="share-link-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="m10 13 4-4M8 16l-2 2a4.2 4.2 0 0 1-6-6l5-5a4.2 4.2 0 0 1 6 0M16 8l2-2a4.2 4.2 0 0 1 6 6l-5 5a4.2 4.2 0 0 1-6 0" transform="translate(1 0) scale(.9)"/></svg>${confirmationIcon()}<span>Compartir combate</span></button></div><label class="bout-share-fallback" hidden><span>Enlace del combate</span><input type="text" readonly value="${esc(boutShareUrl(event,b))}"></label></article>`).join("") : empty("La cartelera principal todavía no se ha anunciado.")}</div><a class="button small" href="${esc(event.source)}" target="_blank" rel="noopener noreferrer">Cartelera oficial UFC ›</a>`;
  if (!$("#event-dialog").open) $("#event-dialog").showModal();
  if (entering) enterEventBouts(detail, Boolean(focusBoutKey));
  if (focusBoutKey) requestAnimationFrame(() => {
    if (!$("#event-dialog").open || detail.dataset.officialEventId !== id) return;
    const target = detail.querySelector('.bout.is-shared');
    target?.focus({preventScroll:true});
    target?.scrollIntoView({block:'start', behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
    pulseSharedBout(target, $("#event-dialog"));
  });
}
function openPendingBoutLink() {
  if (!pendingBoutLink || !eventFeedReady) return;
  const link = pendingBoutLink;
  pendingBoutLink = null;
  const {event, bout} = resolveBoutLink(eventsFeed.events, link);
  if (!event) { if ($("#event-dialog").open) $("#event-dialog").close(); toast('La velada compartida no está disponible en los datos actuales.'); return; }
  showOfficialEvent(event.id, bout ? boutShareKey(bout) : null);
}
async function copyBoutLink(button) {
  resetCopyConfirmation(button);
  const id = $("#event-detail").dataset.officialEventId;
  const {event, bout} = resolveBoutLink(eventsFeed.events, {eventId:id, boutKey:button.dataset.shareBout});
  if (!bout) { toast('La pelea compartida ya no está en esta cartelera.'); return; }
  const url = boutShareUrl(event,bout);
  const status = button.closest('.bout').querySelector('.bout-share-status');
  try {
    await navigator.clipboard.writeText(url);
    status.textContent = 'Enlace del combate copiado';
    confirmCopy(button);
  } catch {
    const field = button.closest('.bout').querySelector('.bout-share-fallback');
    if (!field.isConnected) { toast('No se ha podido copiar el enlace. Vuelve a intentarlo.'); return; }
    field.hidden = false;
    const input = field.querySelector('input');
    input.value = url;
    input.focus({preventScroll:true}); input.select();
    status.textContent = 'Copia el enlace que aparece debajo del combate.';
  }
}
function renderOverview() {
  $("#fighter-count").textContent = String(directoryFighters.length).padStart(2, "0");
  $("#event-count").textContent = String(availableOfficialEvents().length).padStart(
    2,
    "0",
  );
  $("#pick-count").textContent = String(store.state.favorites.length).padStart(2, "0");
  const official = availableOfficialEvents();
  const future = official.filter(e => isUpcomingEvent(e) && !isAwaitingResults(e)).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
  const later = future.slice(1,3);
  const latestCompleted = official.filter(e=>!isUpcomingEvent(e)).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date))[0];
  const highlights = later.length ? later : latestCompleted ? [latestCompleted] : future.slice(0,1);
  $("#featured-event-label").textContent = later.length ? "PRÓXIMAS VELADAS" : latestCompleted ? "ÚLTIMO EVENTO UFC" : "PRÓXIMO EVENTO UFC";
  $("#featured-event-title").textContent = later.length ? "Lo que viene." : latestCompleted ? "Así terminó la noche." : "La próxima noche de combate.";
  $("#featured-event").classList.toggle('home-upcoming-grid',highlights.length>1);
  $("#featured-event").innerHTML = highlights.length
    ? highlights.map(event=>officialEventCard(event,highlights.length===1)).join('')
    : empty("No hay eventos UFC disponibles.");
  $("#featured-fighters").innerHTML = fighters
    .slice(0, 3)
    .map(fighterCard)
    .join("");
}
const catalogPagination = createCatalogPagination(24);
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
      matchesStance(f, stance) &&
      matchesChampionship(f, belts) &&
      (!onlyFavorites || store.state.favorites.includes(f.id)),
  );
  if (style === "all") {
    list.push(...additionalFighters.filter((f) =>
      normalizeFighterName(`${fullName(f)} ${f.aliases.join(" ")} ${f.nickname} ${f.division} ${f.birthplace || ""} ${f.officialStyle || ""} ${martialDetails(f).label} ${f.info.gym || ""} ${stanceNames[f.stance]?.short || ""}`).includes(normalizeFighterName(query)) &&
      (division === "all" || f.division === division) && matchesChampionship(f, belts) && matchesStance(f, stance) && (!onlyFavorites || store.state.favorites.includes(f.id))));
  }
  if ($("#fighter-sort").value === "name")
    list.sort((a, b) => fullName(a).localeCompare(fullName(b), "es"));
  if ($("#fighter-sort").value === "power")
    list.sort((a, b) => (b.stats?.[2] ?? -1) - (a.stats?.[2] ?? -1));
  const page = catalogPagination.select(list, [query, style, division, stance, belts, $("#fighter-sort").value, onlyFavorites]);
  const language = getLocale().slice(0, 2);
  const words = {es: ['Mostrando', 'de', 'luchadores', 'Cargar más'], en: ['Showing', 'of', 'fighters', 'Load more'], ca: ['Mostrant', 'de', 'lluitadors', 'Carrega’n més']}[language] || ['Mostrando', 'de', 'luchadores', 'Cargar más'];
  const count = `${words[0]} ${page.shown} ${words[1]} ${page.total} ${words[2]}`;
  $("#fighter-results-count").textContent = count;
  $("#fighter-load-more").hidden = !page.hasMore;
  $("#fighter-load-more").textContent = words[3];
  $("#fighter-load-more").setAttribute('aria-label', `${words[3]} · ${count}`);
  document.querySelectorAll('[data-catalog-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.catalogView === catalogView)));
  document.querySelectorAll('[data-fighter-scope]').forEach(button => {
    const active = onlyFavorites ? 'following' : ['current', 'legend'].includes(belts) ? belts : belts === 'all' ? 'all' : '';
    button.setAttribute('aria-pressed', String(button.dataset.fighterScope === active));
  });
  $("#fighter-list").className = catalogView === 'compact' ? 'fighter-directory-list' : 'fighter-grid';
  $("#fighter-list").innerHTML = list.length
    ? page.items.map((f) => catalogView === 'compact' ? compactFighterRow(f, followButton(f, true)) : f.supplemental ? additionalFighterCard(f) : fighterCard(f)).join("")
    : empty("Ningún luchador coincide. Prueba otros filtros.");
}
function renderHomeBanner() {
  const upcoming = availableOfficialEvents().filter(e => isUpcomingEvent(e) && !isAwaitingResults(e))
    .sort((a, b) => (a.status === "live" ? -1 : 0) - (b.status === "live" ? -1 : 0) || Date.parse(a.date) - Date.parse(b.date));
  const event = upcoming[0];
  const banner = $("#home-event-banner");
  banner.innerHTML = renderHomeHero(event, {note:feedNote()});
}
function renderEvents({animate = false} = {}) {
  renderHomeBanner();
  renderEventFeedStatus();
  const query = $("#event-search").value.toLocaleLowerCase("es").trim();
  $("#event-following-only").setAttribute("aria-pressed", String(onlyFollowingEvents));
  const list = availableOfficialEvents()
    .filter(e => !onlyFollowingEvents || e.bouts.some(b => followedBoutFighters(b, store.state.favorites).length))
    .filter(e => eventKindFilter === "all" || (e.type === "official" && (e.eventKind || "numbered") === eventKindFilter))
    .filter(
      (e) =>
        (eventFilter === "all" || (eventFilter === "upcoming" && isUpcomingEvent(e)) || (eventFilter === "completed" && (!isUpcomingEvent(e) || isAwaitingResults(e)))) &&
        `${e.title} ${e.subtitle || ""} ${e.location} ${e.type === "official" ? e.bouts.map(b => `${b.red} ${b.blue}`).join(" ") : ""}`.toLocaleLowerCase("es").includes(query),
    )
    .sort((a, b) => {
      const au = isUpcomingEvent(a), bu = isUpcomingEvent(b);
      if (au !== bu) return au ? -1 : 1;
      return au ? Date.parse(a.date) - Date.parse(b.date) : Date.parse(b.date) - Date.parse(a.date);
    });
  transitionEventList($("#event-list"), () => {
    $("#event-list").innerHTML = list.length
    ? list.map((e) => officialEventCard(e)).join("")
    : onlyFollowingEvents && !store.state.favorites.length
      ? empty("Tu esquina está vacía. Añade un luchador para seguir sus próximos combates.", '<a class="outline-button small" href="#luchadores">Explorar luchadores</a>')
      : empty(onlyFollowingEvents ? "Ninguna velada coincide con tus luchadores seguidos y los filtros actuales." : "No hay carteleras con estos filtros. Prueba otra selección.");
    updateCountdowns();
  }, animate);
}
function empty(text, action = '') {
  return `<div class="empty-state"><span>◇</span><p>${esc(text)}</p>${action}</div>`;
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
  $("#following-feed-status").textContent = `${feedNote()} Carteleras de eventos numerados, Fight Night y especiales disponibles. Fechas y horas en tu zona local.`;
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
  if ($("#fighter-dialog").open) showProfile($("#fighter-detail").dataset.fighterId);
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
  pickem.render();
  const officialId = $("#event-detail").dataset.officialEventId;
  if ($("#event-dialog").open && officialId) showOfficialEvent(officialId);
}
function showProfile(id, {animate = false} = {}) {
  const fighter = directoryFighterById(id);
  if (!fighter) return;
  const detail = $("#fighter-detail");
  const active = detail.dataset.fighterId === id ? detail.dataset.section || 'summary' : 'summary';
  detail.dataset.fighterId = id;
  detail.dataset.section = active;
  detail.innerHTML = fighterProfile(fighter, {follow: followButton(fighter), events: eventsFeed.events, active});
  if (!$("#fighter-dialog").open) $("#fighter-dialog").showModal();
  if (animate) countProfileFigures(detail); // Data refreshes re-render silently.
}
function updateCountdowns() {
  document.querySelectorAll("[data-official-countdown]").forEach(element => {
    const time = countdown(element.dataset.officialCountdown);
    element.innerHTML = time.ended ? "<span class='ended-label'>Evento en curso · Pendiente de actualización</span>" : `<span>${time.days}<small>DÍAS</small></span><b>:</b><span>${time.hours}<small>HORAS</small></span><b>:</b><span>${time.minutes}<small>MIN</small></span>`;
  });
}
function navigate() {
  let view = location.hash.slice(1).split('?')[0] || "inicio";
  if (
    ![
      "inicio",
      "eventos",
      "luchadores",
      "rankings",
      "laboratorio",
      "pickem",
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
  document.title = view === "inicio" ? "UFCinfo — Carteleras UFC, luchadores y rankings MMA" : `${{ eventos: "Carteleras", luchadores: "Luchadores", rankings: "Rankings", laboratorio: "Fight Lab", pickem: "Pick’em", guardados: "Mi esquina", rumores: "Rumores" }[view]} — UFCinfo`;
  window.scrollTo({ top: 0, behavior: "instant" });
  if (view === 'laboratorio') lab.animate();
  pendingBoutLink = parseBoutLink(location.hash);
  openPendingBoutLink();
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
  const shareButton = event.target.closest('#event-dialog [data-share-bout]');
  if (shareButton) { copyBoutLink(shareButton); return; }
  const sectionButton = event.target.closest("#event-dialog [data-event-section]");
  if (sectionButton) {
    const target = document.getElementById(sectionButton.getAttribute("aria-controls"));
    if (target && $("#event-dialog").contains(target)) {
      target.focus({preventScroll: true});
      target.scrollIntoView({block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"});
      highlightSection(target, $("#event-dialog"));
    }
    return;
  }
  const reveal = event.target.closest("[data-reveal-result]");
  if (reveal) {
    const key = reveal.dataset.revealResult;
    const scope = reveal.closest('dialog') || reveal.closest('[data-view]') || document;
    const matches = () => [...scope.querySelectorAll('[data-result-key]')].filter(node => node.dataset.resultKey === key);
    const index = Math.max(0, matches().indexOf(reveal.closest('[data-result-key]')));
    revealResult(key);
    refreshSpoilerViews();
    revealResultMotion(matches()[index]);
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
    const fromDialog = Boolean(favorite.closest("#fighter-dialog"));
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
    if (index < 0) animateFollow(id, fromDialog);
    toast(index < 0 ? "Siguiendo al luchador" : "Has dejado de seguir al luchador");
    return;
  }
  const profile = event.target.closest("[data-profile]");
  if (profile) {
    showProfile(profile.dataset.profile, {animate: true});
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
document.querySelectorAll('[data-catalog-view]').forEach(button => button.addEventListener('click', () => {
  if (catalogView === button.dataset.catalogView) return;
  catalogView = button.dataset.catalogView;
  try { localStorage.setItem('ufcinfo-catalog-view', catalogView); } catch {}
  transitionCatalog($("#fighter-list"), renderFighters);
}));
document.querySelectorAll('[data-fighter-scope]').forEach(button => button.addEventListener('click', () => {
  const scope = button.dataset.fighterScope;
  onlyFavorites = scope === 'following';
  $("#favorites-only").setAttribute('aria-pressed', String(onlyFavorites));
  $("#championship-filter").value = ['current', 'legend'].includes(scope) ? scope : 'all';
  $("#championship-filter").dispatchEvent(new Event('change', {bubbles:true}));
}));
$("#fighter-detail").addEventListener('click', event => {
  const button = event.target.closest('[data-profile-section]');
  if (!button) return;
  const section = button.dataset.profileSection;
  $("#fighter-detail").dataset.section = section;
  document.querySelectorAll('[data-profile-section]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  for (const name of ['summary', 'statistics', 'history']) $("#fighter-panel-" + name).hidden = name !== section;
  if (section === 'statistics') countProfileFigures($("#fighter-panel-statistics"));
});
$("#fighter-load-more").addEventListener("click", () => {
  const previousCount = $("#fighter-list").children.length;
  catalogPagination.more();
  renderFighters();
  // Move keyboard focus into the newly revealed results, including the final batch.
  $("#fighter-list").children[previousCount]?.querySelector('[data-profile]')?.focus({preventScroll:true});
});
$("#follow-selected").addEventListener("click", () => {
  const id = $("#follow-fighter").value;
  if (!directoryFighterById(id) || store.state.favorites.includes(id)) return;
  store.state.favorites.push(id);
  persist();
  renderAll();
  animateFollow(id);
  toast("Luchador añadido a tu esquina");
});
$("#favorites-only").addEventListener("click", () => {
  onlyFavorites = !onlyFavorites;
  $("#favorites-only").setAttribute("aria-pressed", String(onlyFavorites));
  renderFighters();
});
$("#event-search").addEventListener("input", () => renderEvents({animate:true}));
document.querySelectorAll("[data-event-kind]").forEach(button => {
  button.addEventListener("click", () => {
    eventKindFilter = button.dataset.eventKind;
    document.querySelectorAll("[data-event-kind]").forEach(b => {
      b.classList.toggle("active", b === button);
      b.setAttribute("aria-pressed", String(b === button));
    });
    renderEvents({animate:true});
  });
});
document.querySelectorAll("[data-event-filter]").forEach((button) =>
  button.addEventListener("click", () => {
    eventFilter = button.dataset.eventFilter;
    document.querySelectorAll("[data-event-filter]").forEach((b) => {
      b.classList.toggle("active", b === button);
      b.setAttribute("aria-pressed", String(b === button));
    });
    renderEvents({animate:true});
  }),
);
$("#event-following-only").addEventListener("click", () => {
  onlyFollowingEvents = !onlyFollowingEvents;
  renderEvents({animate:true});
});
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
document.addEventListener("octagon:rankings-updated", () => {
  applyFighterPhotos();
  renderAll();
  if ($("#fighter-dialog").open && $("#fighter-detail").dataset.fighterId) showProfile($("#fighter-detail").dataset.fighterId);
});
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
    if (event.target.matches?.(".poster-backdrop")) {
      event.target.hidden = true;
      return;
    }
    if (event.target.matches?.(".event-poster-image")) {
      if (event.target.dataset.fallback) return;
      event.target.dataset.fallback = "true";
      const figure = event.target.closest("figure");
      const backdrop = figure?.querySelector(".poster-backdrop");
      if (backdrop) backdrop.hidden = true;
      event.target.src = "assets/images/event-poster-pending.svg";
      event.target.alt = "Imagen del póster no disponible";
      event.target.closest("figure").querySelector("figcaption").textContent = "PÓSTER NO DISPONIBLE";
      return;
    }
    if (event.target.matches?.('.fighter-row-identity img, .fighter-profile-photo img, .hero-fighter-photo')) {
      if (event.target.dataset.fallback) return;
      event.target.dataset.fallback = 'true';
      event.target.src = 'assets/images/fighter-placeholder.svg';
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
  eventFeedReady = true;
  lab.updateDefault(eventsFeed.events);
  pickem.update(eventsFeed.events);
  if ($("#fighter-dialog").open) showProfile($("#fighter-detail").dataset.fighterId);
  renderOverview();
  renderEvents();
  renderSaved();
  const officialId = $("#event-detail").dataset.officialEventId;
  if ($("#event-dialog").open && officialId) showOfficialEvent(officialId);
  openPendingBoutLink();
}
updateEventFeed();
async function updateFighterRecords() {
  const results = await Promise.all([refreshFighterRecords(), refreshFighterPhotos()]);
  if (results.some(Boolean)) {
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
initializeMobileFilters();
initializeLanguage();
initializeFilterIndicators();

initializeDataHealth();
