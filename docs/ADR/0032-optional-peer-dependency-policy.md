# ADR 0032 — Optional peer dependency policy (lazy engines vs. synchronous bindings)

- **Status:** Accepted (partial implementation — see Scope)
- **Date:** 2026-09-01
- **Context:** issue #33 (`@elabs-ai/components-ai`'s mermaid / `@rive-app/react-webgl2` /
  `@xterm/addon-fit` / `@xterm/xterm` / `media-chrome`), linked by the maintainer to
  issue #26 (`@elabs-ai/components-ui`'s `react-hook-form` / `@hookform/resolvers`)
  as "the same class of decision in a second package" — see the 2026-08-30 comments
  on #33 for the full reasoning this ADR distills.
- **Extends:** ADR [0019](./0019-lazy-engine-boundaries.md) (lazy engine boundaries) —
  that ADR decided an engine is _reached_ through `import()`; this one decides how
  that engine's package is _declared_ in `package.json` once it is.
- **Relates to:** ADR [0006](./0006-subpath-exports.md) (subpath exports) — this ADR's
  §"Synchronously-bound peers" is the subtractive reading of that ADR's condition 2
  ("a real consumer needs the leaf without the trunk") applied in reverse: instead of
  adding a lighter leaf, the trunk barrel loses a heavy part to make it possible for
  a consumer to skip that part's dependency. `packages/viewer/package.json`'s existing
  seven optional peers (papaparse / pdfjs-dist / mammoth / xlsx / jszip / shiki /
  streamdown) are the pattern both variants below build on.

## Context

Two `@elabs-ai/components-*` packages force every consumer to install a dependency
they may never exercise, for two **structurally different** reasons:

