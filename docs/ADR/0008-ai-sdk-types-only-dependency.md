# ADR 0008 — Vercel AI SDK as a types-only peer dependency

- Status: Accepted
- Date: 2026-06-07

## Context

`@elabs-ai/components-ai` renders the Vercel AI SDK data model — it `import type`s `UIMessage`,
`ToolUIPart`, `FileUIPart`, and friends so its components are typed to the same
message shape the app's runtime produces. Verified at the time of this ADR: **12 of
51 `@elabs-ai/components-ai` source files** import from `ai`, **all `import type`, zero runtime
imports** (no `useChat`, no `@ai-sdk/*` providers, no `streamText`); `ai` was declared
a **peer** dependency at `^6.0.0` as of this ADR's original 2026-06-07 date (see the
2026-08-30 Amendment below for the current range, `^6.0.0 || ^7.0.0`).

That is the right posture — but it is the kind of boundary that erodes by a single
well-meaning edit ("just add `useChat` here for convenience"). The moment a component
imports a runtime _value_ from `ai`, a shallow, swappable type-coupling becomes deep
runtime lock-in, and brand-ui stops being a presentation layer (see
[ADR 0007](./0007-presentation-layer-scope-boundary.md), D5). This is decision **D6**
in [`docs/DECISIONS.md`](../DECISIONS.md).

## Decision

**The Vercel AI SDK (`ai`) is a types-only, peer dependency — never a runtime one.**

- `@elabs-ai/components-ai` may `import type` the message model from `ai`. It must **never** import
  a runtime value from `ai` or any `@ai-sdk/*` package — no `useChat`, `streamText`,
  `generateText`, providers, default/namespace/side-effect/dynamic imports, or value
  re-exports.
- Keep `ai` a **peer** dependency and **pin the major**; treat a major bump as a
  planned migration, not an automatic float. (See the 2026-08-30 Amendment's
  "Reconciling with the Decision" — a migration MAY widen across two majors
  instead of re-pinning, once direct verification shows both are compatible
  for the type surface consumed.)
- **Alias the SDK types behind a brand-ui seam** where practical, so a major bump —
  or a second message model (A2UI/AG-UI) — is a mapping edit, not a repo-wide sweep.
- This is **enforced, not just stated**: the gate `scripts/check-ai-sdk-types-only.mjs`
  fails CI (`pnpm ai:types-only`) on any runtime import, and a warn-only PostToolUse
  hook (`.claude/hooks/check-ai-sdk-types-only.sh`) flags it at edit time. Operational
  rule: [`.claude/rules/ai-sdk-vs-a2ui.md`](../../.claude/rules/ai-sdk-vs-a2ui.md) (D6).

## Alternatives considered

- **Vendor/copy the message types** (no `ai` dependency at all). Maximum
  independence, but the types drift from the SDK on every release and lose ecosystem
  alignment with the runtime the app actually uses. Rejected — the type-coupling is
  cheap and valuable; the runtime-coupling is what's dangerous.
- **Allow the runtime "where convenient."** Best DX in the moment, but it is exactly
  the lock-in this ADR exists to prevent, and it has no natural stopping point.
  Rejected.
- **Types-only peer + enforcement hook (chosen).** Keeps ecosystem alignment (same
  message model as the app's runtime) while structurally preventing runtime coupling.

## Consequences

- The trade is explicit: brand-ui stays **downstream of Vercel's message model** (a
  major SDK bump is a planned migration) in exchange for ecosystem alignment and a
  thin, swappable coupling.
- Adding a runtime value import to `@elabs-ai/components-ai` now fails CI with a pointer to this
  ADR — the regression is blocked, not merely discouraged.
- Revisit trigger: a **vendor-neutral message standard**, or a **second message
  model** (A2UI/AG-UI) arriving in `@elabs-ai/components-ai`, would justify promoting the aliased
  seam into a real abstraction layer (and possibly relaxing the single-vendor pin).
- See `docs/DECISIONS.md` (D6) and the rule above; the boundary it protects is
  ADR 0007 (D5).

## Amendment (2026-08-30) — the peer widens to `^6.0.0 || ^7.0.0` (#30)

- Status: Accepted.
- Scope: updates the peer range in the Context/Decision above (`^6.0.0` →
  `^6.0.0 || ^7.0.0`); the types-only-never-runtime rule itself is unchanged
  and still holds — every import from `ai` in `packages/ai/src/**` stayed
  `import type` throughout this migration. This supersedes the Context
  paragraph's `^6.0.0` figure and the original Decision's "pin the major"
  instruction for **this specific transition** — see "Reconciling with the
  Decision" below.

### Why

