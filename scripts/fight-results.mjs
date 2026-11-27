// Shared by scripts/build-fight-history.mjs and its test: how a completed bout ended.
// red / blue / draw / nc: the result from the red corner's point of view is enough for both fighters.
export function boutResult(bout) {
  if (/empate|draw/i.test(bout.outcome || '')) return 'draw';
  if (bout.winner === bout.red) return 'red';
  if (bout.winner === bout.blue) return 'blue';
  if (/no contest|sin resultado|could not continue|\bnc\b/i.test(`${bout.outcome || ''} ${bout.method || ''}`)) return 'nc';
  return null;
}
