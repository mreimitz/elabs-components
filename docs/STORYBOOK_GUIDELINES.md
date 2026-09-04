# Storybook Guidelines

How stories are organized, titled, and documented in this repo. The sidebar order
is declared in `apps/docs/.storybook/preview.tsx` (`options.storySort.order`) and
gated by `pnpm storybook-groups:check`, which also holds the group list below and
the no-spaces naming rule to it; the rest are conventions. Background: the
2026-06-15 IA review in `docs/review/`.

## Sidebar taxonomy (top-level groups, in order)

Order = **primitives → composites → domain packages → utilities → demos**. EVERY
top-level group MUST be listed in `preview.tsx`'s `storySort.order`; an unlisted
group sorts to the bottom in arbitrary story-import order.

Everything NOT named in that array sorts **alphabetically**
(`storySort.method: "alphabetical"`), so a new component lands in a predictable
place without an edit to the array. A nested child array is reserved for the
three groups below whose children carry a reading order alphabetical would
scramble — Docs, Foundations and Patterns.

**This numbered list must match `storySort.order` group for group, in the same
order.** The two had already drifted once — the array carried Terminal, Viewer and
Maps while this list stopped at 20 entries — so `pnpm storybook-groups:check` now
fails when they diverge; see "Adding a group" below.

1. **Docs** — in reading order (explicit in `storySort.order`, NOT alphabetical):
   **Introduction** (what it is) → **Getting Started** (how to consume) → the
   agent/MCP detail pages (brand-ui MCP Server → Storybook MCP for Agents → AI
   Output Contract for Agents → AI Content Access → View Toolbar Contract →
   Testing Charts in jsdom → Storybook Theme Harness) → Choosing between similar
   components.
2. **Foundations** — the design/token layer, in reading order (explicit, NOT
   alphabetical): Colors → Typography → Spacing & Radius → Elevation → Motion →
   Decoration → Paper → Theming → Localization. (Tokens and scales, plus the two
   root providers — `ThemeProvider` via Theming, `LocaleProvider` via
   Localization — every app mounts at the same root; see "Foundations vs Core"
   below.)
