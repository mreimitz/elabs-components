---
id: RM-151
title: "`security-ops-page`: a SOC — alert queue, `incident-explorer-01`, asset map, triage dock with an agent's tool calls"
status: done
priority: P0
effort: M (2 days)
wave: 2
depends_on: [RM-147]
blocks: [RM-153]
agent: brand-ui-component-builder
model: opus
touches:
  - registry/blocks/security-ops-page/ (new — `security-ops-page.tsx`, `data/`)
  - registry/registry.items.json (one item, category `template`)
  - apps/docs/stories/templates-security-ops.stories.tsx (new, with a play function)
  - apps/home/components/blocks/security-ops-page/ (copy with provenance header)
  - apps/home/components/catalog/block-render-meta.ts (`"security-ops-page": "screen"`)
  - apps/home/components/catalog/block-renders.tsx (the render)
  - apps/home/content/template-tours.ts (one entry)
  - scripts/lib/home-catalog-layout.json (family + featured)
source: docs/review/2026-09-23-home-experience.md §1 f
---

# RM-151 `security-ops-page`

## Finding

The incident explorer block (`incident-explorer-01`) shows 90 days of incidents; there is no security product on the site, though a SOC is the most common command-center request an agent gets.

## Change

A `<name>-page` registry item on `workspace-shell` (registry.md D4): an alert queue `DataTable` (severity, asset, rule, age) with a `FilterBar`; the `incident-explorer-01` block re-read as incidents by service; an asset map (`MapClusterLayer`) of where the alerts fire; a triage dock: the selected alert's details and an agent conversation with `Tool` calls (enrich → contain → close) the analyst approves. Packages: data, charts, maps, ai, ui, icons. Seeded data only, a fictional organisation, one real interaction path the play function exercises.

## Acceptance

- `pnpm gen` derives ≥ 2 `registryDependencies` and ≥ 4 `@elabs-ai/*` dependencies for the item.
- The story's play function passes in Chromium; the home page renders natively at 390 and 1440 in light and dark with no console errors.
- The template page shows a scenario, a tour and a made-of list (RM-147).

## Test / gate

`pnpm gen && pnpm check`, `pnpm typecheck`, the story's interaction test, `pnpm --filter home build`, screenshots.

## Orchestrator notes

Disjoint from the other wave-2 items except the three shared registries, which the orchestrator merges.

## Outcome (2026-09-23)

Shipped as `security-operations-page` (named after the story slug, `Patterns/Templates/Security/Security Operations`, so the item, the page and the tour share one name): alert queue under a `FilterBar`, open alerts clustered on a `MapCanvas`, `incident-explorer-01` over the same sources, a triage dock with linked alerts and an agent whose second tool call waits for approval; Contain / Close as benign with Undo. Verified: story play `TriageAndContain` light + dark (axe clean), home build, `template-page`/`tour-tabs`/`smoke`/`a11y` e2e, the built site driven in Chromium light + dark at 1440 (Triage ALT-7821 → dock → Contain asset: badge 12 → 11, isolate-host tool completes, toast with Undo) and rendered at 390. The home showcase now holds eight crops beside the featured template (a full 3-column grid).
