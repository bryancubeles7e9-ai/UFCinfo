import { escapeHTML as esc } from "./utils.js";

export const stanceNames = {
  Orthodox: {
    short: "Diestro",
    label: "Diestro · Guardia ortodoxa",
    code: "DI",
  },
  Southpaw: { short: "Zurdo", label: "Zurdo · Guardia southpaw", code: "ZU" },
  Switch: {
    short: "Ambas",
    label: "Alterna ambas guardias · Switch",
    code: "SW",
  },
};
export function hasCurrentBelt(fighter) {
  return fighter.championships.some((belt) => belt.status === "current");
}
const women = new Set([
  "zhang",
  "shevchenko",
  "harrison",
  "silva",
  "dern",
  "grasso",
  "fiorot",
  "blanchfield",
]);
const beltIcon = `<svg viewBox="0 0 64 30" aria-hidden="true"><path d="M2 9h14l5-5h22l5 5h14v12H48l-5 5H21l-5-5H2Z" fill="currentColor"/><path d="M24 8h16l5 7-5 7H24l-5-7Z" fill="none" stroke="var(--surface)" stroke-width="2"/><path d="M6 12h7v6H6Zm45 0h7v6h-7Z" fill="var(--surface)" opacity=".6"/></svg>`;

export function championshipBadge(fighter) {
  if (!fighter.championships.length) return "";
  const current = hasCurrentBelt(fighter);
  const onlyBMF = fighter.championships
    .filter((belt) => belt.status === "current")
    .every((belt) => belt.name === "BMF");
  const title = current
    ? `${women.has(fighter.id) ? "Campeona" : "Campeón"} ${onlyBMF ? "BMF" : "UFC"}`
    : `${women.has(fighter.id) ? "Excampeona" : "Excampeón"} UFC`;
  return `<span class="championship-badge ${current ? "current" : "former"}" title="${esc(fighter.championships.map((belt) => `${belt.name}: ${belt.status === "current" ? "actual" : "anterior"}`).join(" · "))}">${beltIcon}${title}</span>`;
}

export function compactCombatInfo(fighter) {
  const stance = stanceNames[fighter.stance];
  return `<dl class="card-combat-info"><div><dt>GUARDIA</dt><dd>${esc(stance?.short || "No indicada")}</dd></div><div><dt>BASE MARCIAL</dt><dd>${esc(fighter.martialBase)}</dd></div></dl>`;
}

export function renderCombatDetails(fighter) {
  const stance = stanceNames[fighter.stance];
  return `<section class="combat-details"><div class="combat-stance"><span class="stance-emblem">${stance?.code || "—"}</span><div><p class="eyebrow">GUARDIA REGISTRADA</p><h3>${esc(stance?.label || "No indicada")}</h3><a class="text-link" href="${esc(fighter.stanceSource)}" target="_blank" rel="noopener noreferrer">Fuente: UFC Stats ↗</a></div></div><div class="martial-base"><p class="eyebrow">BASE / FORMACIÓN MARCIAL</p><h3>${esc(fighter.martialBase)}</h3><p>${esc(fighter.martialBaseNote)}</p><a class="text-link" href="${esc(fighter.martialBaseSource)}" target="_blank" rel="noopener noreferrer">Formación en UFC ↗</a></div></section>`;
}

export function renderChampionships(fighter) {
  const belts = [...fighter.championships].sort(
    (a, b) => Number(b.status === "current") - Number(a.status === "current"),
  );
  return `<section class="championship-history"><div class="championship-heading"><h3>Cinturones UFC</h3><span class="badge">${belts.length} ${belts.length === 1 ? "CINTURÓN" : "CINTURONES"}</span></div>${belts.length ? `<ul>${belts.map((belt) => `<li class="belt-row ${belt.status}"><span class="belt-symbol">${beltIcon}</span><div><strong>${esc(belt.name)}</strong><small>${belt.type === "special" ? "Título especial BMF" : "Título absoluto de división"}</small></div><span class="belt-status">${belt.status === "current" ? "ACTUAL" : "ANTERIOR"}</span></li>`).join("")}</ul>` : '<p class="no-belts">Sin cinturones UFC absolutos o BMF registrados en esta ficha.</p>'}<p class="belt-scope">Títulos absolutos y BMF. No incluye cinturones interinos. Consulta: 2 de octubre de 2026.</p></section>`;
}
