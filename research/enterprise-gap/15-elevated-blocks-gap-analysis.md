# 15 · Elevated building-block coverage — gap analysis & proposal

**Date:** 2026-06-20 · **Trigger:** "the library is functionally good but lacks elevated
design concepts" (chart-integrated stat cards, widgets, chart blocks, integration grids,
wizards). **References analysed (layout/composition, NOT theme):**
[shadcnspace Statistics](https://shadcnspace.com/blocks/dashboard-ui/statistics-component) ·
[Widgets](https://shadcnspace.com/blocks/dashboard-ui/widgets-component) ·
[Charts](https://shadcnspace.com/blocks/dashboard-ui/charts-component) ·
[the live dashboard](https://shadcnspace-dashboard-horizontal.vercel.app/) ·
[integration page](https://shadcnspace-dashboard-horizontal.vercel.app/theme-pages/inetegration) ·
[form wizard](https://shadcnspace-dashboard-horizontal.vercel.app/forms/form-wizard).

> Sibling of `14-example-coverage-gap-analysis.md`. That doc was about _screens_; this one
> is about _sub-page blocks_ — the elevated compositions that give a builder "more options."

---

## TL;DR

brand-ui **already has the hard parts** — the chart engine (`AreaChart`/`BarChart`/`LineChart`/
`PieChart`/`RadarChart`/`RingChart`/**`Gauge`**), a word-size `Sparkline`, a `MetricCard` with
a `visual` slot, a `ChartCard`, `bento-grid`, `Progress`, `Timeline`, and `Wizard`. What it
lacks is the **batteries-included compositions** that turn those primitives into copy-ready
options: stat cards that actually _show_ a trend, chart cards with a KPI header + period
control + breakdown, ranked-list / leaderboard / activity widgets, an integration grid, and a
worked multi-step form wizard. The reference galleries ship ~18 statistics + 17 widgets + 17
chart blocks precisely because the _composition_, not the primitive, is the reusable unit.

This pass built **five verified exemplar blocks** (one per family) under `Patterns/Blocks/*`
and proposes promoting them — plus the full variant matrices — into the library.

---

## What the references provide (the concept catalog)

- **Statistics / stat cards:** KPI tile + delta, **KPI + inline sparkline/mini-chart**,
  horizontal KPI bar, goal/progress tile, comparison (this-vs-last) tile.
- **Widgets:** ranked list / leaderboard (Sales by Country/Top Sales — avatar/flag + value +
  delta + share bar), best-selling list with progress, **activity / transaction feed**, KPI
  welcome banner, goals/progress overview, gauge/score card, sales-by-location.
- **Chart blocks:** a chart wrapped in a card with a **headline KPI + delta + segmented
  period control + footer breakdown** — bar/stacked, area-gradient YoY, line w/ markers,
  **donut-with-center-total**, **semi-circle gauge**, radar pipeline.
- **Integration grid:** responsive grid of integration cards (logo + name + description +
  connect/manage + status) under a header with "Add integration."
- **Form wizard:** multi-step form with a **horizontal numbered stepper** + a Review step.

---

## Gap mapping (concept → brand-ui today → proposal)

| Concept                                            | brand-ui today                                                             | Status               | Proposal                                                                                         |
| -------------------------------------------------- | -------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------ |
| KPI tile + delta                                   | `MetricCard`                                                               | ✅ have              | —                                                                                                |
| KPI + inline sparkline/trend                       | `MetricCard.visual` slot (DIY) + 3 `stat-card-*-01` registry blocks (visx) | 🟡 partial           | **StatCard variants** (area/bar/line spark via `Sparkline`, no extra deps) — exemplar built      |
| Goal / progress tile, comparison tile              | `Progress` primitive                                                       | 🟡 partial           | **GoalCard / ComparisonCard** compositions — exemplar built                                      |
| Horizontal KPI bar                                 | `MetricGrid`                                                               | 🟡 partial           | a single-row divided KPI-bar variant                                                             |
| Rich chart card (KPI header + period + footer)     | `ChartCard` (title/desc/actions only)                                      | 🟡 partial           | **enrich `ChartCard`** with `kpi` / `period` / `footer` slots — exemplar built (the visual spec) |
| Chart types (bar/line/area/donut/gauge/radar/ring) | all present incl. `Gauge`, `RingChart`, `RadarChart`                       | ✅ have              | —                                                                                                |
| Curated chart _blocks_ for a use case              | compose manually                                                           | ❌ missing as blocks | revenue-vs-expense, donut-with-center-total, gauge KPI, radar pipeline                           |
| Ranked list / leaderboard widget                   | —                                                                          | ❌ missing           | **RankedList / Leaderboard** — exemplar built                                                    |
| Activity / transaction feed widget                 | `Timeline` / `AgentTimeline`                                               | 🟡 partial           | **ActivityFeed / TransactionList** — exemplar built                                              |
| KPI welcome banner                                 | —                                                                          | ❌ missing           | **KpiBanner** composition                                                                        |
| Integration grid                                   | —                                                                          | ❌ missing           | **IntegrationCard + IntegrationGrid** — exemplar built                                           |
| Horizontal form wizard                             | `Wizard` (basic steps)                                                     | 🟡 partial           | a worked multi-step **form** wizard + horizontal-stepper polish — exemplar built                 |
| Bento layout                                       | `bento-grid`                                                               | ✅ have              | —                                                                                                |

---

## What this pass built (5 verified exemplars)

All compose **existing `@qlik-coe-emea/qlabs-components-*` primitives only** (no new components, no cross-package
violations, semantic tokens only), as discoverable `Patterns/Blocks/*` stories:

| Family                 | File                                                    | Title                                     | Composition                                                                                                             |
| ---------------------- | ------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Elevated stat cards    | `packages/charts/src/blocks-stat-cards.stories.tsx`     | `Patterns/Blocks/Stat Cards`              | `MetricCard` + inline `Sparkline` (area/bar/line, `--chart-*` colour) · goal/progress tile · comparison tile            |
| Rich chart card        | `packages/charts/src/blocks-chart-card-kpi.stories.tsx` | `Patterns/Blocks/Chart Card (KPI header)` | KPI header + headline value + delta + **segmented `ToggleGroup` period** (interactive) + `AreaChart` + footer breakdown |
| List & summary widgets | `packages/ui/src/blocks-stat-list.stories.tsx`          | `Patterns/Blocks/Stat List`               | ranked list w/ share bars (Sales by country) · leaderboard · transaction/activity feed                                  |
| Integration grid       | `packages/ui/src/blocks-integration-grid.stories.tsx`   | `Patterns/Blocks/Integration Grid`        | integration cards (icon + name + desc + connect/manage + status) + header "Add"                                         |
| Form wizard            | `packages/ui/src/blocks-form-wizard.stories.tsx`        | `Patterns/Blocks/Form Wizard`             | `Wizard` horizontal stepper · 4-step checkout (Customer → Shipping → Payment → Review) · correct `autocomplete`/`type`  |

**Verification (honest):**

- ✅ `tsc --noEmit` — **0 errors** across `@qlik-coe-emea/qlabs-components-charts` AND `@qlik-coe-emea/qlabs-components-ui` (incl. all 5 files).
- ✅ `eslint` — **clean** (exit 0) on all five; **no raw colors** (token boundary holds).
- ⚠️ **NOT visually verified.** Storybook could not render in this environment, so the
  three-theme sweep (qlik-bright / qlik-dark / blueprint) and `run-story-tests` (interaction +
  axe) were **not** run. These are token-only candidates, not "theme-safe verified." **Next
  step on a Mac:** `pnpm storybook`, sweep the five `Patterns/Blocks/*` in each theme, and
  `pnpm --filter @qlik-coe-emea/qlabs-components-docs test-storybook`.

---

## Proposal: where each lands

The exemplars are **stories** (copy-reference) today. To become first-class "options" they
split three ways:

1. **Primitive enrichment** (a component change, route via `brand-ui-design-system-architect`):
   `ChartCard` gains `kpi` / `period` / `footer` slots; `Wizard` gets a documented
   horizontal-stepper variant. The exemplars are the visual spec.
2. **New compositions → registry blocks** (copy-own, D4): `IntegrationGrid`, `RankedList`/
   `Leaderboard`, `ActivityFeed`, `GoalCard`, `KpiBanner`, and the curated chart blocks —
   registered like the existing `stat-card-*-01` blocks so they're `npx shadcn add`-able.
3. **Variant matrices**: the sparkline stat card needs area/bar/line variants; the chart
   blocks need donut-with-center-total, gauge KPI, and radar. These fill out the "more
   options" the references demonstrate.

Tracked as issues (per the issue-workflow) — see below. This doc + the 5 exemplars are the
finding and the reference implementations; the issues carry the productization.

---

## Issues filed

The productization is tracked as four implementation-ready issues (agent-finding template,
labelled), each referencing this doc + its exemplar:

- **#249** [charts] Elevated stat cards + KPI chart cards — enrich `MetricCard`/`ChartCard` +
  curated chart blocks.
- **#250** [ui] Dashboard summary widgets — ranked list / leaderboard, goal card, activity &
  transaction feed, KPI banner.
- **#251** [ui] Integration grid block + horizontal multi-step form-wizard variant.
- **#252** [registry] Promote the five `Patterns/Blocks/*` exemplars to installable
  `registry:block` items + the full variant matrices.

This doc + the five verified exemplars are the finding and the reference implementations; the
issues carry the productization (component-API changes via the architect; copy-own blocks via
the registry).
