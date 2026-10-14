// Keep expanded results through profile dialogs and background data refreshes.
export function createCatalogPagination(pageSize = 24) {
  let key = null, limit = pageSize;
  return {
    select(items, filters) {
      const next = JSON.stringify(filters);
      if (next !== key) { key = next; limit = pageSize; }
      return {items: items.slice(0, limit), total: items.length, shown: Math.min(limit, items.length), hasMore: items.length > limit};
    },
    more() { limit += pageSize; },
  };
}
