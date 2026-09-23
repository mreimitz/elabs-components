---
id: RM-152
title: "`developer-platform-page`: a CI/CD control room — pipeline graph, run log, failing diff, deploy stats"
status: planned
priority: P1
effort: M (2 days)
wave: 2
depends_on: [RM-147]
blocks: [RM-153]
agent: brand-ui-component-builder
model: opus
touches:
  - registry/blocks/developer-platform-page/ (new — `developer-platform-page.tsx`, `data/`)
  - registry/registry.items.json (one item, category `template`)
  - apps/docs/stories/templates-developer-platform.stories.tsx (new, with a play function)
  - apps/home/components/blocks/developer-platform-page/ (copy with provenance header)
  - apps/home/components/catalog/block-render-meta.ts (`"developer-platform-page": "screen"`)
  - apps/home/components/catalog/block-renders.tsx (the render)
  - apps/home/content/template-tours.ts (one entry)
  - scripts/lib/home-catalog-layout.json (family + featured)
source: docs/review/2026-09-23-home-experience.md §1 f
---

# RM-152 `developer-platform-page`

## Finding

Editor, terminal and flow are the heaviest packages and the least shown together; a developer-platform product is where they belong side by side.

## Change

A `<name>-page` registry item on `workspace-shell` (registry.md D4): a pipeline graph on `FlowCanvas` (stages as nodes, the failing one marked); a run log in a `Terminal` surface; the failing test's `DiffEditor`; deploy frequency / lead time `MetricCard`s and a `DataTable` of recent runs. Packages: flow, terminal, editor, charts, data, ui, icons — every heavy package a dynamic import on the site. Seeded data only, a fictional organisation, one real interaction path the play function exercises.

## Acceptance

- `pnpm gen` derives ≥ 2 `registryDependencies` and ≥ 4 `@elabs-ai/*` dependencies for the item.
- The story's play function passes in Chromium; the home page renders natively at 390 and 1440 in light and dark with no console errors.
- The template page shows a scenario, a tour and a made-of list (RM-147).

## Test / gate

`pnpm gen && pnpm check`, `pnpm typecheck`, the story's interaction test, `pnpm --filter home build`, screenshots.

## Orchestrator notes

Disjoint from the other wave-2 items except the three shared registries, which the orchestrator merges.
