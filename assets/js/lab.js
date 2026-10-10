import { getLocale } from "./i18n.js";
import { directoryFighters, directoryFighterById } from "./fighter-directory.js";
import { fullName } from "./data.js";
import { fighterInfo } from "./fighter-info-data.js";
import { stanceNames } from "./fighter-details.js";
import { $, escapeHTML as esc, formatDate } from "./utils.js";

const numbers = { format: value => new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 2 }).format(value) };
const missing = "No indicado";
const numeric = (value, unit = "") => typeof value === "number" && Number.isFinite(value) ? numbers.format(value) + unit : missing;
const date = (value) => value && Number.isFinite(Date.parse(value)) ? formatDate(value) : missing;
const infoFor = (fighter) => fighter.info || fighterInfo[fighter.id] || {};
function belts(fighter) {
  if (!Array.isArray(fighter.championships)) return "No documentado en esta ficha";
  if (!fighter.championships.length) return "Sin títulos absolutos o BMF registrados";
  return fighter.championships.map(b => b.name + (b.status === "current" ? " (actual)" : " (anterior)")).join(" · ");
}

export function comparisonGroups(red, blue) {
  const r = infoFor(red), b = infoFor(blue);
  const fact = (label, key) => ({ label, red: red[key] || missing, blue: blue[key] || missing });
  const number = (label, key, unit = "", percentage = false) => ({
    label, red: numeric(r[key], unit), blue: numeric(b[key], unit),
    redPercent: percentage && typeof r[key] === "number" ? r[key] : null,
    bluePercent: percentage && typeof b[key] === "number" ? b[key] : null,
  });
  return [
    { title: "Perfil y datos físicos", rows: [
      fact("División", "division"), fact("Récord · victorias–derrotas–empates", "record"), fact("Apodo", "nickname"),
      number("Edad en la consulta", "age", " años"),
      { label: "Altura", red: numeric(red.heightCm, " cm"), blue: numeric(blue.heightCm, " cm") },
      { label: "Alcance de brazos", red: numeric(red.reachCm, " cm"), blue: numeric(blue.reachCm, " cm") },
      number("Alcance de pierna", "legReachCm", " cm"), number("Peso del perfil", "weightKg", " kg"),
      fact("Lugar de nacimiento", "birthplace"),
    ] },
    { title: "Formación y trayectoria", rows: [
      fact("Estilo indicado por UFC", "officialStyle"),
      { label: "Equipo / gimnasio", red: r.gym || missing, blue: b.gym || missing },
      { label: "Debut en UFC", red: date(r.debut), blue: date(b.debut) },
      { label: "Guardia registrada", red: stanceNames[red.stance]?.label || missing, blue: stanceNames[blue.stance]?.label || missing },
      fact("Base / formación marcial", "martialBase"),
      { label: "Cinturones UFC absolutos y BMF", red: belts(red), blue: belts(blue) },
    ] },
    { title: "Golpeo", rows: [
      number("Golpes significativos conectados / min", "strikesLanded"),
      number("Golpes significativos recibidos / min", "strikesAbsorbed"),
      number("Precisión de golpeo", "strikingAccuracy", " %", true),
      number("Defensa de golpeo", "strikingDefense", " %", true),
      number("Knockdowns / 15 min", "knockdownAverage"),
    ] },
    { title: "Derribos y sumisiones", rows: [
      number("Derribos / 15 min", "takedownAverage"),
      number("Precisión de derribos", "takedownAccuracy", " %", true),
      number("Defensa de derribos", "takedownDefense", " %", true),
      number("Intentos de sumisión / 15 min", "submissionAverage"),
    ] },
    { title: "Finalizaciones", rows: [
      number("Victorias por KO / TKO", "koWins"), number("Victorias por sumisión", "submissionWins"),
      number("Finalizaciones en el primer asalto", "firstRoundFinishes"),
    ] },
  ];
}

