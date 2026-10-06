import { createDemoEvents, fighterById } from "./data.js";
import { directoryFighterById, directoryFighters } from "./fighter-directory.js";
const key = "octagon-workspace-v1";
export const freshState = () => ({
  version: 1,
  favorites: [],
  pinnedBout: null,
  picks: {},
  matchups: [],
  events: createDemoEvents(),
  theme: "dark",
});
export function validateState(value) {
  if (value?.pinnedBout != null && (
    typeof value.pinnedBout !== "string" || value.pinnedBout.length > 500
  )) return false;
  if (
    !value ||
    value.version !== 1 ||
    !Array.isArray(value.favorites) ||
    value.favorites.length > directoryFighters.length ||
    new Set(value.favorites).size !== value.favorites.length ||
    !value.favorites.every((id) => directoryFighterById(id)) ||
    !["dark", "light"].includes(value.theme)
  )
    return false;
  if (
    !Array.isArray(value.events) ||
    value.events.length > 200 ||
    !value.events.every(
      (e) =>
        e &&
        typeof e.id === "string" &&
        typeof e.title === "string" &&
        e.title.length <= 70 &&
        typeof e.location === "string" &&
        e.location.length <= 100 &&
        Number.isFinite(Date.parse(e.date)) &&
        ["demo", "custom"].includes(e.type) &&
        [3, 5].includes(e.rounds) &&
        Array.isArray(e.bouts) &&
        e.bouts.length > 0 &&
        e.bouts.every(
          (b) =>
            Array.isArray(b) &&
            b.length === 2 &&
            fighterById(b[0]) &&
            fighterById(b[1]) &&
            b[0] !== b[1],
        ),
    )
  )
    return false;
  if (new Set(value.events.map((e) => e.id)).size !== value.events.length)
    return false;
  if (
    !value.picks ||
    typeof value.picks !== "object" ||
    Array.isArray(value.picks)
  )
    return false;
  for (const [boutKey, winner] of Object.entries(value.picks)) {
    const valid = value.events.some((e) =>
      e.bouts.some((b, i) => `${e.id}:${i}` === boutKey && b.includes(winner)),
    );
    if (!valid) return false;
  }
  if (
    !Array.isArray(value.matchups) ||
    value.matchups.length > 200 ||
    !value.matchups.every(
      (m) =>
        m &&
        typeof m.id === "string" &&
        fighterById(m.red) &&
        fighterById(m.blue) &&
        m.red !== m.blue &&
        typeof m.note === "string" &&
        m.note.length <= 500 &&
        Number.isFinite(Date.parse(m.date)) &&
        Array.isArray(m.weights) &&
        m.weights.length === 5 &&
        m.weights.every((w) => Number.isInteger(w) && w >= 0 && w <= 100) &&
        m.weights.some((w) => w > 0),
    )
  )
    return false;
  return true;
}
export function createStore() {
  let state = freshState(),
    available = true,
    storageKey = key;
  function readScope() {
    state = freshState();
    try {
      const raw = localStorage.getItem(storageKey);
      const saved = raw && JSON.parse(raw);
      if (saved && validateState(saved)) state = saved;
    } catch {
      available = false;
    }
  }
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (validateState(parsed)) state = parsed;
    }
  } catch {
    available = false;
  }
  return {
    get state() {
      return state;
    },
    get available() {
      return available;
    },
    save() {
      try {
        localStorage.setItem(storageKey, JSON.stringify(state));
        available = true;
      } catch {
        available = false;
      }
      return available;
    },
    replace(value) {
      if (!validateState(value))
        throw new Error("Archivo incompatible o datos no válidos.");
      state = value;
      return this.save();
    },
    useScope(accountId = null) {
      if (accountId !== null && !/^[a-zA-Z0-9-]{1,80}$/.test(accountId))
        throw new Error("Identificador de cuenta no válido.");
      storageKey = accountId ? `${key}:account:${accountId}` : key;
      readScope();
      return state;
    },
  };
}
