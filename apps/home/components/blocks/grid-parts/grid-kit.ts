// registry: grid-parts — copied 2026-09-25
/**
 * grid-kit — the small helpers every DataGrid block shares: a seeded random
 * source (so fixtures read the same on every render and in every screenshot),
 * ISO day arithmetic against a fixed "today", and a browser download for the
 * bytes `tableToXlsx` / `tableToCsv` return.
 */

/** A fixed "today" so dates, relative filters ("Last 7 days") and screenshots never drift. */
export const GRID_TODAY = new Date(2026, 8, 25);

/** Deterministic PRNG (LCG). Same seed → same fixture. */
export function seeded(seed: number) {
  let state = seed >>> 0;
  const next = () => (state = (state * 1664525 + 1013904223) >>> 0) / 4294967296;
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!,
    /** Picks by weight: `weighted([["a", 3], ["b", 1]])` returns "a" three times as often. */
    weighted: <T>(items: readonly (readonly [T, number])[]): T => {
      const total = items.reduce((sum, [, w]) => sum + w, 0);
      let roll = next() * total;
      for (const [item, w] of items) {
        roll -= w;
        if (roll <= 0) return item;
      }
      return items[items.length - 1]![0];
    },
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** `YYYY-MM-DD` for a local date — the shape the grid's date filter and Excel export read. */
export function isoDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The ISO day `days` before (negative: after) `GRID_TODAY`. */
export function daysAgo(days: number): string {
  return isoDay(
    new Date(GRID_TODAY.getFullYear(), GRID_TODAY.getMonth(), GRID_TODAY.getDate() - days),
  );
}

/** Saves bytes as a file — for `tableToXlsx(table)` or a CSV string. */
export function downloadFile(content: Uint8Array | string, fileName: string, type: string) {
  const blob = new Blob([content as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoke after the click has been handled.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