1. **`@elabs-ai/components-ai`** (#33) declares mermaid, `@rive-app/react-webgl2`,
   `@xterm/addon-fit`, `@xterm/xterm` and `media-chrome` as plain `dependencies`,
   even though ADR 0019 already reaches every one of them through a dynamic
   `import()` — `pnpm heavy-deps:check` was already green (0 eager sites) before
   this ADR. The barrel (`@elabs-ai/components-ai`'s `src/index.ts`) never imports
   these packages directly; only the `_<engine>` lazy-boundary modules do, from
   inside an effect or an async loader function, never at module scope.
2. **`@elabs-ai/components-ui`** (#26) binds `react-hook-form` **synchronously**:
   `useFormContext` is a hook called inside `useFormField`, and `Form` / `FormField`
   / `Controller` are eager top-level bindings a bundler must resolve to build the
   barrel at all. A `brand-ui-design-system-architect` review of the attempted fix
   (branch `agents/form-primitives`, not merged) found there is **no** `import()`
   boundary that can isolate a React hook's synchronous binding the way ADR 0019
   isolates an engine's `render()` call — the dependency is load-bearing for the
   barrel to type-check and run at all, not merely reachable from it.

Treating both as the same fix (peer + optional, done) would be wrong: (1) can move
to `peerDependencies` with the barrel untouched, so no consumer's working code
changes shape. (2) cannot — the _only_ way to make `react-hook-form` optional is to
remove `Form`/`FormField`/`FormItem`/`FormControl`/`FormLabel`/`FormMessage`/
`useFormField` from the main barrel and move them to a dedicated
`@elabs-ai/components-ui/form` subpath, which breaks every existing import of
`Form` from `@elabs-ai/components-ui` directly.

## Decision

**One policy, two variants, picked by whether the dependency is reached lazily or
bound synchronously — never a case-by-case call per package.**

### Variant A — Lazily-reached engine (non-breaking): optional peer + `import()`

Applies when ADR 0019 already isolates the dependency behind a dynamic `import()`
(or can be made to): the package's barrel never touches the dependency at module
scope, so removing it from `dependencies` changes nothing about what the barrel
exports or how it type-checks.

1. **Declare it `peerDependencies` + `peerDependenciesMeta.<name>.optional: true`**
   (the `packages/viewer/package.json` precedent). Keep it as a `devDependency` too,
   so this repo's own build/test/Storybook still install it.
2. **Every lazy boundary must fail without crashing or unhandled-rejecting**, when
   the peer is genuinely absent — but the shipped implementation deliberately does
   **not** use one uniform visual for this across the four engines, and this ADR
   records that as an intentional, disclosed choice rather than an oversight:
   - **`InteractiveTerminal`** (no natural resting visual — a blank terminal reads
     as broken) renders `StatePanel kind="empty"`, naming the exact packages to
     install (`"@xterm/xterm, @xterm/addon-fit"`) in the body text. `kind="empty"`,
     not `kind="error"`: per `loading-states.md`, `kind="error"` is for a
     terminal, settled _failure_ of something that was expected to work, and a
     peer the consumer never installed is a missing capability, not a broken one.
   - **`Persona`** already has a static resting illustration
     (`PersonaFallback`) for its normal loading/failed states, so a missing peer
     reuses that same placeholder rather than replacing the persona with a text
     panel; the actionable "install `@rive-app/react-webgl2`" detail goes to
     `console.error` (visible to the developer, not the end user) instead of the
     rendered surface, since interrupting a decorative avatar with an error card
     is a worse default than a quiet, on-brand fallback.
   - **`AudioPlayer`** and its individually-exported sub-controls (`MediaPlayButton`,
     `MediaTimeRange`, …) render a `Skeleton` (the composed player) or `null` (a
     bare sub-control, which cannot render anything meaningful outside its parent's
     `MediaController` context) rather than a text panel — the same reasoning as
     `Persona`: an inline media control is a small, decorative surface where a
     StatePanel-sized message would be disproportionate.
   - **`MarkdownView`'s Mermaid diagrams** get a fourth, content-shaped variant —
     `_mermaid-error-panel.tsx` renders an in-place card where the diagram would
     have been, since there is no panel slot to redirect to inside streamed
     markdown content.

   The common contract across all four is narrower than "always show
   `StatePanel kind='error'` naming the package": it is _never a blank component
   masquerading as success, and never an unhandled rejection_ — surfacing the
   actionable package name is done wherever the surface has a legible piece of
   text to say it (`InteractiveTerminal`, the Mermaid panel) and left to the
   console where the alternative is degrading a decorative visual
   (`Persona`, `AudioPlayer`). A future engine added under this ADR should default
   to the visible, named-package treatment unless it has a `Persona`/`AudioPlayer`
   -style resting visual that a text panel would only make worse.

3. **This does not need a major version.** An app that already declares the engine
   itself is unaffected; an app that doesn't gets the actionable message instead of
   a crash, which is a strict improvement over today's unhandled-rejection risk.

**The build-time trap this variant must avoid (found while implementing #33):**
a lazy boundary module must import the peer with a **genuinely dynamic,
function-scoped `import()`** — never a static or namespace import at module scope,
even one used only internally. When a peer is declared optional and is genuinely
absent from `node_modules`, Vite substitutes a build-time stub with no real
exports; Rollup's strict ESM named-export validation then fails the **consumer's
entire app build** on a `"X" is not exported by "__vite-optional-peer-dep:…"`
error — not a runtime rejection any `.catch()` could ever see. This is not
theoretical: it reproduced against `fixtures/consumer-smoke`'s real Vite build for
every one of the four engines here.

- A namespace import destructured at module scope
  (`import * as X from "peer"; const { Foo } = X;`) looks safer but is **not
  sufficient on its own** — Rollup's `resolveNamespaceVariables` optimization can
  re-derive it back into an equivalent static named binding. The refined criterion
  (found during the `brand-ui-design-system-architect` review of this change) is
  **static resolvability, not "was it re-exported"**: re-export is one way Rollup's
  analysis reaches a namespace binding, but a bare **member expression on the
  namespace object** (`RiveModule.useRive(...)`), used only internally and never
  re-exported, is traceable the same way. Only **destructuring** the namespace
  object into local bindings (`const { useRive } = RiveModule;`) reliably escapes
  the optimization — a member expression does not. `_persona-rive.tsx` and
  `_audio-player-media-chrome.tsx` destructure their peer's exports and consume
  them only internally (never re-exported, and never accessed as
  `Module.member` after the destructure), which is why the namespace-import form
  was sufficient there, confirmed empirically against a full `pnpm consumer:check`
  run — not because re-export is the only failure mode.
- `_interactive-terminal-xterm.ts` re-exports its peer's classes for
  `interactive-terminal.tsx` to consume, so the namespace-import form was **not**
  sufficient — Rollup traced straight through it to the same missing-export
  failure. The fix is `_lazy-mermaid.ts`'s own pattern: defer the peer's import to
  be genuinely dynamic, called from **inside an exported async loader function**
  (`loadXTermEngine()`), so its resolved shape is opaque to static analysis and a
  missing peer surfaces as an ordinary rejection reaching the caller's `.catch()`.
- **Going forward, the function-scoped async-loader form
  (`_lazy-mermaid.ts`/`_interactive-terminal-xterm.ts`'s shape) is the preferred,
  single pattern for a NEW lazy boundary under this ADR** — it is correct
  regardless of re-export, member-expression access, or any other shape of
  internal use, and does not depend on correctly predicting which of those a
  future refactor might introduce. The namespace-import-plus-guard form used in
  `_persona-rive.tsx` and `_audio-player-media-chrome.tsx` is **grandfathered**,
  not equally sanctioned for new code: it is verified sufficient for its own two
  call sites today, but its safety is a property of how those two modules happen
  to consume the peer, not a general guarantee — a future edit to either file that
  adds a re-export or a namespace member-expression would silently reopen the
  build-time trap this section exists to close. Migrating them to the loader form
  is a welcome future cleanup, not required by this change.
- **Verify against a real `pnpm consumer:check` run with the peer genuinely
  absent, not against typecheck or unit tests alone** — neither bundles a real
  consumer app, so neither can see this failure mode.

### Variant B — Synchronously-bound peer (breaking): subtractive subpath split

Applies when the dependency is a load-bearing, eager binding the barrel cannot
type-check or run without (a hook called inside another hook, a component that
`extends` a base class from the dependency, anything a bundler must resolve to
build the barrel module graph at all — not merely "would be nice to lazy-load").

1. **The bound parts move out of the main barrel** into a dedicated subpath
   (`@elabs-ai/components-ui/form`, per #26) that carries the dependency as its own
   `peerDependencies` + `optional: true` entry. The main barrel no longer imports
   the subpath, so a consumer who never imports `@elabs-ai/components-ui/form`
   never needs the dependency at all.
2. **This is inherently breaking** — every existing `import { Form } from
"@elabs-ai/components-ui"` must become `import { Form } from
"@elabs-ai/components-ui/form"`. There is no non-breaking version of this move;
   don't attempt one.
3. Route it through `brand-ui-design-system-architect` and `component-api.md`'s
   subpath-export gate exactly as any other new subpath would be — the fact that
   this subpath is _subtractive_ (moving something out of the barrel) rather than
   _additive_ (a new lighter leaf) does not exempt it from that review.

### Release discipline

**Ship both variants in the same major version, not as two lockstep breaking
releases** — the maintainer's explicit 2026-08-30 decision on #33. Variant A alone
is non-breaking and could ship on its own, but bundling it with Variant B's breaking
subpath split means existing consumers absorb one migration, with one note, instead
of two majors in quick succession for the same underlying policy.

## Scope of this change

**This ADR documents the whole-repo policy. Only Variant A is implemented here**,
for the four engines named in #33: `packages/ai/package.json` (the peer
declarations), `_lazy-mermaid.ts` (the empty-stub shape guard),
`_lazy-engine-boundary.tsx` (the render-phase error boundary all four lazy
`import()`s share), `_optional-peer.ts` (the missing-peer detector),
`_interactive-terminal-xterm.ts`, `_persona-rive.tsx`,
`_audio-player-media-chrome.tsx`, the surfaces that render each engine's
missing-peer state (`interactive-terminal.tsx`, `persona.tsx`, `audio-player.tsx`,
`markdown-view.tsx`, `message.tsx`, `reasoning.tsx`, `_mermaid-error-panel.tsx`),
`packages/ui/src/components/locale-provider/messages.ts` (the microcopy those
surfaces render), and the `fixtures/consumer-smoke` optional-peer-absent proof.
**Variant B — the `@elabs-ai/components-ui/form` subpath split for
`react-hook-form` (#26) — is _not_ implemented by this change.** #26 stays open,
tracked separately, and must land in the same major version as this change per the
maintainer's decision above; it is not silently satisfied by this ADR existing.

**A residual specific to this implementation, disclosed rather than hidden:**
**two** of `@elabs-ai/components-ai`'s own plain `dependencies` — `streamdown`
and `@streamdown/mermaid` — each declare `mermaid` as their own plain,
non-optional `dependency`. Every package manager therefore installs
`mermaid`'s bytes regardless of what a consumer's own manifest says; a
hoisting layout additionally makes `import("mermaid")` resolve, in which case
the capability-gap panel never renders for that consumer — this ADR's
guarantee is "you are not required to declare it yourself and an unresolved
engine fails actionably," not "the bytes are provably absent from disk."
`scripts/check-optional-peer-transitives.mjs` (`pnpm optional-peers:check`,
issue #94) makes this residual provable rather than merely disclosed: it
cross-references every optional peer against the resolved transitive closure
of its package's own dependencies (read from `pnpm-lock.yaml`, no install)
and fails CI both if a NEW optional peer becomes defeated this way and if this
baselined one becomes clean — so a future upstream fix is caught by the gate,
not left to a human noticing.

## Consequences

- **Not risk-free for every existing consumer, despite being non-breaking for
  most.** A consumer who already declares all five packages themselves is
  unaffected — peer resolution is satisfied either way. But a consumer who was
  relying on one of these five arriving **transitively** (installed only because
  `@elabs-ai/components-ai` used to declare it as a plain dependency, never
  declared by the consumer's own manifest) now sees a `peerDependenciesMeta`
  warning at install time under a package manager that enforces peer strictness
  (this repo's own `fixtures/consumer-smoke` does, via `strict-peer-dependencies`
  in its `.npmrc`), and must add the peer to their own `package.json` to silence
  it. That case is real, not hypothetical — it is exactly the shape
  `pnpm consumer:check` exists to catch. The major-version bump is earned by
  Variant B, once #26 lands alongside this change; Variant A's own risk is
  smaller than a breaking change but is not zero.
- **Every future heavy dependency added to `@elabs-ai/components-*` is classified
  before it ships**: lazy-reachable → Variant A from day one (never start as a
  plain `dependency` and migrate later); synchronously-bound → Variant B, decided
  and reviewed before the API ships, not retrofitted as a breaking change later.
- **`pnpm consumer:check` is now load-bearing for this class of bug.** Neither
  `pnpm --filter @elabs-ai/components-ai typecheck` nor its unit test suite can see
  the Vite/Rollup static-import failure described under Variant A — it only
  reproduces in a real bundler build of a real consumer app with the peer
  genuinely absent from `node_modules`. Any future engine added under this ADR
  must be verified the same way before being called done.
- **The empty-stub survival mechanism above is Vite-specific, and this guarantee
  does not port to every bundler `docs/CONSUMING.md` promises support for.**
  Vite's `__vite-optional-peer-dep:` substitution — an empty module standing in
  for a genuinely-absent optional peer, rather than a hard resolve failure — is
  what lets a dynamic `import()` degrade to a runtime rejection instead of a
  build-time error. webpack 5 and Next.js's webpack-based build have no
  equivalent: an unresolvable bare specifier is a hard `Module not found` build
  error there, for **both** a static import and a genuinely dynamic `import()`.
  This exposure is not new to this change — `@elabs-ai/components-viewer`'s
  optional-peer precedent (papaparse, pdfjs-dist, mammoth, xlsx, jszip, shiki,
  streamdown) carries the identical bundler dependency and was previously
  undocumented — but it means the "actionable message, not a build failure"
  guarantee in this ADR is proven only for Vite, which is what
  `fixtures/consumer-smoke` builds with. A webpack 5/Next.js consumer that skips
  an optional peer entirely (rather than merely not rendering the feature) may
  still see a build-time failure instead of the actionable runtime message;
  closing that gap is future work, not covered by this change.

## Alternatives rejected

- **Subpath exports for the four `@elabs-ai/components-ai` engines**, mirroring
  Variant B — rejected in #33 itself: subpath exports only change what a _bundler_
  traces, not what `pnpm install` _resolves_, and per `component-api.md`'s subpath
  gate they are not warranted for a leaf that is already unreachable from the
  barrel via ADR 0019's `import()` boundary. Variant A's optional peer already
  solves the install-footprint problem without an API-shape change.
- **Two separate, sequential majors** (ship #33 alone, then #26 alone) — rejected
  by the maintainer's 2026-08-30 decision: both are the same class of policy
  decision, and shipping them apart would mean consumers absorb two dependency
  policy migrations for one underlying rule instead of one.
- **A blanket rule of "always optional-peer a heavy dependency"** with no lazy/
  synchronous distinction — rejected because it would either (a) silently break
  `@elabs-ai/components-ui`'s barrel for `react-hook-form` users with no `import()`
  boundary to fall back on, or (b) block `@elabs-ai/components-ai`'s engines behind
  an unnecessary subpath split they don't need. The distinction is the whole
  point of this ADR.