function summary(fighter, corner) {
  const info = infoFor(fighter);
  return `<article class="lab-fighter ${corner}"><div class="lab-fighter-photo"><img src="${esc(fighter.image)}" alt="${esc(fullName(fighter))}, fotografía oficial UFC" width="460" height="700"></div><div><p class="eyebrow">${corner === "red" ? "ESQUINA ROJA" : "ESQUINA AZUL"}</p><h2>${esc(fullName(fighter))}</h2><p>${esc(fighter.division)} · ${esc(fighter.record)}</p><button class="text-link" data-profile="${esc(fighter.id)}">Abrir ficha completa ›</button><p class="data-note">Perfil: ${esc(date(fighter.consulted))}<br>Estadísticas: ${esc(date(info.consulted))}${fighter.detailsConsulted ? `<br>Guardia y cinturones: ${esc(date(fighter.detailsConsulted))}` : ""}</p><a class="text-link" href="${esc(fighter.source)}" target="_blank" rel="noopener noreferrer">Fuente: UFC ›</a>${fighter.stanceSource ? `<a class="text-link lab-stance-source" href="${esc(fighter.stanceSource)}" target="_blank" rel="noopener noreferrer">Guardia: UFC Stats ›</a>` : ""}</div></article>`;
}

export function renderComparison(red, blue) {
  const cell = (text, percent, corner) => `<td class="lab-value ${corner}">${esc(text)}${percent === null || percent === undefined ? "" : `<div class="lab-percent" aria-hidden="true"><span style="width:${Math.max(0, Math.min(100, percent))}%"></span></div>`}</td>`;
  return comparisonGroups(red, blue).map(group => `<table class="lab-table"><caption>${esc(group.title)}</caption><thead><tr><th scope="col">Dato / estadística</th><th scope="col">${esc(fullName(red))}</th><th scope="col">${esc(fullName(blue))}</th></tr></thead><tbody>${group.rows.map(row => `<tr><th scope="row">${esc(row.label)}</th>${cell(row.red, row.redPercent, "red")}${cell(row.blue, row.bluePercent, "blue")}</tr>`).join("")}</tbody></table>`).join("");
}

export function initializeLab() {
  const options = [...directoryFighters].sort((a, b) => fullName(a).localeCompare(fullName(b), "es"))
    .map(f => `<option value="${esc(f.id)}">${esc(fullName(f))} · ${esc(f.division)}</option>`).join("");
  $("#red-fighter").innerHTML = options;
  $("#blue-fighter").innerHTML = options;
  $("#red-fighter").value = "topuria";
  $("#blue-fighter").value = "holloway";
  function draw() {
    const red = directoryFighterById($("#red-fighter").value), blue = directoryFighterById($("#blue-fighter").value);
    const invalid = !red || !blue || red.id === blue.id;
    $("#comparison-status").textContent = invalid ? "Selecciona dos luchadores distintos para comparar." : fullName(red) + " frente a " + fullName(blue);
    $("#lab-fighter-summaries").innerHTML = invalid ? "" : summary(red, "red") + summary(blue, "blue");
    $("#comparison-tables").innerHTML = invalid ? "" : renderComparison(red, blue);
    $("#comparison-notes").hidden = invalid;
  }
  for (const selector of ["#red-fighter", "#blue-fighter"]) $(selector).addEventListener("change", draw);
  $("#swap-fighters").addEventListener("click", () => {
    const old = $("#red-fighter").value;
    $("#red-fighter").value = $("#blue-fighter").value;
    $("#blue-fighter").value = old;
    draw();
  });
  document.addEventListener("ufcinfo:language-changed", draw);
  draw();
  const compare = (red, blue) => {
    if (!directoryFighterById(red) || !directoryFighterById(blue)) return;
    $("#red-fighter").value = red;
    $("#blue-fighter").value = blue;
    draw();
  };
  return { compare, load: ({ red, blue }) => compare(red, blue) };
}