The published AI SDK had moved to the 7.x line while this package still peered
on `^6.0.0`, so a fresh install in a consuming app hit an unresolvable peer
conflict (issue #30). Two resolutions were considered: widen the peer to
`^6.0.0 || ^7.0.0` (support both majors), or drop `ai@6` and pin `^7.0.0`
outright.

The dual-major range is what shipped, on **direct verification, not
assumption**: `ai@6.0.0`'s own shipped type declarations (downloaded and read
from the published tarball) already define `LanguageModelUsage` with the
nested `inputTokenDetails` / `outputTokenDetails` shape the fix below relies
on — the flat `reasoningTokens` / `cachedInputTokens` aliases were already
`@deprecated` at `6.0.0`, not something added partway through the 6.x line.
The full post-fix `packages/ai/src` was then compiled against a real,
freshly-installed `ai@6.0.0` (not just the `6.0.197` this repo pins as its
devDependency) with `pnpm --filter @elabs-ai/components-ai typecheck`:
**zero errors.** A narrower `^7.0.0`-only range was drafted in an earlier pass
of this migration on the unverified assumption that the nested shape might be
`ai@7`-only; that assumption was wrong, and dropping v6 support on it would
have broken every consumer still on the 6.x line for no reason.

### What changed

Installing `ai@7.0.85` as the devDependency and running
`pnpm --filter @elabs-ai/components-ai typecheck` against it (the decisive
check — a name-level "does the export still exist" grep is not enough) surfaced
two real, narrow type-shape changes in the surface this package renders:

- **`Tool.description`** (`agent.tsx`, `AgentTool`) can now be a plain string
  **or** a function of the live call context
  (`(options: { context, experimental_sandbox? }) => string`) for a per-call
  dynamic description. `AgentTool` renders a static list with no call context
  to invoke that function with, so it now shows the description only when
  `typeof tool.description === "string"`.
- **`LanguageModelUsage`** (`context.tsx`, `ContextReasoningUsage` /
  `ContextCacheUsage`) reads `outputTokenDetails.reasoningTokens` and
  `inputTokenDetails.cacheReadTokens` instead of the flat, deprecated aliases.
  Both fields — nested shape and flat alias — are present in `ai@6.0.0`
  through `ai@7.0.85`, so this read works unchanged across the whole widened
  range; it only stops leaning on the aliases `ai@7` removed.

Both fixes are additive narrowing on the consuming side — neither introduces a
runtime import from `ai`. `pnpm ai:types-only` and the full `@elabs-ai/components-ai`
test suite (430 tests) stayed green throughout, compiled against **both**
floor (`ai@6.0.0`) and ceiling (`ai@7.0.85`) of the declared range.

### `peerDependenciesMeta` — declared optional

`packages/ai/package.json` now also declares
`peerDependenciesMeta: { ai: { optional: true } }`, per issue #30's second
suggestion. Rationale: `ai` reaches only 12 of 51 `@elabs-ai/components-ai`
source files, purely as `import type`, so a consumer who imports none of
those types (a subset of the surface that doesn't touch messages/tools/usage)
has nothing to satisfy at runtime — the same reasoning already applied to
every optional peer in `packages/viewer/package.json`. Marking it optional
silences the peer-conflict warning for that consumer without weakening the
gate: `pnpm ai:types-only` still fails on any runtime import regardless of
how the peer is declared.

### Node engine floor — noted, not changed

`ai@7.0.85` declares `engines.node: >=22`; this repo's own `engines.node`,
`.nvmrc`, and all 4 GitHub Actions workflows are pinned to Node `20`
(`ai@6.0.197`, by contrast, only requires `>=18`, comfortably under the
repo's floor). `engine-strict` is unset in both this repo's `.npmrc` and the
ambient npm/pnpm config, which defaults it to `false` — an engine mismatch
warns, it does not fail an install or a CI run. This migration does **not**
change the repository's Node baseline: that is a separate, larger decision
(every workflow's `node-version`, `.nvmrc`, and `engines.node`) out of scope
for a peer-range fix, and is left as a follow-up to evaluate independently.
A consumer who installs `ai@7` on Node 20 will see pnpm's engine warning but
the install will proceed; a consumer who needs the warning silenced or who
hits a genuine `ai@7` runtime requirement on Node `>=22` should upgrade their
own Node version — this package cannot do that for them.

### Reconciling with the Decision

The original Decision text says to "pin the major; treat a major bump as a
planned migration, not an automatic float." This amendment widens instead of
re-pinning because the verification above showed both majors genuinely
compatible for the type surface this package consumes — "pin the major" is
the right default when compatibility is unverified or false, not a mandate to
narrow a range that measurement shows is safe to widen. The next major (`ai@8`,
if and when it changes a type this package depends on) should repeat this same
verification before deciding whether to widen further or finally drop `ai@6`.

### Consequence

`@elabs-ai/components-ai` now installs alongside either `ai@6` or `ai@7`. See the
`CHANGELOG.md` `## Unreleased` entry for the consumer-facing summary.
