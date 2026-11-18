// Remembers which rumors this browser has already shown, so later visits can flag new ones.
const storageKey = 'ufcinfo-rumors-seen-v1';
const limit = 600;

export function createRumorFreshness(storage) {
  let known = null;
  try {
    const saved = JSON.parse(storage?.getItem(storageKey) || 'null');
    if (Array.isArray(saved)) known = new Set(saved.map(String));
  } catch { known = null; }
  const fresh = new Set();
  function persist() {
    try { storage?.setItem(storageKey, JSON.stringify([...known].slice(-limit))); } catch { /* Labels still work for this visit. */ }
  }
  return {
    // The first loaded feed is the baseline: nothing is flagged on a first visit.
    observe(keys) {
      if (!known) { known = new Set(keys); persist(); return; }
      for (const key of keys) if (!known.has(key)) fresh.add(key);
    },
    // Seen rumors keep their label for the rest of this visit only.
    markSeen(keys) {
      if (!known) return;
      keys.forEach(key => known.add(key));
      persist();
    },
    isNew(key) { return fresh.has(key); },
  };
}
