# 04 · The context panel, the drill-in, and produced assets

Complaints 1 & 2 share one root: **the right rail is a hand-rolled `<aside>`, not a
component — so it inherits no animation, no drill-in, and the wrong asset
treatments.** The fix is a first-class, compound `ContextPanel` in `@qlik-coe-emea/qlabs-components-ai` that
owns the rail's behaviour and composes the produced-asset surfaces. This is the
AI-UI concern the maintainer flagged ("maybe this should be a dedicated component").

Findings: PANEL-1..5, ASSET-1..4.

> **The `ContextPanel` + drill-in specifics (§1–3, §6) are refined and superseded by
> [09-context-panel-integration.md](09-context-panel-integration.md)** (the top-down
> component design: collapse via an extracted `@qlik-coe-emea/qlabs-components-ui` `useCollapsiblePanel`,
> drill-in v1 = CSS track behind a v2 View-Transition seam, the doc-13 provider +
> external trigger, mobile `Sheet`, the full a11y spec, `InspectorPanel` convergence).
> This doc remains the authority for the **asset-content siblings** below
> (`ProducedAssetTree`, `AssetPreview`, the branded markdown renderer — §4–5), which
> `ContextPanel` hosts but does not own.

## 1. Why the left animates and the right doesn't (the load-bearing contrast)

The Sidebar isn't animated by magic — it's animated by **structure**:

- It is **always mounted** and tweens a gap-spacer's `width → 0` via
  `transition-[width] duration-base ease-linear` (`sidebar.tsx:196-205`) while a
  `fixed` container slides via `transition-[left,right,width] duration-base ease-linear`
  (`sidebar.tsx:206-219`). `duration-base` resolves to the gated `--t-base`
  (`themes.css:310`), so it honours reduced-motion **for free**.

The right rail does the one thing that makes width animation impossible — it
**conditionally mounts**: `{railOpen ? <ContextRail /> : null}`
(`agentic-workspace.stories.tsx:1100`). You can't tween the width of an element that
isn't in the DOM. Its `<aside>` also has no transition utility, no `data-state`, no
spacer (`agentic-workspace.stories.tsx:492`) — so even always-mounted it couldn't
animate. **This is component behaviour; it belongs in a component, not a story patch.**

---

## 2. `ContextPanel` / `Inspector` — the component (PANEL-1/2/4) · `@qlik-coe-emea/qlabs-components-ai`

A compound, lifted-state component per `component-api.md` "Composition patterns",
with the provider interface modeled on `SidebarProvider` (`sidebar.tsx:33-107`):

```
ContextPanel              — always-mounted shell; animates its own width like Sidebar
ContextPanelProvider      — lifts { open, view: 'root'|'detail', selectedAsset }
  + useContextPanel()       and actions { toggle, openDetail, back }
ContextPanelHeader        — title; hosts the BACK affordance in detail view
ContextPanelBody          — the two-view container (root ↔ detail)
ContextPanelSection       — status / grounding / produced-assets sections (root view)
ContextPanelDetail        — focused single-asset view (detail view)
```

- **Animation (PANEL-1):** reuse the Sidebar's gap-spacer + width-transition
  mechanism (CSS-gated, no `BrandMotionConfig` needed). Long-term, extract that
  mechanism into a shared `@qlik-coe-emea/qlabs-components-ui` `CollapsiblePanel`/`useCollapsiblePanel` so the
  left nav, this rail, and flow's `InspectorPanel` (`inspector-panel.tsx:27-79`)
  share **one** implementation instead of three forks (WP-13 drift). Architect call.
- **API (PANEL-2):** controlled `open`/`onOpenChange` + `defaultOpen`. The scenario
  renders `<ContextPanel open={railOpen} … />` **always-mounted** instead of a
  conditional mount.