3. **Core** — base UI primitives from `@elabs-ai/components-ui` (Badge, Button, Card, Input, …).
4. **Icons** — brand/product icon vocabulary + BrandLogo.
5. **Forms** — inputs and form controls.
6. **Display** — presentational primitives (Avatar, MatchHighlight, Progress, Separator, …).
7. **Disclosure** — Accordion, Collapsible.
8. **Navigation** — Breadcrumb, Menubar, Pagination, Tree, Wizard, …
9. **Overlays** — Dialog, Popover, Tooltip, Sheet, … (portalled surfaces).
10. **Feedback** — Toast and other transient feedback.
11. **States** — Alert, Empty / Error / Loading state, Skeleton.
12. **Layout** — app shells, sidebars, page scaffolding, Toolbar.
13. **Data** — tables and data surfaces (`@elabs-ai/components-data` grid + `@elabs-ai/components-ui` table primitives).
14. **Charts** — `@elabs-ai/components-charts`. Sorts alphabetically among itself
    (no nested reading-order array), which places `Charts/ByDataShape` — a
    "which container for this data shape?" index over every container the
    package exports, RM-041 — between the ordinary per-container story titles
    rather than first; that placement is an accepted, scope-driven trade-off
    (see `packages/charts/src/by-data-shape.stories.tsx`'s own docblock), not a
    naming mistake. The three lieflat-charts-derived editorial recipes it
    points at (Hourglass Stream, Radial Patchwork, Bubble Almanac) are NOT
    package components — they are copy-own blocks under `Patterns/Blocks/Chart
Editorial — …`, built entirely from the package's public `marks` layer.
15. **AI** — `@elabs-ai/components-ai` chat / agent surfaces. `Composer` is a
    sub-family node: the `PromptInput` primitive and the mode / effort / slash
    controls it is assembled from are nested under it (see "Naming" below).
16. **Terminal** — `@elabs-ai/components-terminal`: the console skin of the AI family, which
    is why it sits directly after AI rather than with the other domain packages.
17. **Editor** — `@elabs-ai/components-editor`.
18. **Viewer** — `@elabs-ai/components-viewer`.
19. **Flow** — `@elabs-ai/components-flow` canvas.
20. **Maps** — `@elabs-ai/components-maps`.
21. **Marketing** — `@elabs-ai/components-marketing`.
22. **Patterns** — full composed demos, in that order: `Patterns/Templates` (whole
    screens) → `Patterns/Scenarios` (multi-screen journeys) → `Patterns/Blocks`
    (copy-own building blocks). Alphabetical would interleave the three.

## Foundations vs Core

"Foundations" is the **design layer** (tokens, type scale, spacing, elevation,
theming) — the source of truth a brand re-skins — **plus the two root
providers** (`ThemeProvider`, `LocaleProvider`) every app mounts once, at that
same root (RM-004: folded out of a former standalone "Providers" group so both
are on the Getting Started path). "Core" is the **base component set**. Keep
them separate: token/scale docs never go under Core, and a base UI component
(anything an app composes into a screen, not a root provider) never goes under
Foundations.

## Naming

- Titles are `Group/ComponentName` (two levels). Use a third level only for a real
  sub-family (`Editor/MarkdownPreview/Academic`, `Patterns/Templates/Settings`,
  `Layout/App Shell/Mail`, `AI/Composer/PromptInput`).
- **A sub-family nests under the whole it is part of, and the parent keeps its own
  page.** `AI/Composer` is both a component page and the parent node: the four pages
  beneath it (`PromptInput`, `PromptInputMode`, `PromptInputEffort`,
  `PromptInputSlash`) are the composer's parts, not its siblings, and `AI/Composer`'s
  description carries the anatomy that says so. Nest only where that relationship is
  real — a component that merely reads like a neighbour (`AI/MessageForm`, a
  model-emitted form inside a message) stays a sibling and says in its first sentence
  what it is not.
- **A composition of parts that ALREADY have pages is a story, not a block.** A demo
  whose whole content is "these library components, arranged" belongs as a story on
  the canonical component's page. `Patterns/Blocks` is for copy-own building blocks —
  ideally ones backed by a `registry/` item a consumer installs, like
  `Patterns/Blocks/AI Chat Shell`.
- The component segment is PascalCase with no spaces: `AI/ChatShell`, not
  `AI/Chat Shell`. Match the exported component name where possible.
- **No implementation leakage in titles.** The public name is the concept, not the
  library or block id: `Feedback/Toast` (not "Toast (Sonner)"), `Layout/App Shell/Mail`
  (not "… (sidebar-04)").

## Group by concern, signpost duplicates

Stories are grouped by what a component is **for** (its concern), not strictly by
which package ships it — e.g. `AI/ChangeReview`, `Data/Table` and
`Data/RevisionTimeline` live in `@elabs-ai/components-ui` but appear under AI/ and Data/ beside
their domain peers. That is intentional.

When the same capability is reachable two ways, pick a **canonical** entry and
signpost the other on both stories (via `parameters.docs.description.component`):

- `Core/MetricCard` (`@elabs-ai/components-ui`, canonical, ADR 0012) — the ONE entry
  for the KPI tile. `@elabs-ai/components-charts` re-exports the same component, but
  a re-export gets **no sidebar entry of its own**: two identical entries read as
  two components, and the "they are the same thing" signpost was only visible
  once you opened one of them (RM-005). Say it in the canonical story's
  description instead.
- `Data/Table` (`@elabs-ai/components-ui`, simple static table) ↔ `Data/DataTable`
  (`@elabs-ai/components-data`, TanStack grid) — choose by need.

## Every story

- `tags: ["autodocs"]` so it gets a docs page.
- `parameters.docs.description.component` — one sentence saying what this is,
  and, when a sibling answers a nearby question, a second naming it and linking
  [Choosing between similar components]. **Gated** by `pnpm story-descriptions:check`
  (#152): a story file with no description, or with one too short to say
  anything, fails. Pre-existing gaps are a ratchet baseline
  (`scripts/story-description-baseline.json`) that only shrinks — a NEW story
  cannot be added to it.
- Curated `argTypes` for the public props on primitives: a one-line `description`,
  a sensible `control`, and `table: { category }` grouping. Don't rely on inferred
  controls alone — they're noisy and weaker for the agent/MCP surface.
- Interactive components (overlays, forms, anything with click / type / toggle) get
  a `play` interaction test that asserts behavior and runs the a11y check
  (`addon-vitest`). Mirror `Forms/Select`.
- Theme-safe by construction: semantic token utilities only, no raw colors. Verify
  across both themes (`light`, `dark`) via the toolbar.

## Adding a group

Add it to `preview.tsx`'s `storySort.order` in the right tier, and to the numbered
list above — same groups, same order. **`pnpm storybook-groups:check`
(`scripts/check-storybook-groups.mjs`, blocking in CI) is what makes this
load-bearing** — it is no longer a comment-enforced convention. Four rungs, and a
title it cannot read is a failure rather than a skip:

1. **Orphan group** — a story whose first title segment is not in `storySort.order`
   fails, named by `file:line`. (This is the 2026-06-15 IA review's finding, which
   recurred within three months as `Foundation/Toolbar` and
   `Typography/MatchHighlight`.)
2. **Segment naming** — a space in any segment after the group fails, except the
   sanctioned prose surfaces: `Docs/*`, `Patterns/{Templates,Scenarios,Blocks}/*`,
   `Layout/App Shell/*` and `Foundations/Spacing & Radius`. They are an explicit,
   commented allowlist in the script; extending it is a taxonomy decision.
3. **Doc parity** — the numbered list above must name the same groups in the same
   order as the array, so this section cannot drift from the code again (it already
   had: the array carried Terminal, Viewer and Maps while the list stopped at 20).
4. **Stale group** — a group in the array that no story titles into any more fails
   too, so a folded-away group (RM-004's `Providers`) cannot be left behind.

Run `node scripts/check-storybook-groups.mjs --list` to see every title the gate
resolves, with its file and line.

The array has to stay **inline** in `preview.tsx`: Storybook derives the order in
`index.json` by statically parsing that file, and its parser throws on any
identifier — an imported const, a local const in the same file, and a spread all
fail the build. A gate reading the array must parse the literal in place.
