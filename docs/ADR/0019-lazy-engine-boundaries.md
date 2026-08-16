# ADR 0019 — Lazy engine boundaries in `@elabs-ai/components-ai`

- **Status:** Accepted
- **Date:** 2026-08-01
- **Context:** consumer report (a workbench app) item #7; issue: eager Mermaid in
  the entry chunk
- **Renumbered:** originally filed as ADR 0016, which collided with
  [`0016-distribution-via-github-packages.md`](./0016-distribution-via-github-packages.md)
  (both merged the same day claiming the same number); renumbered to 0019, the next
  free slot after 0018, with no change in content or status.

## Context

`@elabs-ai/components-ai` imported `@streamdown/mermaid` statically from three modules —
`message.tsx`, `reasoning.tsx`, `markdown-view.tsx` — each building a
module-level `const streamdownPlugins = { cjk, code, math, mermaid }`. That
package's dist opens with `import n from "mermaid"`, and **none** of
`@streamdown/mermaid`, `mermaid`, `dompurify`, `d3` or `streamdown` declares
`sideEffects`, so a bundler must retain the edge. The result: Mermaid, d3 and
DOMPurify landed in the **entry chunk** of every consumer, including the large
majority who never render a diagram.

`packages/ai/package.json` sets `"sideEffects": false`, but that frees only
**our own** modules — it says nothing about a dependency. Streamdown's own
`import('./mermaid-*.js')` looks like a split but resolves to a 60-byte re-export
shim back into its main chunk, so it buys nothing.

Measured on `apps/playground`: entry chunk **6,231,119 B**, and it was the only
chunk containing DOMPurify's `data-tt-policy-suffix`, mermaid's `flowchart-v2`,
and d3's `__data__`.

## Decision

**An engine is reached through a dynamic `import()`, never a static edge.**

"Engine" means a dependency that is a runtime in its own right rather than a
component: Mermaid (and its d3/DOMPurify tail), the Rive WebGL2 runtime, xterm,
React Flow, media-chrome.

For Mermaid specifically we do **not** lazy-load the plugin object — we lazy-load
the engine _behind_ it. `DiagramPlugin` is not the engine; it is a lazy accessor:

```ts
interface DiagramPlugin {
  name: "mermaid";
  type: "diagram";
  language: string;
  getMermaid: (config?: MermaidConfig) => MermaidInstance;
}
```

Streamdown calls `getMermaid()` **only** from inside its async diagram-render
path, immediately before `await instance.render(...)` — never at module or
component init. So `packages/ai/src/_lazy-mermaid.ts` provides a drop-in
`DiagramPlugin` whose `render()` does `await import("mermaid")`. The upstream
plugin is ~10 lines; its defaults (`securityLevel: "strict"`, `startOnLoad:
false`, `suppressErrorRendering: true`, …) and initialize-once semantics are
mirrored exactly, and its `DiagramPlugin` type is still imported (as a type, so
it erases) to keep the reimplementation honest at typecheck time.

`mermaid` becomes a direct dependency of `@elabs-ai/components-ai` (it was transitive; under
pnpm's isolated layout a dynamic `import("mermaid")` cannot resolve otherwise).

`preloadMermaid()` is exported as an opt-in warm-up for surfaces that know they
render diagrams.

## Consequences

**The plugin is present from the first frame, so there is no render flash.** This
is the key property, and it is why we rejected the obvious alternative — sniffing
the markdown for a ` ```mermaid ` fence and swapping the `plugins` object once
loaded. That approach would have needed a state/suspense seam at all three call
sites, careful `useMemo` on plugin identity (`MessageResponse` is `memo`'d with a
custom comparator), and would still show raw Mermaid source before swapping to a
diagram — a visible flash plus a layout jump.

**Measured result** (`apps/playground`): entry chunk **6,231,119 → 5,643,544 B**
(−587,575 B). `flowchart-v2` and `mermaid version` moved out of the entry chunk
into a lazily-fetched `mermaid.core-*.js`. Built `packages/ai/dist/index.js` now
has no `@streamdown/mermaid` edge and exactly one dynamic `import("mermaid")`.

**DOMPurify still appears in the playground entry chunk — from a different
source.** `monaco-editor` vendors its own copy at
`esm/vs/base/browser/dompurify/dompurify.js`, reached via `@elabs-ai/components-editor`. That is
a separate dependency on a separate path and is out of scope here; the Mermaid
copy did move. Do not read the surviving `data-tt-policy-suffix` marker as this
change having failed.

**SSR renders the code-block path**, since the effect that loads the engine never
runs server-side; hydration performs the swap.

**Enforcement ships with the decision.** `pnpm heavy-deps:check`
(`scripts/check-eager-heavy-deps.mjs`, self-tested) is a source-level ratchet: a
new static import of a listed engine under `packages/ai/src` fails CI. `import
type` is correctly exempt. A production-build grep would be the more direct
measurement but is far too slow per-PR, and the static edge is the actual cause.
The ten pre-existing eager sites (React Flow ×6, xterm, media-chrome, Rive) are
the baseline and may only go down.

## Alternatives rejected

- **Fence-sniffing + plugin swap** — flash, layout jump, three-site state seam,
  memo hazards. See above.
- **Eager-on-idle preload** — still ships ~1.5 MB to every session that never
  renders a diagram, which defeats the purpose. Kept as the opt-in
  `preloadMermaid()` instead.
- **Lazy-loading `@streamdown/math` in the same change** — same mechanism, but a
  missed Mermaid fence degrades to a readable code block whereas a missed `$…$`
  renders literal `$x$`, a visible regression. Deferred to its own change with a
  deliberately loose detector.
- **Lazy-loading `shiki`** — rejected. It powers every message's code block and
  already splits its grammars into per-language chunks.