- **Affordance parity (PANEL-4):** fold in a deliberate subset of the Sidebar's
  extras — persistence + collapse rail: yes; a mobile `Sheet` fallback (today the
  rail is `hidden … lg:flex`, so it just vanishes on small screens): yes; a global
  keyboard shortcut: maybe app-owned (the library-vs-app line). Keep these as
  variants, not boolean-prop sprawl. Document the parity-vs-Sidebar matrix in the story.

---

## 3. The drill-in (PANEL-3) — a two-view morph, not a modal

Model drill-in as the provider's `view` state, **not** a Radix Dialog/Sheet — the
focused asset must stay _inside_ the rail's width, not overlay the page.

- **Root view:** status + grounding (`SourceList`) + the produced-asset tree.
- Selecting an asset → `openDetail(asset)` sets `view='detail'` → `ContextPanelBody`
  replaces the root with `ContextPanelDetail` (just that asset, rendered by the
  branded markdown viewer — §5), and `ContextPanelHeader` shows a **BACK** button
  that calls `back()` → `view='root'`.

### Transition mechanism — ship the safe fallback first, keep the seam

This is the **canonical View-Transitions "list→detail morph"** — the
`view-transitions` research's earmarked **primary proof case**
(`research/view-transitions/01-design.md` §6.1). But:

