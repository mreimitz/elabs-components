# Storybook Guidelines

How stories are organized, titled, and documented in this repo. The sidebar order
is declared in `apps/docs/.storybook/preview.tsx` (`options.storySort.order`); the
group list below and the naming rules are conventions kept by review. Background: the
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
Maps while this list stopped at 20 entries — so update both in the same change; see
"Adding a group" below.

1. **Docs** — the customer-facing front section, in reading order (explicit in
   `storySort.order`, NOT alphabetical): **Introduction** (what it is) →
   **Getting Started** (how to consume) → the agent/MCP detail pages (brand-ui
   MCP Server → Storybook MCP for Agents → AI Output Contract for Agents) →
   Choosing between similar components. **Nothing about ONE component belongs
   here** — reference material for a component sits with that component, where a
   reader is already looking: the ViewToolbar contract is a docs page attached to
   `Layout/ViewToolbar`, the jsdom recipe is `Charts/Testing in jsdom`, the
   CodeWorkspace content-access note is `Editor/AI Content Access`. Harness
   stories that only assert a test-runner invariant live under `Internal/` with
   `tags: ["!dev"]` — in the test run, out of the sidebar.
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
15. **Dashboard** — `@elabs-ai/components-charts/dashboard`, the dashboard sheet surface
    (ADR 0037). Sits directly after Charts rather than with the other domain
    packages because it is a `charts` subpath, not a sibling package. Sorts
    alphabetically among itself (no nested reading-order array); the sub-groups
    that carry it are `Dashboard/Sheet` (`DashboardProvider`/`DashboardSheet`/
    `DashboardTile`, RM-074), `Dashboard/Tiles` (built-in tile kinds, RM-075),
    `Dashboard/Chrome` (toolbar, selection bar, panels, RM-076 onward),
    `Dashboard/Edit` (the `@dnd-kit/core` edit layer, empty until wave 2's
    RM-078) and `Dashboard/Recipes` (composed sheet demos).
16. **AI** — `@elabs-ai/components-ai` chat / agent surfaces. `Composer` is a
    sub-family node: the `PromptInput` primitive and the mode / effort / slash
    controls it is assembled from are nested under it (see "Naming" below).
17. **Terminal** — `@elabs-ai/components-terminal`: the console skin of the AI family, which
    is why it sits directly after AI rather than with the other domain packages.
18. **Editor** — `@elabs-ai/components-editor`.
19. **Viewer** — `@elabs-ai/components-viewer`.
20. **Flow** — `@elabs-ai/components-flow` canvas.
21. **Maps** — `@elabs-ai/components-maps`.
22. **Marketing** — `@elabs-ai/components-marketing`.
23. **Process** — `@elabs-ai/components-process`, the one layer-3 package (ADR 0034):
    process-mining views composed from `flow`/`charts`/`data`/`ui` primitives. Sorts
    after every layer-2 domain package and before `Patterns` because it composes them.
    Opened in wave 1 by RM-053's placeholder story and first filled by RM-051's
    `ProcessMap`; RM-057's remaining views land in wave 2.
24. **Patterns** — full composed demos, in that order: `Patterns/Templates` (whole
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
- **A story NAME is not a bug tracker.** The sidebar is the first thing a visitor
  reads, so a story is named for what it shows — "Keyboard focus", "High
  decoration", "Tile operations" — never "Keyboard focus indicator (#308)",
  "Tile operations (RM-081)", "50,000 marks (perf harness)" or "Reflow Regression
  Lock". The reference is still worth keeping: put it in the JSDoc comment over
  the export, or in `parameters.docs.description.story`. Enforced by `pnpm check
--rule story-name-hygiene`, which rejects `#123`, `ADR`, `RM-`, "harness" and
  "regression" in the name Storybook displays — including the one derived from
  the export identifier when the story declares no `name` of its own.
- **A story that exists only to sweep a variant does not belong in the sidebar.**
  A `— dark` / `— high decoration` / `compact density` twin of a story above it
  gets `tags: ["!dev"]`: it stays in `test-storybook`, leaves the navigation, and
  the toolbar already gives a visitor the same view on the original.

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
  [Choosing between similar components]. A story file with no description, or one
  too short to say anything, is a review finding (#152).
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
list above — same groups, same order. Nothing checks this automatically, so review a
new story title against these rules:

1. **Orphan group** — a story's first title segment must be in `storySort.order`;
   an unlisted group sorts to the bottom. (The 2026-06-15 IA review's finding, which
   recurred within three months as `Foundation/Toolbar` and
   `Typography/MatchHighlight`.)
2. **Segment naming** — no space in any segment after the group, except the
   sanctioned prose surfaces: `Docs/*`, `Patterns/{Templates,Scenarios,Blocks}/*`,
   `Layout/App Shell/*` and `Foundations/Spacing & Radius`. Extending that list is a
   taxonomy decision.
3. **Doc parity** — the numbered list above names the same groups in the same order
   as the array.
4. **Stale group** — remove a group from the array once no story titles into it
   (RM-004's `Providers`).

The array has to stay **inline** in `preview.tsx`: Storybook derives the order in
`index.json` by statically parsing that file, and its parser throws on any
identifier — an imported const, a local const in the same file, and a spread all
fail the build. Any tool reading the array must parse the literal in place.
