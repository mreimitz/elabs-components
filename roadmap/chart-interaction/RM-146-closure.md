---
id: RM-146
title: "Closure: `charts.md` rules, CLI manifest + guidance, A2UI schema regen, `analytics-dashboard` registry block, home chart pages, CHANGELOG, browser sweep"
status: planned
priority: P1
effort: S–M (1.5 days)
wave: 3
depends_on: [RM-138, RM-139, RM-140, RM-141, RM-142, RM-143, RM-144, RM-145]
blocks: []
agent: brand-ui-docs-writer
model: sonnet
touches:
  - .claude/rules/charts.md (Analytics / Navigator / Selection gestures sections replace the RM-136 stubs)
  - skills/brand-ui/reference/chart-selection.md (when to add which analytic; when a chart should scroll vs facet)
  - brand-ui.manifest.json + packages/cli (manifest regen; `brand-ui docs` shows the new props; `audit --strict` rules: `analytics` needs a label mode, gestures need `onSelectionIntent`)
  - packages/charts/src/a2ui/catalog.generated.ts (regen) + apps/docs Generative UI page examples
  - registry/blocks/analytics-dashboard-01 (new — KPI strip + trend/forecast line + scrolled bar + linked scatter with lasso, on the local driver)
  - apps/home (chart detail pages: "Analytics", "Scrolling", "Selection" sections per chart; Visualizations gallery entry)
  - packages/charts/README.md, CHANGELOG via changesets, docs/review/2026-09-22-chart-analytics-navigator-selection-plan.md §Outcome
  - roadmap/README.md (track row → done)
source: docs/review/2026-09-22-chart-analytics-navigator-selection-plan.md §5
---

# RM-146 Closure

## Finding

The track adds three vocabularies (`analytics[]`, `scrollbar`/`window`, `selectionGestures`/`onSelectionIntent`) that an agent must find through the CLI and the site, or they will not be used — the lesson of the agent-onboarding review (`docs/review/2026-09-20-agent-and-human-onboarding-review.md`).

## Change

- Rules: three `charts.md` sections (ink for computed furniture; the window model and that a strip lives outside `plotHeight`; the intent contract, hit rules, keyboard paths, "targets outside the svg" restated) + `docs/rules-history` entry.
- Guidance: `chart-selection.md` gains "add an average line when …", "use a percentile band for …", "scroll when > N categories, facet when series > 6", "range on axes, lasso on points".
- CLI: manifest regenerated; two `audit --strict` rules; `brand-ui docs LineChart` lists `analytics`, `scrollbar`, `selectionGestures` with examples.
- Registry block `analytics-dashboard-01` and a home "Analytics & interaction" template that show all three features together (the visually exciting, use-case-driven bar the maintainer set for templates).
- Home chart detail pages: each affected chart gets the three sections with live examples; the Visualizations gallery gets one hero item ("Explore: analytics, scroll, select").
- Sweep: every new story in Chromium light + dark at 380 / 600 / 900 in all five themes, keyboard paths exercised, axe clean; results quoted in the review's §Outcome with what stays open.

## Acceptance

- `brand-ui docs BarChart` prints the new props; `brand-ui audit --strict` on the new stories is clean; `brand-ui chart-for "monthly revenue with target and trend"` recommends a line chart with `analytics`.
- The home build passes and the new pages render with no console errors.
- `roadmap/README.md` track row says done with the merge SHA.

## Test / gate

`pnpm check`, full test suite, `pnpm --filter home build`, the sweep evidence in the PR.

## Orchestrator notes

Last item; run only after RM-145 merges. Ship the default flip for `scrollbar` on bar charts here if RM-141 left it at `"none"` and the site sweep looks right.
