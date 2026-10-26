import { enterRankings } from "./showcase-motion.js";
import { synchronizeChampionships } from "./fighter-championships.js";
import { getLocale } from "./i18n.js";
import { directoryFighterByName, fighterNameLink } from "./fighter-directory.js";
import { $, escapeHTML as esc } from "./utils.js";

// Respaldo del top 15 de «All Rankings», no de «All Meta Rankings».
export const rankingSnapshot = {
  "source": "https://www.ufc.com/rankings",
  "published": "How are rankings determined?",
  "synchronizedAt": "2026-10-13T06:23:32.641409+00:00"
};
export const rankingCategories = [
  {
    "id": "p4p-men",
    "label": "Libra por libra · Masculino",
    "short": "Libra por libra masculino",
    "description": "Una clasificación que atraviesa las categorías de peso.",
    "champion": null,
    "names": [
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
      "Ciryl Gane",
      "Khamzat Chimaev",
      "Arman Tsarukyan",
      "Alexandre Pantoja",
      "Carlos Ulberg"
    ],
    "ranks": [
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13,
      14,
      15
    ]
  },
  {
    "id": "p4p-women",
    "label": "Libra por libra · Femenino",
    "short": "Libra por libra femenino",
    "description": "Una clasificación que atraviesa las categorías de peso.",
    "champion": null,
    "names": [
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
      "Virna Jandiroba",
      "Rose Namajunas",
      "Raquel Pennington",
      "Denise Gomes",
      "Maycee Barber"
    ],
    "ranks": [
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13,
      14,
      15
    ]
  },
  {
    "id": "flyweight",
    "label": "Peso mosca · Masculino",
    "short": "Peso mosca masculino",
    "description": "El campeón y el top 15 de esta división.",
    "champion": "Joshua Van",
    "names": [
      "Alexandre Pantoja",
      "Manel Kape",
      "Brandon Royval",
      "Tatsuro Taira",
      "Kyoji Horiguchi",
      "Lone’er Kavanagh",
      "Asu Almabayev",
      "Brandon Moreno",
      "Amir Albazi",
      "Ramazan Temirov",
      "Tim Elliott",
      "Steve Erceg",
      "Sumudaerji",
      "Tagir Ulanbekov",
      "Alex Perez"
    ],
    "ranks": [
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13,
      14,
      15
    ]
  },
  {
    "id": "bantamweight",
    "label": "Peso gallo · Masculino",
    "short": "Peso gallo masculino",
    "description": "El campeón y el top 15 de esta división.",
    "champion": "Petr Yan",
    "names": [
      "Merab Dvalishvili",
      "Sean O'Malley",
      "Song Yadong",
      "Umar Nurmagomedov",
      "Mario Bautista",
      "Cory Sandhagen",
      "Payton Talbott",
      "Aiemann Zahabi",
      "David Martinez",
      "Raul Rosas Jr.",
      "Marlon Vera",
      "Deiveson Figueiredo",
      "Farid Basharat",
      "Marcus McGhee",
      "Raoni Barcelos"
    ],
    "ranks": [
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13,
      14,
      15
    ]
  },
  {
    "id": "featherweight",
    "label": "Peso pluma · Masculino",
    "short": "Peso pluma masculino",
    "description": "El campeón y el top 15 de esta división.",
    "champion": "Alexander Volkanovski",
    "names": [
      "Movsar Evloev",
      "Diego Lopes",
      "Lerone Murphy",
      "Aljamain Sterling",
      "Jean Silva",
      "Yair Rodriguez",
      "Arnold Allen",
      "Youssef Zalal",
      "Kevin Vallejos",
      "Steve Garcia",
      "Aaron Pico",
      "Melquizael Costa",
      "Brian Ortega",
      "Patricio Pitbull",
      "David Onama"
    ],
    "ranks": [
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13,
      14,
      15
    ]
  },
  {
    "id": "lightweight",
    "label": "Peso ligero · Masculino",
    "short": "Peso ligero masculino",
    "description": "El campeón y el top 15 de esta división.",
    "champion": "Justin Gaethje",
    "names": [
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
      "Rafael Fiziev",
      "Renato Moicano",
      "Dan Hooker",
      "Tom Nolan",
      "Beneil Dariush"
    ],
    "ranks": [
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13,
      14,
      15
    ]
  },
  {
    "id": "welterweight",
    "label": "Peso wélter · Masculino",
    "short": "Peso wélter masculino",
    "description": "El campeón y el top 15 de esta división.",
    "champion": "Islam Makhachev",
    "names": [
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
      "Yaroslav Amosov",
      "Uroš Medić",
      "Mike Malott",
      "Daniel Rodriguez",
      "Neil Magny"
    ],
    "ranks": [
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13,
      14,
      15
    ]
  },
  {
    "id": "middleweight",
    "label": "Peso medio · Masculino",
    "short": "Peso medio masculino",
    "description": "El campeón y el top 15 de esta división.",
    "champion": "Sean Strickland",
    "names": [
      "Khamzat Chimaev",
      "Dricus Du Plessis",
      "Nassourdine Imavov",
      "Brendan Allen",
      "Caio Borralho",
      "Joe Pyfer",
      "Gregory Rodrigues",
      "Anthony Hernandez",
      "Israel Adesanya",
      "Christian Leroy Duncan",
      "Jared Cannonier",
      "Abus Magomedov",
      "Ikram Aliskerov",
      "Bo Nickal",
      "Shara Magomedov"
    ],
    "ranks": [
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13,
      14,
      15
    ]
  },
  {
    "id": "light-heavyweight",
    "label": "Peso semipesado · Masculino",
    "short": "Peso semipesado masculino",
    "description": "El campeón y el top 15 de esta división.",
    "champion": "Carlos Ulberg",
    "names": [
      "Magomed Ankalaev",
      "Jiří Procházka",
      "Alex Pereira",
      "Khalil Rountree Jr.",
      "Navajo Stirling",
      "Paulo Costa",
      "Azamat Murzakanov",
      "Dominick Reyes",
      "Jan Błachowicz",
      "Bogdan Guskov",
      "Robert Whittaker",
      "Alonzo Menifield",
      "Muhammad Saidov",
      "Reinier de Ridder",
      "Nikita Krylov"
    ],
    "ranks": [
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13,
      14,
      15
    ]
  },
  {
    "id": "heavyweight",
    "label": "Peso pesado · Masculino",
    "short": "Peso pesado masculino",
    "description": "El campeón y el top 15 de esta división.",
    "champion": "Ciryl Gane",
    "names": [
      "Tom Aspinall",
      "Alexander Volkov",
      "Sergei Pavlovich",
      "Josh Hokit",
      "Curtis Blaydes",
      "Waldo Cortes Acosta",
      "Rizvan Kuniev",
      "Vitor Petrino",
      "Serghei Spivac",
      "Ante Delija",
      "Valter Walker",
      "Tyrell Fortune",
      "Derrick Lewis",
      "Aleksandar Rakić",
      "Mario Pinto"
    ],
    "ranks": [
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13,
      14,
      15
    ]
  },
  {
    "id": "strawweight-women",
    "label": "Peso paja · Femenino",
    "short": "Peso paja femenino",
    "description": "La campeona y el top 15 de esta división.",
    "champion": "Mackenzie Dern",
    "names": [
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
      "Tabatha Ricci",
      "Amanda Lemos",
      "Amanda Ribas",
      "Angela Hill",
      "Mizuki"
    ],
    "ranks": [
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13,
      14,
      15
    ]
  },
  {
    "id": "flyweight-women",
    "label": "Peso mosca · Femenino",
    "short": "Peso mosca femenino",
    "description": "La campeona y el top 15 de esta división.",
    "champion": "Natalia Silva",
    "names": [
      "Valentina Shevchenko",
      "Alexa Grasso",
      "Manon Fiorot",
      "Erin Blanchfield",
      "Rose Namajunas",
      "Jasmine Jasudavicius",
      "Maycee Barber",
      "Wang Cong",
      "Tracy Cortez",
      "Miranda Maverick",
      "Karine Silva",
      "Casey O'Neill",
      "Eduarda Moura",
      "Regina Tarin",
      "Gabriella Fernandes"
    ],
    "ranks": [
      1,
      2,
      3,
      4,
      5,
      6,
      6,
      8,
      9,
      10,
      11,
      12,
      13,
      14,
      15
    ]
  },
  {
    "id": "bantamweight-women",
    "label": "Peso gallo · Femenino",
    "short": "Peso gallo femenino",
    "description": "La campeona y el top 15 de esta división.",
    "champion": "Kayla Harrison",
    "names": [
      "Julianna Peña",
      "Joselyne Edwards",
      "Ailin Perez",
      "Raquel Pennington",
      "Norma Dumont",
      "Yana Santos",
      "Luana Santos",
      "Jacqueline Cavalcanti",
      "Macy Chiasson",
      "Karol Rosa",
      "Bia Mesquita",
      "Michelle Montague",
      "Nora Cornolle",
      "Melissa Croden",
      "Daria Zhelezniakova"
    ],
    "ranks": [
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13,
      14,
      15
    ]
  }
];

