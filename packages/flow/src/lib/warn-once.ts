/**
 * Only the shape used here. Keeping the bare expression `process.env.NODE_ENV` is what
 * lets every bundler replace it at build time and drop the warning from production
 * bundles — a `typeof process` guard survives the replacement and, in a browser, lets
 * the warning through. Same pattern as `@elabs-ai/components-tokens`' `derive-theme.ts`.
 */
declare const process: { env: { NODE_ENV?: string } };

const warned = new Set<string>();

/**
 * Dev-only `console.warn`, once per `key` per page load.
 *
 * The deprecation channel for flow's rename-with-aliases layer: an old name keeps
 * working until 6.0.0 and says so once, not once per render. It mirrors charts'
 * `warnChartOnce`; both are due to become one shared `warnOnce` in
 * `@elabs-ai/components-ui` when the shared definition base lands.
 */
export function warnFlowOnce(key: string, message: string): void {
  if (process.env.NODE_ENV === "production") return;
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[@elabs-ai/components-flow] ${message}`);
}

/** Test-only: forget every key already warned about. */
export function resetFlowWarnings(): void {
  warned.clear();
}
