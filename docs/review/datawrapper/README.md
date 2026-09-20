# Datawrapper research files (input to `docs/review/2026-09-18-datawrapper-gap-analysis.md`)

Collected 2026-09-18. Each file is a primary-source transcription with URLs; items that could not be confirmed on a Datawrapper page are marked **[unverified]** inside the files.

| File                    | What it answers                                                                                                                                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dw-charts.md`          | The 23 chart types; every Refine / Annotate / Layout setting per type (tables); number formats, tooltips, colour, axes, overlays, export, dark mode, accessibility; dated feature releases 2016–2026.                                   |
| `dw-tables-maps.md`     | Table features and the four in-cell mini-charts with their settings; choropleth / symbol / locator map settings; the shared colour-scale and legend components; what the River is.                                                      |
| `dw-blog-responsive.md` | How Datawrapper output adapts to width (element-width model, derived height, plot-height control, per-element mobile behaviour, embed mechanics); ~70 one-line chart-choice and design rules with sources; 2024–2026 feature direction. |
| `dw-river.md`           | Field notes from 16 River favourites opened in a real browser at 380 / 600 / 751 / 900 px: devices used, tooltip content, what changed per width, cross-cutting patterns, ideas.                                                        |
| `ours-inventory.md`     | Ground truth for `@elabs-ai/components-charts` 4.2.0: every container's public props, cross-cutting capabilities, the precise responsive behaviour with file references, the dashboard subpath, known limitations.                      |

## What to open, by question (for an agent)

The table above says what each file CONTAINS. This one says which file answers
the question you actually have — open one file, not five.

| Your question                                                        | Open                                           | Then                                                                                                                           |
| -------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| "Which chart should this data be?"                                   | `skills/brand-ui/reference/chart-selection.md` | Run `brand-ui chart-for "<your data shape>"` — the reference explains the ranking                                              |
| "What editorial rule applies here (colour, title, baseline, units)?" | `dw-blog-responsive.md` §B                     | The same rules, grouped and cross-referenced to our defaults, are in `chart-selection.md` §"Editorial rules the charts follow" |
| "What does this chart type's settings panel actually offer?"         | `dw-charts.md`                                 | Compare against our props in `ours-inventory.md` before proposing a new one                                                    |
| "How should a table or a map behave?"                                | `dw-tables-maps.md`                            | In-cell mini-charts map to `DataTable` column `meta.visual`                                                                    |
| "What changes between 380 and 900 px?"                               | `dw-blog-responsive.md` §A                     | Our tiers and what each drops: `.claude/rules/charts.md` §Responsive (ADR 0039)                                                |
| "What does a finished, well-made chart of this kind look like?"      | `dw-river.md` §2                               | Five of the sixteen are built as stories under `Charts/Recipes/River`                                                          |
| "Do we already have this prop?"                                      | `ours-inventory.md`                            | Then `brand-ui docs <Name>` for the live prop table                                                                            |

The five recipes rebuilt from River are
`packages/charts/src/recipes/river-recipes.stories.tsx` (four chart recipes) and
`apps/docs/stories/recipes/river-heatmap-table.stories.tsx` (the heatmap table,
which needs `DataTable`). Their fixtures are seeded and fictional wherever the
original data is not public domain.
