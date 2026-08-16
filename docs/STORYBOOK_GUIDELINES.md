# Storybook Guidelines

How stories are organized, titled, and documented in this repo. The sidebar order
is enforced by `apps/docs/.storybook/preview.tsx` (`options.storySort.order`); the
rest are conventions. Background: the 2026-06-15 IA review in `docs/review/`.

## Sidebar taxonomy (top-level groups, in order)

Order = **primitives → composites → domain packages → utilities → demos**. EVERY
top-level group MUST be listed in `preview.tsx`'s `storySort.order`; an unlisted
group sorts to the bottom in arbitrary story-import order.

1. **Docs** — in reading order (explicit in `storySort.order`, NOT alphabetical):
   **Introduction** (what it is) → **Getting Started** (how to consume) → the agent/MCP
   detail pages (brand-ui MCP Server → Storybook MCP for Agents → AI Output Contract).
2. **Foundations** — the design/token layer: Colors, Typography, Spacing & Radius,
   Elevation, Motion, Decoration, Theming. (Tokens and scales, NOT components.)
3. **Core** — base UI primitives from `@elabs/components-ui` (Badge, Button, Card, Input, …).
4. **Icons** — brand/product icon vocabulary + BrandLogo.
5. **Forms** — inputs and form controls.
6. **Display** — presentational primitives (Avatar, Progress, Separator, …).
7. **Disclosure** — Accordion, Collapsible.
8. **Navigation** — Breadcrumb, Menubar, Pagination, Tree, Wizard, …
9. **Overlays** — Dialog, Popover, Tooltip, Sheet, … (portalled surfaces).
10. **Feedback** — Toast and other transient feedback.
11. **States** — Alert, Empty / Error / Loading state, Skeleton.
12. **Layout** — app shells, sidebars, page scaffolding.
13. **Data** — tables and data surfaces (`@elabs/components-data` grid + `@elabs/components-ui` table primitives).
14. **Charts** — `@elabs/components-charts`.
15. **AI** — `@elabs/components-ai` chat / agent surfaces.
16. **Editor** — `@elabs/components-editor`.
17. **Flow** — `@elabs/components-flow` canvas.
18. **Marketing** — `@elabs/components-marketing`.
19. **Providers** — non-visual providers (LocaleProvider, …).
20. **Patterns** — full composed demos: `Patterns/Templates`, `Patterns/Scenarios`,
    `Patterns/Blocks`.

## Foundations vs Core

"Foundations" is the **design layer** (tokens, type scale, spacing, elevation,
theming) — the source of truth a brand re-skins. "Core" is the **base component
set**. Keep them separate: token/scale docs never go under Core, base components
never go under Foundations.

## Naming

- Titles are `Group/ComponentName` (two levels). Use a third level only for a real
  sub-family (`Editor/MarkdownPreview/Academic`, `Patterns/Templates/Settings`,
  `Layout/App Shell/Mail`).
- The component segment is PascalCase with no spaces: `AI/ChatShell`, not
  `AI/Chat Shell`. Match the exported component name where possible.
- **No implementation leakage in titles.** The public name is the concept, not the
  library or block id: `Feedback/Toast` (not "Toast (Sonner)"), `Layout/App Shell/Mail`
  (not "… (sidebar-04)").

## Group by concern, signpost duplicates

Stories are grouped by what a component is **for** (its concern), not strictly by
which package ships it — e.g. `AI/ChangeReview`, `Data/Table` and
`Data/RevisionTimeline` live in `@elabs/components-ui` but appear under AI/ and Data/ beside
their domain peers. That is intentional.

When the same capability is reachable two ways, pick a **canonical** entry and
signpost the other on both stories (via `parameters.docs.description.component`):

- `Core/MetricCard` (`@elabs/components-ui`, canonical, ADR 0012) ↔ `Charts/MetricCard`
  (re-export) — the same component.
- `Data/Table` (`@elabs/components-ui`, simple static table) ↔ `Data/DataTable`
  (`@elabs/components-data`, TanStack grid) — choose by need.

## Every story

- `tags: ["autodocs"]` so it gets a docs page.
- Curated `argTypes` for the public props on primitives: a one-line `description`,
  a sensible `control`, and `table: { category }` grouping. Don't rely on inferred
  controls alone — they're noisy and weaker for the agent/MCP surface.
- Interactive components (overlays, forms, anything with click / type / toggle) get
  a `play` interaction test that asserts behavior and runs the a11y check
  (`addon-vitest`). Mirror `Forms/Select`.
- Theme-safe by construction: semantic token utilities only, no raw colors. Verify
  across both themes (`light`, `dark`) via the toolbar.

## Adding a group

Add it to `preview.tsx`'s `storySort.order` in the right tier, and to the list
above. A CI gate that fails when a story's top-level group is missing from the
order array would make this load-bearing (currently a comment-enforced convention).
