/**
 * Dev-only warnings for the silent failure modes a map wrapper cannot type away
 * — a plan coordinate handed to a geographic canvas, a missing `promoteId`, a
 * GeoJSON URL that cannot be transformed. Mirrors `warnChartOnce` in
 * `@elabs-ai/components-charts` (kept local: `dep-direction` forbids the import).
 */

const warned = new Set<string>();

/** `console.warn` once per `key` per page load, and never in production. */
export function warnMapOnce(key: string, message: string): void {
  if (process.env.NODE_ENV === "production") return;
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[maps] ${message}`);
}

/** Test-only: forget which warnings have already fired. */
export function resetMapWarnings(): void {
  warned.clear();
}
