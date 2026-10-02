import { fighters } from "./data.js";
import { $, escapeHTML as esc } from "./utils.js";

// Copia editorial del top 10 de «All Rankings», no de «All Meta Rankings».
export const rankingSnapshot = {
  source: "https://www.ufc.com/rankings",
  consulted: "2026-10-02",
  published: "29 de septiembre de 2026",
};
export const rankingCategories = [
  {
    id: "p4p-men",
    label: "Libra por libra · Masculino",
    short: "P4P masculino",
    description: "Una clasificación que atraviesa las categorías de peso.",
    champion: null,
    names: [
      "Islam Makhachev",
      "Alexander Volkanovski",
      "Justin Gaethje",
      "Petr Yan",
      "Ilia Topuria",
      "Joshua Van",
      "Sean Strickland",
      "Tom Aspinall",
      "Merab Dvalishvili",
      "Alex Pereira",
    ],
  },
  {
    id: "p4p-women",
    label: "Libra por libra · Femenino",
    short: "P4P femenino",
    description: "Referentes del octágono, más allá de su división.",
    champion: null,
    names: [
      "Valentina Shevchenko",
      "Kayla Harrison",
      "Zhang Weili",
      "Natalia Silva",
      "Mackenzie Dern",
      "Alexa Grasso",
      "Manon Fiorot",
      "Erin Blanchfield",
      "Tatiana Suarez",
      "Julianna Peña",
    ],
  },
  {
    id: "lightweight",
    label: "Peso ligero · Masculino",
    short: "Peso ligero",
    description: "El campeón y los diez primeros aspirantes de esta división.",
    champion: "Justin Gaethje",
    names: [
      "Ilia Topuria",
      "Arman Tsarukyan",
      "Charles Oliveira",
      "Max Holloway",
      "Paddy Pimblett",
      "Benoît Saint Denis",
      "Quillan Salkilld",
      "Mauricio Ruffy",
      "Salahdine Parnasse",
      "Mateusz Gamrot",
    ],
  },
  {
    id: "welterweight",
    label: "Peso wélter · Masculino",
    short: "Peso wélter",
    description: "El campeón y los diez primeros aspirantes de esta división.",
    champion: "Islam Makhachev",
    names: [
      "Ian Machado Garry",
      "Carlos Prates",
      "Michael Morales",
      "Jack Della Maddalena",
      "Gabriel Bonfim",
      "Sean Brady",
      "Belal Muhammad",
      "Leon Edwards",
      "Kamaru Usman",
      "Joaquin Buckley",
    ],
  },
  {
    id: "strawweight-women",
    label: "Peso paja · Femenino",
    short: "Peso paja femenino",
    description: "La campeona y las diez primeras aspirantes de esta división.",
    champion: "Mackenzie Dern",
    names: [
      "Zhang Weili",
      "Tatiana Suarez",
      "Virna Jandiroba",
      "Denise Gomes",
      "Gillian Robertson",
      "Yan Xiaonan",
      "Fatima Kline",
      "Loopy Godinez",
      "Alexia Thainara",
      "Jéssica Andrade",
    ],
  },
];

function localProfile(name) {
  // UFC usa «Zhang Weili» mientras la ficha local muestra «Weili Zhang».
  if (name === "Zhang Weili") return fighters.find((f) => f.id === "zhang");
  return fighters.find((f) => `${f.first} ${f.last}` === name);
}
function nameLink(name) {
  const fighter = localProfile(name);
  return fighter
    ? `<button class="ranking-name" data-profile="${fighter.id}">${esc(name)} <span>↗</span></button>`
    : `<span class="ranking-name">${esc(name)}</span>`;
}

export function initializeRankings() {
  $("#ranking-category").innerHTML = rankingCategories
    .map(
      (category) =>
        `<option value="${category.id}">${esc(category.label)}</option>`,
    )
    .join("");
  $("#ranking-source-date").textContent =
    `Versión publicada: ${rankingSnapshot.published} · Consultada: 2 de octubre de 2026`;

  function render() {
    const category =
      rankingCategories.find((c) => c.id === $("#ranking-category").value) ||
      rankingCategories[0];
    const query = $("#ranking-search").value.toLocaleLowerCase("es").trim();
    const localOnly = $("#ranking-local-only").checked;
    const matches = (name) =>
      name.toLocaleLowerCase("es").includes(query) &&
      (!localOnly || localProfile(name));
    const rows = category.names
      .map((name, index) => ({ name, rank: index + 1 }))
      .filter((row) => matches(row.name));
    const showChampion = category.champion && matches(category.champion);
    const leader = category.champion || category.names[0];
    $("#ranking-category-title").textContent = category.label;
    $("#ranking-category-description").textContent = category.description;
    $("#ranking-leader").innerHTML =
      `<span class="eyebrow">${category.champion ? "CAMPEÓN DE LA DIVISIÓN" : "NÚMERO UNO · LIBRA POR LIBRA"}</span><div class="ranking-leader-symbol" aria-hidden="true">${category.champion ? "C" : "01"}</div><h3>${esc(leader)}</h3><p>${esc(category.short)} · Copia fechada</p><a class="text-link" href="${rankingSnapshot.source}" target="_blank" rel="noopener noreferrer">Consultar la lista completa ↗</a>`;
    $("#ranking-result-count").textContent =
      `${rows.length} de 10 posiciones${showChampion ? " + campeón" : ""}`;
    $("#ranking-table-body").innerHTML =
      `${showChampion ? `<tr class="champion-row"><th scope="row"><span class="rank-champion">C</span></th><td>${nameLink(category.champion)}</td><td><span class="badge orange">CAMPEÓN</span></td></tr>` : ""}${rows.map((row) => `<tr><th scope="row"><span class="rank-position ${row.rank <= 3 ? "podium" : ""}">${String(row.rank).padStart(2, "0")}</span></th><td>${nameLink(row.name)}</td><td>${localProfile(row.name) ? '<span class="ranking-status">Ficha disponible</span>' : '<span class="ranking-status muted">Lista UFC</span>'}</td></tr>`).join("")}`;
    $("#ranking-table").hidden = !rows.length && !showChampion;
    $("#ranking-empty").hidden = rows.length > 0 || Boolean(showChampion);
  }
  $("#ranking-category").addEventListener("change", render);
  $("#ranking-search").addEventListener("input", render);
  $("#ranking-local-only").addEventListener("change", render);
  $("#ranking-clear").addEventListener("click", () => {
    $("#ranking-search").value = "";
    $("#ranking-local-only").checked = false;
    render();
  });
  render();
}