let updatingRankings = false;
synchronizeChampionships(rankingCategories, rankingSnapshot);

export async function refreshRankings() {
  if (updatingRankings) return false;
  updatingRankings = true;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(new URL('../data/ufc-rankings.json', import.meta.url), { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error('Rankings unavailable');
    const feed = await response.json();
    const ids = rankingCategories.map(c => c.id);
    const nameValid = n => typeof n === 'string' && n.trim().length > 0 && n.length <= 150;
    if (feed.schemaVersion !== 1 || feed.source !== rankingSnapshot.source ||
        typeof feed.synchronizedAt !== 'string' || !Number.isFinite(Date.parse(feed.synchronizedAt)) ||
        !(feed.published === null || typeof feed.published === 'string') ||
        !Array.isArray(feed.categories) || feed.categories.length !== ids.length ||
        new Set(feed.categories.map(c => c?.id)).size !== ids.length ||
        !feed.categories.every(c => c && ids.includes(c.id) &&
          (c.id.startsWith('p4p-') ? c.champion === null : nameValid(c.champion)) &&
          Array.isArray(c.names) && c.names.length >= 15 && c.names.length <= 20 &&
          c.names.every(nameValid) && new Set(c.names).size === c.names.length &&
          Array.isArray(c.ranks) && c.ranks.length === c.names.length &&
          c.ranks.every((r, i) => Number.isInteger(r) && r >= 1 && r <= 15 && r <= i + 1 && (!i || r >= c.ranks[i - 1])) &&
          Math.max(...c.ranks) === 15)) throw new Error('Invalid rankings');
    for (const category of rankingCategories) {
      const next = feed.categories.find(c => c.id === category.id);
      category.champion = next.champion;
      category.names = next.names;
      category.ranks = next.ranks;
    }
    rankingSnapshot.published = feed.published;
    rankingSnapshot.synchronizedAt = feed.synchronizedAt;
    synchronizeChampionships(rankingCategories, rankingSnapshot);
    document.dispatchEvent?.(new Event("octagon:rankings-updated"));
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    updatingRankings = false;
  }
}

function localProfile(name) {
  return directoryFighterByName(name);
}
function nameLink(name) {
  return fighterNameLink(name);
}

export function initializeRankings() {
  $("#ranking-category").innerHTML = rankingCategories
    .map(
      (category) =>
        `<option value="${category.id}">${esc(category.label)}</option>`,
    )
    .join("");
  function render() {
    $("#ranking-source-date").textContent =
      `Versión publicada: ${rankingSnapshot.published || "Fecha no indicada por UFC"} · Última consulta: ${new Date(rankingSnapshot.synchronizedAt || rankingSnapshot.consulted + "T00:00:00Z").toLocaleString(getLocale())}`;
    const category =
      rankingCategories.find((c) => c.id === $("#ranking-category").value) ||
      rankingCategories[0];
    const query = $("#ranking-search").value.toLocaleLowerCase("es").trim();
    const localOnly = $("#ranking-local-only").checked;
    const matches = (name) =>
      name.toLocaleLowerCase("es").includes(query) &&
      (!localOnly || localProfile(name));
    const rows = category.names
      .map((name, index) => ({ name, rank: category.ranks?.[index] ?? index + 1 }))
      .filter((row) => matches(row.name));
    const showChampion = category.champion && matches(category.champion);
    const leader = category.champion || category.names[0];
    $("#ranking-category-title").textContent = category.label;
    $("#ranking-category-description").textContent = category.description;
    $("#ranking-leader").innerHTML =
      `<span class="eyebrow">${category.champion ? "CAMPEÓN DE LA DIVISIÓN" : "NÚMERO UNO · LIBRA POR LIBRA"}</span><div class="ranking-leader-symbol" aria-hidden="true">${category.champion ? "C" : "01"}</div><h3>${esc(leader)}</h3><p>${esc(category.short)} · Copia fechada</p><a class="text-link" href="${rankingSnapshot.source}" target="_blank" rel="noopener noreferrer">Consultar la lista completa ›</a>`;
    $("#ranking-result-count").textContent =
      `${rows.length} de ${category.names.length} luchadores${showChampion ? " + campeón" : ""}`;
    $("#ranking-table-body").innerHTML =
      `${showChampion ? `<tr class="champion-row"><th scope="row"><span class="rank-champion">C</span></th><td>${nameLink(category.champion)}</td><td><span class="badge orange">CAMPEÓN</span></td></tr>` : ""}${rows.map((row) => `<tr><th scope="row"><span class="rank-position ${row.rank <= 3 ? "podium" : ""}">${String(row.rank).padStart(2, "0")}</span></th><td>${nameLink(row.name)}</td><td>${localProfile(row.name) ? '<span class="ranking-status">Ficha disponible</span>' : '<span class="ranking-status muted">Lista UFC</span>'}</td></tr>`).join("")}`;
    $("#ranking-table").hidden = !rows.length && !showChampion;
    $("#ranking-empty").hidden = rows.length > 0 || Boolean(showChampion);
  }
  const animate = () => enterRankings($("#ranking-table"), $("#ranking-leader"));
  $("#ranking-category").addEventListener("change", () => { render(); animate(); });
  $("#ranking-search").addEventListener("input", render);
  $("#ranking-local-only").addEventListener("change", render);
  $("#ranking-clear").addEventListener("click", () => {
    $("#ranking-search").value = "";
    $("#ranking-local-only").checked = false;
    render();
  });
  document.addEventListener("ufcinfo:language-changed", render);
  render();
  const update = async () => {
    if (await refreshRankings()) render();
  };
  update();
  setInterval(update, 300000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) update();
  });
  return { animate };
}
