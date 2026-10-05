import { eventsFeed, refreshEvents } from "./events-feed.js";
import {
  fighters,
  fighterById,
  fullName,
  styleNames,
  attributes,
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
import { initializeRankings } from "./rankings.js";
import {
  stanceNames,
  hasCurrentBelt,
  championshipBadge,
  compactCombatInfo,
  renderCombatDetails,
  renderChampionships,
} from "./fighter-details.js";

const store = createStore();
initializeRankings();
let eventFilter = "official",
  onlyFavorites = false,
  confirmAction = null;
const lab = initializeLab((matchup) => {
  if (store.state.matchups.length >= 200) {
    toast("Exporta o elimina algún análisis antes de guardar más.");
    return;
  }
  store.state.matchups.unshift(matchup);
  persist();
  renderSaved();
  toast("Análisis guardado en tu esquina");
});
function persist() {
  const saved = store.save();
  $("#storage-status").textContent = saved
    ? "● Guardado local"
    : "○ Sin guardado: exporta tus datos";
  if (!saved)
    toast("El navegador no permite guardar. Puedes exportar tus datos.");
}
function portrait(fighter, size = "") {
  return `<div class="fighter-portrait ${size}" style="--fighter-color:${fighter.color}"><div class="portrait-grid"></div><span class="portrait-number">${esc(fighter.code)}</span><span class="portrait-initials" aria-hidden="true">${fighter.first[0]}${fighter.last[0]}</span><img class="fighter-photo" src="${esc(fighter.image)}" alt="${esc(fullName(fighter))}, fotografía de su perfil oficial de UFC" loading="${size === "large" ? "eager" : "lazy"}" decoding="async" width="460" height="700"><span class="portrait-label">FOTOGRAFÍA: UFC · PERFIL OFICIAL</span></div>`;
}
function fighterCard(fighter) {
  const favorite = store.state.favorites.includes(fighter.id);
  return `<article class="fighter-card">${portrait(fighter)}<button class="favorite-button ${favorite ? "selected" : ""}" data-favorite="${fighter.id}" aria-label="${favorite ? "Quitar de" : "Añadir a"} favoritos: ${esc(fullName(fighter))}" aria-pressed="${favorite}">${favorite ? "♥" : "♡"}</button><div class="fighter-card-body"><div class="fighter-card-meta"><span>${esc(fighter.country)}</span><span>${styleNames[fighter.style]}</span></div>${championshipBadge(fighter)}<button class="fighter-name" data-profile="${fighter.id}">${esc(fighter.first)}<strong>${esc(fighter.last)}</strong></button><p class="fighter-division">${esc(fighter.division)}</p>${compactCombatInfo(fighter)}<p>${esc(fighter.tagline)}</p><div class="fighter-card-footer"><span>EXPLORAR PERFIL</span><button class="icon-button" data-profile="${fighter.id}" aria-label="Ver ficha de ${esc(fullName(fighter))}">↗</button></div></div></article>`;
}
function pastOfficialEvents() {
  const now = new Date();
  return eventsFeed.events.filter(e => new Date(e.date).getUTCFullYear() === now.getFullYear() && Date.parse(e.date) < now.getTime());
}
function feedNote() {
  const date = new Date(eventsFeed.synchronizedAt).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" });
  return `Fuente: ${eventsFeed.source} · Última ${eventsFeed.automatic ? "sincronización" : "consulta"}: ${date} · ${eventsFeed.unavailable ? "Últimos datos disponibles; no se pudo comprobar una actualización." : eventsFeed.automatic ? "Actualización programada cada 6 horas." : "Copia inicial; pendiente de activar la sincronización."}`;
}
function renderEventFeedStatus() {
  $("#event-feed-status").textContent = `${feedNote()} Fechas y horas en tu zona local. Solo cartelera principal de eventos numerados finalizados.`;
  $("#event-feed-source").href = eventsFeed.sourceUrl;
  $("#event-feed-source").textContent = `Fuente: ${eventsFeed.source} ↗`;
}
function officialResult(bout) {
  const details = [bout.method, bout.round ? `R${bout.round}` : "", bout.time].filter(Boolean).map(esc).join(" · ");
  if (bout.winner) return `Ganador: <strong>${esc(bout.winner)}</strong>${details ? ` · ${details}` : ""}`;
  if (bout.outcome) return `${esc(bout.outcome)}${details ? ` · ${details}` : ""}`;
  return "Resultado aún no disponible. Consulta el evento oficial.";
}
function officialEventCard(event, featured = false) {
  const bout = event.bouts[0];
  return `<article class="event-card ${featured ? "featured" : ""}"><div class="event-info"><span class="badge orange">UFC NUMERADO · FINALIZADO</span><p class="eyebrow">CARTELERA PRINCIPAL · ${event.bouts.length} COMBATES</p><h3>${esc(event.title)}</h3><p>${esc(event.subtitle)}</p><div class="event-location">${esc(event.location)}</div><div class="event-date">${formatDate(event.date)} · ${formatTime(event.date)} <small>hora local</small></div><button class="button small" data-official-event="${esc(event.id)}">Ver cartelera y resultados ↗</button><p><a class="text-link" href="${esc(event.source)}" target="_blank" rel="noopener noreferrer">Evento oficial UFC ↗</a></p></div><div class="event-matchup"><span class="event-rounds">COMBATE ESTELAR</span><div class="matchup-name"><strong>${esc(bout.red)}</strong></div><div class="vs-rule"><span>VS</span></div><div class="matchup-name blue-name"><strong>${esc(bout.blue)}</strong></div><p>${bout.winner ? `GANADOR: ${esc(bout.winner)}` : bout.outcome ? esc(bout.outcome) : "RESULTADO PENDIENTE DE ACTUALIZACIÓN"}</p></div></article>`;
}
function showOfficialEvent(id) {
  const event = pastOfficialEvents().find(e => e.id === id);
  if (!event) return;
  $("#event-detail").dataset.officialEventId = id;
  $("#event-detail").innerHTML = `<p class="eyebrow">UFC NUMERADO · FINALIZADO</p><h2 class="event-dialog-title">${esc(event.title)} · ${esc(event.subtitle)}</h2><p class="muted">${esc(event.location)} · ${formatDate(event.date)} · ${formatTime(event.date)} (hora local)</p><p class="data-note">Todos los combates de la cartelera principal. ${esc(feedNote())}</p><div class="bout-list">${event.bouts.map((b,i) => `<article class="bout"><div class="bout-heading"><span>${i === 0 ? "COMBATE ESTELAR" : i === 1 ? "COMBATE COESTELAR" : `COMBATE ${i+1}`}</span><span>${esc(b.division)}</span></div><div class="official-bout-names"><strong>${esc(b.red)}</strong><span>VS</span><strong>${esc(b.blue)}</strong></div><p class="official-result">${officialResult(b)}</p></article>`).join("")}</div><a class="button small" href="${esc(event.source)}" target="_blank" rel="noopener noreferrer">Cartelera y resultados oficiales UFC ↗</a>`;
  if (!$("#event-dialog").open) $("#event-dialog").showModal();
}
function eventCard(event, featured = false) {
  if (event.type === "official") return officialEventCard(event, featured);
  const red = fighterById(event.bouts[0][0]),
    blue = fighterById(event.bouts[0][1]);
  return `<article class="event-card ${featured ? "featured" : ""}"><div class="event-info"><div class="event-card-top"><span class="badge ${event.type === "demo" ? "" : "orange"}">${event.type === "demo" ? "CARTELERA DEMO" : "TU CARTELERA"}</span><button class="event-bookmark" data-save-event="${esc(event.id)}" aria-label="Exportar calendario de ${esc(event.title)}" title="Descargar calendario">↓</button></div><p class="eyebrow">${esc(event.subtitle || "TU NOCHE. TUS COMBATES.")}</p><h3>${esc(event.title)}</h3><div class="event-location">${esc(event.location)}</div><div class="event-date"><span>◷</span> ${formatDate(event.date)} · ${formatTime(event.date)} <small>hora local</small></div><div class="countdown" data-countdown="${esc(event.date)}"></div><button class="button small" data-event="${esc(event.id)}">Ver cartelera y pronosticar ↗</button>${event.type === "custom" ? `<button class="text-link delete-event" data-delete-event="${esc(event.id)}">Eliminar evento</button>` : ""}</div><div class="event-matchup"><span class="event-rounds">MAIN EVENT · ${event.rounds} ROUNDS</span><div class="matchup-name"><span>${esc(red.first)}</span><strong>${esc(red.last)}</strong></div><div class="vs-rule"><span>VS</span></div><div class="matchup-name blue-name"><span>${esc(blue.first)}</span><strong>${esc(blue.last)}</strong></div><p>ENFRENTAMIENTO HIPOTÉTICO · SIN RESULTADOS OFICIALES</p></div></article>`;
}
function renderOverview() {
  $("#fighter-count").textContent = String(fighters.length).padStart(2, "0");
  $("#event-count").textContent = String(pastOfficialEvents().length).padStart(
    2,
    "0",
  );
  $("#pick-count").textContent = String(
    Object.keys(store.state.picks).length,
  ).padStart(2, "0");
  const sorted = [...store.state.events].sort(
    (a, b) => Date.parse(a.date) - Date.parse(b.date),
  );
  const upcoming =
    sorted.find((e) => Date.parse(e.date) > Date.now()) || sorted[0];
  const latestOfficial = pastOfficialEvents().sort((a,b) => Date.parse(b.date)-Date.parse(a.date))[0];
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
  if ($("#fighter-sort").value === "name")
    list.sort((a, b) => fullName(a).localeCompare(fullName(b), "es"));
  if ($("#fighter-sort").value === "power")
    list.sort((a, b) => b.stats[2] - a.stats[2]);
  $("#fighter-list").innerHTML = list.length
    ? list.map(fighterCard).join("")
    : empty("Ningún luchador coincide. Prueba otros filtros.");
}
function renderEvents() {
  renderEventFeedStatus();
  const query = $("#event-search").value.toLocaleLowerCase("es").trim();
  const list = [...pastOfficialEvents(), ...store.state.events]
    .filter(
      (e) =>
        (eventFilter === "all" || e.type === eventFilter) &&
        `${e.title} ${e.subtitle || ""} ${e.location} ${e.type === "official" ? e.bouts.map(b => `${b.red} ${b.blue}`).join(" ") : ""}`.toLocaleLowerCase("es").includes(query),
    )
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  $("#event-list").innerHTML = list.length
    ? list.map((e) => eventCard(e)).join("")
    : empty("No hay carteleras con estos filtros. Puedes crear la tuya.");
  updateCountdowns();
}
function empty(text) {
  return `<div class="empty-state"><span>◇</span><p>${esc(text)}</p></div>`;
}
function renderSaved() {
  const saved = fighters.filter((f) => store.state.favorites.includes(f.id));
  $("#saved-count").textContent = store.state.favorites.length;
  $("#saved-fighters").innerHTML = saved.length
    ? saved.map(fighterCard).join("")
    : empty("Todavía no tienes favoritos. Pulsa el corazón de una ficha.");
  const picks = Object.entries(store.state.picks);
  $("#predictions-count").textContent = `${picks.length} PICKS`;
  $("#saved-picks").innerHTML = picks.length
    ? picks
        .map(([key, winner]) => {
          const [eventId, index] = key.split(":"),
            event = store.state.events.find((e) => e.id === eventId);
          if (!event) return "";
          const bout = event.bouts[Number(index)];
          return `<article class="saved-item"><div><small>${esc(event.title)}</small><h3>${esc(fighterById(bout[0]).last)} vs ${esc(fighterById(bout[1]).last)}</h3><p>Tu elección: <strong>${esc(fullName(fighterById(winner)))}</strong></p></div><button class="icon-button" data-remove-pick="${esc(key)}" aria-label="Eliminar pronóstico">×</button></article>`;
        })
        .join("")
    : empty("Elige un ganador en una cartelera para guardar tu pronóstico.");
  $("#saved-matchups").innerHTML = store.state.matchups.length
    ? store.state.matchups
        .map(
          (m) =>
            `<article class="saved-item"><div><small>${formatDate(m.date)}</small><h3>${esc(fighterById(m.red).last)} vs ${esc(fighterById(m.blue).last)}</h3><p class="saved-note">${esc(m.note || "Análisis de estilos guardado.")}</p><button class="text-link" data-load-matchup="${esc(m.id)}">Abrir análisis ↗</button></div><button class="icon-button" data-remove-matchup="${esc(m.id)}" aria-label="Eliminar análisis">×</button></article>`,
        )
        .join("")
    : empty("Tus comparaciones guardadas aparecerán aquí.");
}
function renderAll() {
  document.body.classList.toggle("light", store.state.theme === "light");
  renderOverview();
  renderFighters();
  renderEvents();
  renderSaved();
}
function showProfile(id) {
  const fighter = fighterById(id);
  if (!fighter) return;
  $("#fighter-detail").innerHTML =
    `<div class="profile-layout">${portrait(fighter, "large")}<div class="profile-copy"><p class="eyebrow">${esc(fighter.country)} · ${styleNames[fighter.style]}</p><h2>${esc(fighter.first)}<br>${esc(fighter.last)}</h2><p>${esc(fighter.tagline)}</p><section class="official-facts"><span class="badge orange">DATOS DEL PERFIL UFC</span><dl><div><dt>División</dt><dd>${esc(fighter.division)}</dd></div><div><dt>Récord · V-D-E</dt><dd>${esc(fighter.record)}</dd></div><div><dt>Apodo</dt><dd>${esc(fighter.nickname || "No indicado")}</dd></div><div><dt>Estilo indicado por UFC</dt><dd>${esc(fighter.officialStyle || "No indicado")}</dd></div><div><dt>Altura / alcance</dt><dd>${fighter.heightCm ?? "—"} cm / ${fighter.reachCm ?? "—"} cm</dd></div><div><dt>Lugar de nacimiento</dt><dd>${esc(fighter.birthplace || "No indicado")}</dd></div></dl><p>Consulta: 2 de octubre de 2026 · Copia fechada</p></section>${renderCombatDetails(fighter)}${renderChampionships(fighter)}<span class="badge">ATRIBUTOS FICTICIOS · 0–100</span><div class="profile-stats">${attributes.map((a, i) => `<div><span>${a.label}</span><strong>${fighter.stats[i]}</strong><div class="profile-track"><i style="width:${fighter.stats[i]}%;background:${fighter.color}"></i></div></div>`).join("")}</div><a class="button small" href="${fighter.source}" target="_blank" rel="noopener noreferrer">Perfil oficial UFC ↗</a><button class="outline-button small" data-favorite="${fighter.id}">${store.state.favorites.includes(id) ? "♥ En favoritos" : "♡ Guardar favorito"}</button><p class="data-note">Fotografía y datos consultados en el perfil oficial de UFC. Las puntuaciones de Fight Lab son ficticias. Consulta la fuente para cambios posteriores.</p></div></div>`;
  $("#fighter-dialog").showModal();
}
function showEvent(id) {
  const event = store.state.events.find((e) => e.id === id);
  if (!event) return;
  delete $("#event-detail").dataset.officialEventId;
  $("#event-detail").dataset.eventId = id;
  $("#event-detail").innerHTML =
    `<p class="eyebrow">${event.type === "demo" ? "CARTELERA DE DEMOSTRACIÓN" : "CARTELERA DE AFICIONADOS"}</p><h2 class="event-dialog-title">${esc(event.title)}</h2><p class="muted">${esc(event.location)} · ${formatDate(event.date)} · ${formatTime(event.date)}</p><p class="data-note">Combates imaginarios: pueden cruzar categorías de peso. Tus picks son opiniones personales y no apuestas.</p><div class="bout-list">${event.bouts
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
  document.title = `${{ inicio: "Inside the fight", eventos: "Carteleras", luchadores: "Luchadores", rankings: "Rankings", laboratorio: "Fight Lab", guardados: "Mi esquina" }[view]} — OCTAGON`;
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
  const event = store.state.events.find((e) => e.id === id);
  if (!event) return;
  const stamp = (date) =>
    new Date(date).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const clean = (value) =>
    value
      .replace(/\\/g, "\\\\")
      .replace(/\r?\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  const contents = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Octagon//Fan Events//ES",
    "BEGIN:VEVENT",
    `UID:${event.id}@octagon.local`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(event.date)}`,
    `DTEND:${stamp(Date.parse(event.date) + 10800000)}`,
    `SUMMARY:${clean(event.title)} (cartelera imaginaria)`,
    `LOCATION:${clean(event.location)}`,
    "DESCRIPTION:Evento ficticio creado en Octagon. No es una cartelera oficial UFC.",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  download(
    new Blob([contents], { type: "text/calendar;charset=utf-8" }),
    "octagon-evento.ics",
  );
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
  const officialButton = event.target.closest("[data-official-event]");
  if (officialButton) { showOfficialEvent(officialButton.dataset.officialEvent); return; }
  const favorite = event.target.closest("[data-favorite]");
  if (favorite) {
    const id = favorite.dataset.favorite;
    if (!fighterById(id)) return;
    const index = store.state.favorites.indexOf(id);
    if (index < 0) store.state.favorites.push(id);
    else store.state.favorites.splice(index, 1);
    persist();
    renderAll();
    if ($("#fighter-dialog").open) {
      $("#fighter-dialog").close();
      showProfile(id);
    }
    toast(index < 0 ? "Añadido a tu esquina" : "Favorito eliminado");
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
  const removePick = event.target.closest("[data-remove-pick]");
  if (removePick) {
    delete store.state.picks[removePick.dataset.removePick];
    persist();
    renderAll();
    toast("Pronóstico eliminado");
    return;
  }
  const removeMatchup = event.target.closest("[data-remove-matchup]");
  if (removeMatchup) {
    const id = removeMatchup.dataset.removeMatchup;
    askDelete("¿Eliminar este análisis?", () => {
      store.state.matchups = store.state.matchups.filter((m) => m.id !== id);
      persist();
      renderSaved();
      toast("Análisis eliminado");
    });
    return;
  }
  const loadMatchup = event.target.closest("[data-load-matchup]");
  if (loadMatchup) {
    const matchup = store.state.matchups.find(
      (m) => m.id === loadMatchup.dataset.loadMatchup,
    );
    if (matchup) {
      lab.load(matchup);
      location.hash = "laboratorio";
    }
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
    "octagon-backup.json",
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
      throw new Error("La copia no contiene datos válidos de Octagon.");
    $("#confirm-title").textContent = "¿Restaurar esta copia?";
    $("#confirm-dialog p").textContent =
      "Tus favoritos, eventos y análisis actuales se sustituirán por los de la copia.";
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
window.addEventListener("hashchange", navigate);
$("#current-date").textContent = new Date().toLocaleDateString("es-ES", {
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
  [...new Set(fighters.map((f) => f.division))]
    .sort((a, b) => a.localeCompare(b, "es"))
    .map(
      (division) =>
        `<option value="${esc(division)}">${esc(division)}</option>`,
    )
    .join("");
document.addEventListener(
  "error",
  (event) => {
    if (!event.target.matches?.(".fighter-photo")) return;
    event.target.hidden = true;
    const portrait = event.target.closest(".fighter-portrait");
    portrait.classList.add("photo-unavailable");
    portrait.querySelector(".portrait-label").textContent =
      "FOTO NO DISPONIBLE · VER PERFIL OFICIAL";
  },
  true,
);
renderAll();
navigate();
updateCountdowns();
persist();
setInterval(updateCountdowns, 1000);

async function updateEventFeed() {
  await refreshEvents();
  renderOverview();
  renderEvents();
  const officialId = $("#event-detail").dataset.officialEventId;
  if ($("#event-dialog").open && officialId) showOfficialEvent(officialId);
}
updateEventFeed();
setInterval(updateEventFeed, 300000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) updateEventFeed();
});
