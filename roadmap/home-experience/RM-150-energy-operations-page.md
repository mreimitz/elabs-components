---
id: RM-150
title: "`energy-operations-page`: a utility's site desk — `energy-desk-01` + site table + site map + an analyst dock"
status: done
priority: P0
effort: M (2 days)
wave: 2
depends_on: [RM-147]
blocks: [RM-153]
agent: brand-ui-component-builder
model: opus
touches:
  - registry/blocks/energy-operations-page/ (new — `energy-operations-page.tsx`, `data/`)
  - registry/registry.items.json (one item, category `template`)
  - apps/docs/stories/templates-energy-operations.stories.tsx (new, with a play function)
  - apps/home/components/blocks/energy-operations-page/ (copy with provenance header)
  - apps/home/components/catalog/block-render-meta.ts (`"energy-operations-page": "screen"`)
  - apps/home/components/catalog/block-renders.tsx (the render)
  - apps/home/content/template-tours.ts (one entry)
  - scripts/lib/home-catalog-layout.json (family + featured)
source: docs/review/2026-09-23-home-experience.md §1 f
---

# RM-150 `energy-operations-page`

## Finding

The energy desk block (`energy-desk-01`) prices a period of one site's consumption; nothing on the site shows the product around it — the fleet of sites, where they are, and the question an analyst asks next.

## Change

A `<name>-page` registry item on `workspace-shell` (registry.md D4): the `energy-desk-01` block as the read side for the selected site; a `DataTable` of sites (consumption, effective price, peak hour) whose row click swaps the desk's readings; a `MapCanvas` with one marker per site, in sync with the table; a docked analyst conversation (`@elabs-ai/components-ai`) that answers about the picked period. Packages: charts, data, maps, ai, ui, icons. Seeded data only, a fictional organisation, one real interaction path the play function exercises.

## Acceptance

- `pnpm gen` derives ≥ 2 `registryDependencies` and ≥ 4 `@elabs-ai/*` dependencies for the item.
- The story's play function passes in Chromium; the home page renders natively at 390 and 1440 in light and dark with no console errors.
- The template page shows a scenario, a tour and a made-of list (RM-147).

## Test / gate

`pnpm gen && pnpm check`, `pnpm typecheck`, the story's interaction test, `pnpm --filter home build`, screenshots.

## Orchestrator notes

Disjoint from the other wave-2 items except the three shared registries, which the orchestrator merges.

## Outcome (2026-09-23)

Shipped as `energy-operations-page` (registry item, story `Patterns/Templates/Energy/Energy Operations`, native home render, tour, landing tile). Verified: story play `SelectAndAcknowledge` light + dark (axe clean), home build, `template-page`/`tour-tabs`/`smoke`/`a11y` e2e, and the built site driven in Chromium light + dark at 1440 (select a site → dock → Acknowledge steps the site down, nav badge agrees) and rendered at 390. Selected rows use `bg-selection-muted` (the accent fill failed contrast under a destructive badge).
