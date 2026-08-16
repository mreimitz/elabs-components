# Storybook Review — Information Architecture & State of Practice

- **Date:** 2026-06-15
- **Scope:** `apps/docs` Storybook — organization, categorization, naming, docs, test/control coverage.
- **Method:** Live instance at `localhost:6006` inspected via browser automation
  (read Storybook's own `index.json` as ground truth) + source config
  (`.storybook/main.ts`, `.storybook/preview.tsx`) and per-package story files.
- **Surface measured:** 186 index entries, 23 top-level groups, 184 component
  story files (`ui` 90, `ai` 24, `charts` 21, `editor` 21, `blueprint` 9,
  `flow` 7, `marketing` 6, `icons` 3, `data` 2; `tokens` 0).

## Verdict

The _infrastructure_ is genuinely state-of-the-art. The _information
architecture_ (the sidebar taxonomy) is the "grown mess" — and it's mostly
config-level, so most of it is cheap to fix.

Two things up front:

- **No hard duplicates.** Storybook's index reports **zero title collisions** —
  nothing silently overwrites anything. The problems are overlap, ordering, and
  naming, not literal dupes.
- **The biggest categories are buried.** The sort order lists only 14 of 23
  groups, so the rest fall to the bottom in an essentially arbitrary order.

---

## 1. Navigation order is broken — highest impact, ~5-min fix

`preview.tsx → options.storySort.order` lists only **14 of 23** top-level groups:

```
Docs, Foundation, Icons, Overlays, States, Layout, Data, AI, Flow,
Editor, Charts, Marketing, Blueprint, Scenarios
```

Every group _not_ in that list renders below the listed ones, in **story-import
order (not even alphabetical)**. The actual rendered tail is:

```
… Blueprint, Scenarios, Blocks, Templates, Disclosure, Display,
Navigation, Forms, Providers, Feedback, Components
```

So **Forms (23 stories — tied for the largest group), Display (8),
Navigation (6), Disclosure (2)** all render _below_ the marketing, blueprint and
demo sections. A component library should surface primitives first; right now a
user scrolls past AI / Editor / Charts / Marketing / Blueprint before reaching
form inputs.

**Fix:** list every group explicitly, ordered primitives → composites →
domain packages → demos. e.g.

```
Docs, Foundation, Forms, Display, Disclosure, Navigation, Overlays,
States, Layout, Data, Charts, AI, Editor, Flow, Marketing, Blueprint,
Providers, Patterns
```

---

## 2. Three overlapping "composition" buckets

`Templates` (5), `Scenarios` (1) and `Blocks` (1) are the same idea — full
composed demos — split three ways and scattered across packages. Only
`Scenarios` is in the sort order.

**Fix:** merge into one top-level (pick one word — **Patterns** or **Examples**)
with sub-folders, e.g. `Patterns/Templates/*`, `Patterns/Scenarios/*`.

---

## 3. Singleton / junk-drawer groups

| Group                      | Items | Problem                                      | Suggestion                                                                                            |
| -------------------------- | ----- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `Components/Transfer`      | 1     | "Components" is a catch-all holding one item | Move to **Forms** (it's a dual-list selector) and delete the group                                    |
| `Feedback/Toast (Sonner)`  | 1     | Singleton; name leaks the library            | Drop "(Sonner)". Either grow Feedback (toasts, inline messages, banners) or fold into Overlays/States |
| `Providers/LocaleProvider` | 1     | Non-visual provider as a top-level group     | Move under a **Utilities** or **Foundation/Providers** home                                           |
| `Disclosure`               | 2     | Tiny (Accordion, Collapsible)                | Fine, but consider grouping with the other primitives                                                 |

---

## 4. Taxonomy doesn't map cleanly to packages — pick a rule

Several `@elabs/components-ui` components surface under _domain_ groups:
`AI/ChangeReview`, `Data/Table`, `Data/RevisionTimeline` all live in
`packages/ui` but appear under `AI/` and `Data/`. Meanwhile `@elabs/components-data`'s
DataTable is _also_ under `Data/`. "Group by concern" is defensible, but it's
currently undocumented and produces confusables:

- **`Data/Table`** (ui, basic) vs **`Data/DataTable`** (data, TanStack) sit side
  by side with no signpost of which to reach for.
- **`Foundation/MetricCard`** (ui, canonical) vs **`Charts/MetricCard`** (charts
  re-export per ADR 0012) — same component, two doc pages.

**Fix:** decide explicitly — group strictly by package, _or_ keep by-concern but
add a one-line "which one should I use" note and a canonical pointer on each
duplicated/near-duplicate entry.

---

## 5. Naming inconsistencies

- **Spaced vs PascalCase inside one group:** `AI/AgentTimeline`,
  `AI/ContextPanel`, `AI/ApprovalCard` vs `AI/Chat Shell`, `AI/Code Block`,
  `AI/Inline Citation`, `AI/Test Results`. Pick one convention per group.
- **Title ≠ component/file:** `confirmation.stories.tsx` → "AI/ApprovalCard";
  `ai-objects.stories.tsx` → "Editor/AiObjects/DecisionCard" (17 stories crammed
  under one 3-level title). Hurts search/discovery.
- **Implementation leakage in public names:** `Feedback/Toast (Sonner)`,
  `Layout/App Shell/Dashboard (sidebar-02 / -04 / -05)` — drop the shadcn block
  IDs from user-facing titles.
- **Uneven nesting depth:** mostly 2 levels, but Editor and Layout/App Shell go
  to 3 inconsistently.

---

## 6. Missing: a "Foundations" / token layer in Storybook — biggest content gap

For a system that advertises itself as **token-driven**, the tokens have
**zero Storybook presence** (`packages/tokens`: 0 stories). Token _guidance_
exists as prose in `docs/TOKEN_GUIDELINES.md`, but it is never surfaced in the
place people actually browse the system. And "Foundation" in the sidebar is
actually base _components_ (Badge, Button, Card, Input…), not design foundations.

There is no canonical Storybook page for the **color palette, type scale,
spacing/radius, elevation, or token reference** — the literal source of truth of
the system is undocumented where people look first.

**Fix:** add a true **Foundations** section (MDX and/or stories): Colors &
tokens, Typography scale, Spacing & radius, Elevation, Motion, Iconography,
Theming guide. The repo already has `Typography`, `Motion`, `Decoration` and
`ThemeSwitcher` demos sitting under "Foundation" — promote/group those and add
the missing token catalog. Consider renaming the current component bucket to
**Components / Core** and reserving **Foundations** for tokens.

---

## 7. Thin documentation overall

Only **2 MDX pages** exist (`Introduction`, `Storybook-MCP-for-Agents`). The repo
has rich guidance under `docs/` (TOKEN/COMPONENT/MOTION guidelines, CONSUMING,
DECISIONS), but almost none of it is surfaced in Storybook. Missing in-Storybook:
getting-started / usage, per-package landing pages, accessibility guidelines, and
"which component do I use" decision docs.

---

## 8. Controls are largely unconfigured

Only **6 of 184** story files define `argTypes`. autodocs + react-docgen infers
a Controls table from TS types, but without curated `argTypes` (descriptions,
categories, control types, `table.disable`) the panels are noisy or incomplete —
and weaker for the **agent / MCP** use-case the project explicitly optimizes for
(`@storybook/addon-mcp`). Add `argTypes` to high-traffic primitives at minimum.

---

## 9. Interaction-test coverage is modest

**37 of 184** files (~20%) have `play` functions. The ones that exist are good —
real assertions plus a11y via `addon-vitest` (e.g. `Forms/Select` opens the Radix
portal, picks an option, asserts the trigger updates). Overlays and many Forms
have none, which is low-hanging fruit since the harness is already wired.

---

## What's already strong — keep it

- **Storybook 10 + react-vite**, with `addon-a11y`, `addon-vitest`
  (stories-run-as-tests), `@chromatic-com/storybook` (visual regression), and
  `@storybook/addon-mcp` (agent access). A modern, well-chosen stack.
- **Toolbar globals for theme (6) × motion (3) × density (3) × decoration
  (0–10)** wired through decorators, so _every_ story can sweep the whole matrix.
  Genuinely advanced and rare — keep leaning on it.
- **~85% autodocs coverage** (157/184) and a package list in the Introduction
  that's _generated_ from the manifest (`pnpm gen`) — single source of truth.
- **Real interaction tests** with assertions, not just render smoke tests.

---

## Suggested priority

1. **(5 min, verifiable win)** Complete `storySort.order` — list all 23 groups,
   primitives first.
2. **(~30 min)** Collapse Templates/Scenarios/Blocks → one **Patterns**; move
   Transfer → Forms; resolve the other singletons; strip impl-leak suffixes
   (`(Sonner)`, `(sidebar-0x)`).
3. **(larger)** Add a **Foundations / token catalog** + getting-started MDX
   (surface the existing `docs/*_GUIDELINES.md` content in Storybook).
4. **(ongoing)** `argTypes` on top primitives; more `play` tests on
   overlays/forms; settle the package-vs-concern titling rule and signpost the
   `MetricCard` / `Table` near-duplicates.

Minor polish: the "Become an expert" / "Run tests" onboarding widgets in the
sidebar are Storybook defaults — consider hiding them for a cleaner internal DS.

---

_Findings are described, not yet filed. Per `docs/ISSUE_WORKFLOW.md`
(finders report → RCA → `/file-issue`), route the items worth acting on into
GitHub issues._
