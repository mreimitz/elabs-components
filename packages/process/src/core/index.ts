/**
 * `@elabs-ai/components-process/core` — the FRAMEWORK-FREE half of the process package.
 *
 * A gated subpath export (ADR 0006 / ADR 0034): the event-log model, directly-follows
 * derivation, variant grouping and conformance math, with a materially lighter
 * dependency tree than the trunk — no React, no React Flow, no visx. That is what lets
 * a server route, a worker or a unit test import the domain model without pulling a
 * rendering engine.
 *
 * NOTHING in this module may import React or any `@elabs-ai/components-*` package.
 *
 * Wave-1 items APPEND their exports at the end of the block below, each under a
 * `// <Name> — RM-NNN` comment, so concurrent branches merge as appends.
 */

// ── Model & derivation (framework-free) ──────────────────────────────────────
// (empty — the wave-0 scaffold ships no model on purpose; RM-049 onward append here)

export {};
