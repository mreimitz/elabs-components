/**
 * Deterministic data rows for the dashboard fixtures' `chart` tiles (RM-077). Seeded via
 * `seededRnd` (`../../marks/seeded-rnd`) — the only randomness `@elabs-ai/components-charts`
 * allows (`charts-honesty`) — so every fixture renders the same marks on every run, in every
 * theme, in a Storybook snapshot and in a play-function assertion alike.
 */
import { seededRnd } from "../../../marks/seeded-rnd";

/** One row of a fixture's dataset: an `x` category plus one numeric value per series key. */
export type FixtureRow = { x: string } & Record<string, number | string>;

const PERIODS = Array.from({ length: 24 }, (_, i) => `P${i + 1}`);
const SERIES_KEYS = Array.from({ length: 12 }, (_, i) => `s${i + 1}`);

/**
 * 24 rows across up to 12 series (the "12 × 24" fixture shape), each value a seeded upward
 * drift plus jitter so a line trends rather than reading as static noise. `seed` decorrelates
 * one fixture's rows from another's (vary it per tile, not per row).
 */
export function makeRows(
  seriesKeys: readonly string[] = SERIES_KEYS,
  seed = 0,
  base = 10,
  spread = 20,
): FixtureRow[] {
  return PERIODS.map((x, i) => {
    const row: FixtureRow = { x };
    seriesKeys.forEach((key, k) => {
      const drift = (i / PERIODS.length) * spread * 0.5;
      row[key] = Math.round((base + drift + seededRnd(i, seed + k) * spread) * 100) / 100;
    });
    return row;
  });
}

/** `{ key, label }` series definitions for `seriesKeys`, e.g. for a `ChartSpec`-shaped content. */
export function makeSeries(
  seriesKeys: readonly string[],
  labelPrefix = "Series",
): Array<{ key: string; label: string }> {
  return seriesKeys.map((key, i) => ({ key, label: `${labelPrefix} ${i + 1}` }));
}
