import { getLocale } from "./i18n.js";
import { fighterInfo } from "./fighter-info-data.js";
import { escapeHTML as esc } from "./utils.js";

const numbers = { format: value => new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 2 }).format(value) };
function value(number, unit = "") {
  return typeof number === "number" && Number.isFinite(number)
    ? `${numbers.format(number)}${unit}` : "No indicado";
}
function dateLabel(date) {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString(getLocale(), {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
}
function facts(rows) {
  return `<dl>${rows.map(([label, text]) => `<div><dt>${esc(label)}</dt><dd>${esc(text)}</dd></div>`).join("")}</dl>`;
}

export function renderExtendedFighterInfo(fighter) {
  const info = fighter.info || fighterInfo[fighter.id];
  if (!info) return "";
  const biography = [
    ["Edad en la consulta", value(info.age, " años")],
    ["Equipo / gimnasio", info.gym || "No indicado"],
    ["Peso del perfil", value(info.weightKg, " kg")],
    ["Alcance de pierna", value(info.legReachCm, " cm")],
    ["Debut en UFC", info.debut ? dateLabel(info.debut) : "No indicado"],
  ];
  const striking = [
    ["Golpes significativos conectados / min", value(info.strikesLanded)],
    ["Golpes significativos recibidos / min", value(info.strikesAbsorbed)],
    ["Precisión de golpeo", value(info.strikingAccuracy, " %")],
    ["Defensa de golpeo", value(info.strikingDefense, " %")],
    ["Knockdowns / 15 min", value(info.knockdownAverage)],
  ];
  const grappling = [
    ["Derribos / 15 min", value(info.takedownAverage)],
    ["Precisión de derribos", value(info.takedownAccuracy, " %")],
    ["Defensa de derribos", value(info.takedownDefense, " %")],
    ["Intentos de sumisión / 15 min", value(info.submissionAverage)],
  ];
  const finishes = [
    ["Victorias por KO / TKO", value(info.koWins)],
    ["Victorias por sumisión", value(info.submissionWins)],
    ["Finalizaciones en el primer asalto", value(info.firstRoundFinishes)],
  ];
  return `<section class="official-facts extended-fighter-info" aria-label="Trayectoria y estadísticas oficiales">
    <span class="badge orange">TRAYECTORIA Y ESTADÍSTICAS UFC</span>
    <h3>Más sobre ${esc(fighter.first)}</h3>${facts(biography)}
    <h3>Golpeo</h3>${facts(striking)}
    <h3>Derribos y sumisiones</h3>${facts(grappling)}
    <h3>Finalizaciones</h3>${facts(finishes)}
    <p>Golpes significativos: golpes a distancia y golpes de potencia en clinch o suelo. La defensa indica el porcentaje de intentos rivales que no conectan. Las medias de derribos, intentos de sumisión y knockdowns se expresan por 15 minutos.</p>
    <p>Las finalizaciones son los totales que publica el perfil; pueden abarcar combates fuera de UFC. La edad y el peso corresponden a esta copia del perfil.</p>
    <p>Consulta: ${esc(dateLabel(info.consulted))} · Copia fechada · <a class="text-link" href="${esc(info.source)}" target="_blank" rel="noopener noreferrer">Fuente: perfil oficial UFC ↗</a></p>
  </section>`;
}
