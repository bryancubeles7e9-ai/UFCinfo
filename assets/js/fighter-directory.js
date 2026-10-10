import { fighters, fullName } from "./data.js";
import { additionalFighters } from "./fighter-directory-data.js";
import { escapeHTML as esc } from "./utils.js";

export { additionalFighters };
export const directoryFighters = [...fighters, ...additionalFighters];
export function normalizeFighterName(name) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/[^a-z0-9]/g, "");
}
const byName = new Map();
const byId = new Map();
for (const fighter of directoryFighters) {
  byId.set(fighter.id, fighter);
  for (const name of [fullName(fighter), ...(fighter.aliases || []), ...(fighter.id === "zhang" ? ["Zhang Weili"] : [])]) {
    byName.set(normalizeFighterName(name), fighter);
  }
}
export const directoryFighterById = (id) => byId.get(id);
export const directoryFighterByName = (name) => byName.get(normalizeFighterName(name));
export function fighterNameLink(name, className = "ranking-name") {
  const fighter = directoryFighterByName(name);
  return fighter
    ? `<button translate="no" class="${esc(className)}" data-profile="${esc(fighter.id)}">${esc(name)} <span>›</span></button>`
    : `<a translate="no" class="${esc(className)}" href="https://www.ufc.com/athletes" target="_blank" rel="noopener noreferrer">${esc(name)} ›</a>`;
}
