/**
 * Deterministic seeded PRNG for every fixture in this folder (RM-095).
 *
 * `@elabs-ai/components-charts` exports NO public `seededRnd` — it lives at
 * `packages/charts/src/marks/seeded-rnd.ts`, reachable only by a relative import from
 * inside that package's own `src/` tree (see `packages/charts/src/dashboard/fixtures/rows/
 * generate.ts`). `apps/home` may import only `@elabs-ai/*` package ENTRY points
 * (`pnpm check --rule home-imports`), so this folder cannot reach it. `mulberry32` below is
 * the same well-known 32-bit generator `@elabs-ai/components-process`'s own seeded fixture
 * (`packages/process/src/core/fixtures/synthetic-log.ts`) already uses for exactly this
 * reason — a small, auditable, dependency-free PRNG — not `Math.random`, so every fixture
 * here is reproducible across processes and runs (`fixtures.test.ts` "seed determinism").
 *
 * If a future change exports `seededRnd` from the package's public surface, this module can
 * be retired in favour of it; until then it is the documented stand-in.
 */

/** A deterministic 32-bit PRNG (mulberry32). Same seed → same infinite sequence, forever. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick one element of `items` deterministically from a `[0, 1)` draw. */
export function pick<T>(items: readonly T[], draw: number): T {
  const index = Math.min(items.length - 1, Math.floor(draw * items.length));
  return items[index]!;
}

/** An integer in `[min, max]` (inclusive) from a `[0, 1)` draw. */
export function intBetween(min: number, max: number, draw: number): number {
  return min + Math.floor(draw * (max - min + 1));
}

/**
 * Fisher–Yates shuffle of `[0, n)` seeded by `seed` — used wherever a fixture needs an EXACT
 * count of "special" items spread deterministically through a larger set (e.g. the process
 * log's slow-variant share) rather than a per-item probability whose total only converges.
 */
export function seededShuffledIndices(n: number, seed: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  const rnd = mulberry32(seed);
  for (let i = n - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}
