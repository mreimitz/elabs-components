/**
 * Shared by Dumbbell's `variant="slope"` end labels and Bump's rank labels —
 * both need the same "keep every label legible, never overlapping" pass over
 * a column of values. Pure, framework-free.
 */

/**
 * Greedily separates `values` so no two are closer than `minGap`, preserving
 * relative order, then (if the pass overflows `extent[1]`) walks backward from
 * the bound to keep every label inside `extent`. Returns adjusted values in the
 * SAME order as the input (not sorted).
 *
 * BOUNDS ALWAYS WIN. When honouring `minGap` for every label would need more
 * room than `extent` has — `(n - 1) * minGap > hi - lo` — the function no
 * longer tries: it distributes the values evenly across `[lo, hi]` in sorted
 * order instead, accepting a gap smaller than `minGap`. Every returned value
 * is guaranteed `lo <= v <= hi`, unconditionally: a label placed outside the
 * plot points at nothing and may be clipped entirely, while a label a little
 * closer to its neighbour than ideal is still legible and still points at the
 * right mark (#281).
 *
 * This is the "legible fallback" the slope variant leans on past 8 rows: rather
 * than let two nearby values print on top of each other, every label keeps its
 * `minGap` of breathing room (when the extent has room to give) and a short
 * leader (drawn by the caller) can point back at the true position.
 */
export function spaceSlopeLabels(
  values: number[],
  minGap: number,
  extent: [number, number],
): number[] {
  const n = values.length;
  if (n === 0) {
    return [];
  }
  const [lo, hi] = extent;
  const order = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);

  // Feasibility guard (#281): `minGap` for every label cannot fit inside
  // `extent`. Rather than let the passes below compose into an out-of-range
  // arithmetic progression, honour the BOUNDS instead — spread evenly across
  // `[lo, hi]` in sorted order.
  const available = hi - lo;
  const required = (n - 1) * minGap;
  if (n > 1 && required > available) {
    const step = available / (n - 1);
    const out = new Array<number>(n);
    order.forEach((entry, i) => {
      out[entry.index] = lo + i * step;
    });
    return out;
  }

  const adjusted = order.map((entry) => entry.value);
  for (let i = 1; i < n; i++) {
    const prev = adjusted[i - 1] as number;
    const current = adjusted[i] as number;
    if (current - prev < minGap) {
      adjusted[i] = prev + minGap;
    }
  }

  const last = adjusted[n - 1] as number;
  if (last > hi) {
    adjusted[n - 1] = hi;
    for (let i = n - 2; i >= 0; i--) {
      const next = adjusted[i + 1] as number;
      const current = adjusted[i] as number;
      if (next - current < minGap) {
        adjusted[i] = next - minGap;
      }
    }
  }
  const first = adjusted[0] as number;
  if (first < lo) {
    adjusted[0] = lo;
    for (let i = 1; i < n; i++) {
      const prev = adjusted[i - 1] as number;
      const current = adjusted[i] as number;
      if (current - prev < minGap) {
        // Belt-and-braces (#281): the feasibility guard above means this
        // branch is now only reached on genuinely feasible input, so `hi`
        // never actually binds here — but bounding it keeps the function
        // provably in-range even if a future pass is added upstream.
        adjusted[i] = Math.min(prev + minGap, hi);
      }
    }
  }

  const out = new Array<number>(n);
  order.forEach((entry, i) => {
    out[entry.index] = adjusted[i] as number;
  });
  return out;
}