- **v1 (ship now):** a CSS-gated two-pane `translateX` track (`overflow-hidden` +
  `transform: translateX(-100%)`, transform/opacity only → GPU, gates via `--t-*`),
  **or** an `AnimatePresence` slide behind an **internal** `BrandMotionConfig`
  boundary (so a consumer can't forget the gate — PANEL-5). No new infra; works in
  every browser; honours reduced-motion.
- **v2 (later):** generalize the shipped `useThemeTransition`
  (`use-theme-transition.ts:28-55`) into `useViewTransition({ name, recipe, mutate })`
  (gates on `useReducedMotion()`, single-flights). Shape the v1 API so this swap is
  **internal-only** (the design doc's engine-seam discipline, §124-135). Building
  `ContextPanel` this way gives the unbuilt VT pack its proving ground.

> **needs-render:** prototype the chosen mechanism across all six themes **and** under
> `data-motion-pref=reduced` to confirm it gates and reads as continuity, not a flash
> — the research says VT proof is not inferable from tokens (`01-design.md` §10).

---

## 4. `ProducedAssetTree` (ASSET-1, TYPE-5) — document, not code · `@qlik-coe-emea/qlabs-components-ai`

- **Root cause of "different font":** `FileTree` hardcodes `font-mono` + `border
bg-background` (`file-tree.tsx:69`) — an IDE source tree — **and** `--font-mono` is
  undefined in `:root`, so it falls back to a system mono stack unlike Inter
  (`themes.css:108`). The story's `className="text-sm"` can't strip the mono.
- **Fix (two layers):** (a) make `FileTree`'s mono/border a `cva` `variant: 'code' |
'document'` so it stops forcing an IDE look; (b) a purpose-built `ProducedAssetTree`
  defaulting to the document variant — **sans** body (the role token), **no hard
  box** (section header + spacing, optional soft `bg-muted/30` zone, per the
  border-noise guidance), asset-type icons (doc/csv/sql/image) first-class. Plus add
  `--font-mono` to `:root` (TYPE-5) so any legit mono is intentional and consistent.
- Document in `ai-chat-components.md` which tree to reach for, so the next scenario
  doesn't repurpose the code tree again.

---

## 5. `AssetPreview` + the branded markdown renderer (ASSET-2/3/4) — the keystone of complaint 2

### The defect

`AssetPreview` renders a markdown _document_ as Shiki _source_:
`<CodeBlock code={BOARD_NOTE_MD} language="markdown" wrap />`
(`agentic-workspace.stories.tsx:484`). `CodeBlock`'s body is unconditionally mono +
bordered (`code-block.tsx:271-276`) — it can _only_ show markdown-as-code. The same
prose renders correctly via `<MessageResponse>` 390 lines down (`:874`). The repo
already renders markdown; the preview picked the wrong tool.

### Why we can't just use editor's `MarkdownPreview` (ASSET-3)

`@qlik-coe-emea/qlabs-components-ai` and `@qlik-coe-emea/qlabs-components-editor` are **siblings** in the one-way dep graph; importing
editor from ai is a `DEP_DIRECTION_VIOLATION` (confirmed no `@qlik-coe-emea/qlabs-components-editor` dep,
`packages/ai/package.json:29-54`). And `MarkdownPreview`'s brandedness comes from the
**prose primitives** that live only in `packages/editor/src/prose/prose.tsx`.

### The fix (systemic, dep-graph-safe)

1. Build a **branded read-only markdown renderer native to `@qlik-coe-emea/qlabs-components-ai`** on the
   **existing** `streamdown` dependency (`package.json:44`) — no new heavy dep.
2. For _true_ brand output (not Streamdown's default CSS — note `MessageResponse`
   passes no `components` map either, `message.tsx:275-285`), **promote the prose
   primitives down to `@qlik-coe-emea/qlabs-components-ui`** (their own doc comment says they're generic, not
   editor-specific, `prose.tsx:1-6`). Then both editor's `MarkdownPreview` _and_ the
   new `@qlik-coe-emea/qlabs-components-ai` renderer map markdown onto **one** source-owned prose set, and the
   dep graph stays one-way (`ui → ai`, `ui → editor`). This is the high-leverage
   move — one prose source, every consumer (chat answers, charts insight cards,
   marketing) benefits. **Architect-gated** (relocates a public surface);
   `typecheck @qlik-coe-emea/qlabs-components-editor` after the move.
   - _Fallback if promotion is rejected:_ give the `@qlik-coe-emea/qlabs-components-ai` renderer a `components`
     map built from `@qlik-coe-emea/qlabs-components-ui` `Table`/`Card`/`Alert`/`Separator` (which it may import).

### `AssetPreview` the component (ASSET-4)

A real `@qlik-coe-emea/qlabs-components-ai` `AssetPreview`, keyed on file type:

- **markdown** → the branded renderer (above)
- **code / sql** → `CodeBlock` (Shiki)
- **csv** → a small table / row-count summary
- **png / image** → an image preview
  …with a **Preview / Raw toggle** (Raw = `CodeBlock` for users who want source),
  reusing `Artifact` chrome (`artifact.tsx`) for the header/actions. Its selected-asset
  state is the provider state the drill-in (§3) drives — the tree and the preview are
  the two levels of that drill-in.

> **needs-render:** the rail is only `w-80`. Confirm a branded render of the board
> note doesn't reintroduce "biggest text on screen" inside the narrow rail — editor's
> prose `Heading` h1 is `text-2xl` (`prose.tsx:17-24`); the rail context may need a
> **constrained** heading rung from the type scale. This is exactly why the markdown
> scale should consume the role tokens (TYPE-4) rather than hardcode Tailwind steps.

---

## 6. The rest of the rail (the brief's "structured supporting rail")

- **Context status** ("Context 21%"): the existing `Context`/`ContextTrigger`
  (`context.tsx`) is fine; render it as a small labelled ring with a tooltip, calm
  unless usage is high — a `ContextPanelSection`, not a header afterthought.
- **Grounding:** `SourceList` (MSG-4 / `Sources` structured) — a green evidence-chip
  header + expandable named sources, visibly connected to the answer.
- **Produced assets:** `ProducedAssetTree` (§4) with a polished selected state (soft
  `bg-muted` row, not the IDE highlight) and softer count badges.
- **Selected asset preview:** `ContextPanelDetail` hosting `AssetPreview` (§5).

All four become `ContextPanelSection`s in the root view; the preview is the detail
view. The scenario shrinks from a ~100-line bespoke `<aside>` to composing the panel.
