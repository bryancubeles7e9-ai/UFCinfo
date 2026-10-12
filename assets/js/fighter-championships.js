import { directoryFighters, directoryFighterByName } from "./fighter-directory.js";

const divisions = {
  flyweight: "Peso mosca", bantamweight: "Peso gallo",
  featherweight: "Peso pluma", lightweight: "Peso ligero",
  welterweight: "Peso wélter", middleweight: "Peso medio",
  "light-heavyweight": "Peso semipesado", heavyweight: "Peso pesado",
  "strawweight-women": "Peso paja femenino",
  "flyweight-women": "Peso mosca femenino",
  "bantamweight-women": "Peso gallo femenino",
};

// Called only with a validated ranking snapshot. Keep historical and BMF belts.
export function synchronizeChampionships(categories, snapshot) {
  for (const category of categories) {
    const division = divisions[category.id];
    const champion = category.champion && directoryFighterByName(category.champion);
    if (!division || !champion) continue;
    for (const fighter of directoryFighters) {
      const belts = fighter.championships ||= [];
      for (const belt of belts) {
        if (belt.name === division && belt.type === "undisputed") {
          belt.status = fighter === champion ? "current" : "former";
          belt.source = snapshot.source;
          fighter.championshipConsultedAt = snapshot.synchronizedAt;
        }
      }
    }
    if (!champion.championships.some(b => b.name === division && b.type === "undisputed")) {
      champion.championships.push({ name: division, status: "current", type: "undisputed", source: snapshot.source });
    }
    champion.championshipConsultedAt = snapshot.synchronizedAt;
  }
}

export function matchesChampionship(fighter, filter) {
  const belts = fighter.championships || [];
  return filter === "all" || (filter === "current" || filter === "former"
    ? belts.some(b => b.status === filter) : belts.length > 0);
}
