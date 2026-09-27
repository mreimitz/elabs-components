/**
 * DG-24 — the nearest known `vendor/name` to a mistyped one, for the validator's "Did you
 * mean" and `catalogService.suggest`. React-free. Edit distance on the whole name; a
 * candidate from the same vendor wins a tie. `undefined` when nothing is close enough
 * (more than a third of the name's length, at least 2 edits).
 */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j]! + 1,
        current[j - 1]! + 1,
        previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length]!;
}

export function nearestName(name: string, names: Iterable<string>): string | undefined {
  const limit = Math.max(2, Math.floor(name.length / 3));
  const vendor = name.split("/")[0];
  let best: string | undefined;
  let bestScore = Infinity;
  for (const candidate of names) {
    const distance = editDistance(name, candidate);
    if (distance > limit) continue;
    // Same vendor breaks ties: half an edit cheaper.
    const score = distance - (candidate.split("/")[0] === vendor ? 0.5 : 0);
    if (score < bestScore || (score === bestScore && best !== undefined && candidate < best)) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}
