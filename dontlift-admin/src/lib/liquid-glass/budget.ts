/* Adapted from the Crenspire Glass UI rendering contract; see docs/third-party-notices.md. */
export interface ShapeCandidate {
  id: number;
  parent: number | null;
  area: number;
}

/** Pick the largest visible glass surfaces; only one nested glass layer is supported. */
export function selectShapes(candidates: ShapeCandidate[], limit: number): Map<number, number> {
  const ranked = [...candidates].sort((left, right) => right.area - left.area);
  const chosen = new Map<number, number>();
  for (const candidate of ranked) {
    if (chosen.size >= limit) break;
    if (candidate.parent === null) {
      chosen.set(candidate.id, 0);
      continue;
    }
    const parentDepth = chosen.get(candidate.parent);
    if (parentDepth === 0) chosen.set(candidate.id, 1);
  }
  return chosen;
}
