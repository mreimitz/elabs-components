/**
 * Detect a dynamic `import()` of an OPTIONAL peer that is not installed
 * (issue #33 — mermaid / xterm / Rive / media-chrome are optional peers of
 * `@elabs-ai/components-ai`, reached only through its lazy boundaries:
 * `_lazy-mermaid.ts`, `_interactive-terminal-xterm.ts`, `_persona-rive.tsx` and
 * `_audio-player-media-chrome.tsx`).
 *
 * Bundlers and runtimes report this differently (`ERR_MODULE_NOT_FOUND`,
 * `Cannot find module`, `Failed to resolve module specifier`, Vite/browser's
 * `Failed to fetch dynamically imported module`), so match on the SHAPES
 * rather than one runtime's wording. A false positive here is cheap — the
 * developer is told to install a package instead of seeing a raw
 * module-resolution stack trace — and a false negative is the failure mode
 * this exists to avoid.
 *
 * **Canonical home (promoted here per
 * `docs/decisions/2026-09-01-brainless-adoption-architecture.md` § 2).** `ui` is
 * upstream of every layer-2 package (`ai`, `terminal`, …) in the one-way
 * package graph (`tokens` → `ui`/`icons` →
 * `data`/`ai`/`flow`/`maps`/`charts`/`marketing`/`editor`/`viewer`), so this is
 * an ordinary downward import for all of them — unlike the sibling-to-sibling
 * case (e.g. `ai` ↔ `viewer`), which the graph forbids and which is why a
 * safety-critical predicate like this one must never be copy-pasted sideways
 * again. `packages/ai/src/_optional-peer.ts` still exists as a private,
 * underived-prefixed module for one merge window (issue #116 deletes it and
 * rewires its three importers onto this one); nothing imports this copy yet.
 *
 * It does NOT mirror `@elabs-ai/components-viewer`'s PRIMARY mechanism: the
 * viewer's adapters throw a typed `ViewerError` carrying `code`/`packages`
 * fields, and only fall back to string-matching for an error that didn't
 * originate as one. This module has no typed-error primary path — every lazy
 * boundary that uses it classifies purely by matching the caught error's
 * message shape. That difference is why a shape mismatch (a resolved module
 * with the wrong exports, rather than a rejected import) can slip past this
 * detector silently instead of being caught by construction — see
 * `_lazy-mermaid.ts`'s `loadEngine()` guard, added for exactly that gap
 * (issue #33 review).
 */
const MODULE_NOT_FOUND_PATTERN =
  /cannot find module|failed to resolve|dynamically imported module|module not found/i;

/** True when a raw error MESSAGE names a module the runtime could not load. */
export function isModuleNotFoundMessage(message: string): boolean {
  return MODULE_NOT_FOUND_PATTERN.test(message);
}

/**
 * True when `value` is (or looks like) a failed dynamic `import()` of a
 * missing optional peer. Accepts anything a `.catch()` or an error boundary
 * might see: an `Error` instance (checked by `code` first, then message), or
 * `undefined`/other for anything that clearly is not one.
 */
export function isOptionalPeerMissing(value: unknown): boolean {
  if (!(value instanceof Error)) return false;
  if ("code" in value && (value as { code?: unknown }).code === "ERR_MODULE_NOT_FOUND") {
    return true;
  }
  return isModuleNotFoundMessage(value.message);
}
