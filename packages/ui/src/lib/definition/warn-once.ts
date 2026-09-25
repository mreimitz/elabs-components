/**
 * warn-once — a development-only `console.warn`, once per key per page load.
 *
 * Silent in production builds. The check reads `process.env.NODE_ENV`
 * directly (so bundlers can replace it) inside a `try`, so an environment
 * with no `process` at all counts as development instead of throwing.
 *
 * React-free.
 */

const warned = new Set<string>();

function isProduction(): boolean {
  try {
    return process.env.NODE_ENV === "production";
  } catch {
    return false;
  }
}

/** Logs `message` the first time `key` is seen; later calls with the same key do nothing. */
export function warnOnce(key: string, message: string): void {
  if (isProduction() || warned.has(key)) return;
  warned.add(key);
  console.warn(message);
}

/** Forgets every key already warned about (for tests). */
export function resetWarnOnce(): void {
  warned.clear();
}
