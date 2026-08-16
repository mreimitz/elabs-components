# 16 · shadcnblocks + AI-chat scouting — block recommendations

**Date:** 2026-06-20 · **Method:** four parallel agent-browser subagents drove live
(isolated browser sessions) over 8 shadcnblocks groups + the shadcnuikit ai-chat-v2 page,
reading each gallery's accessibility snapshot (descriptive block names) and screenshotting
the most valuable previews. **Lens:** layout/composition concepts (NOT theme) to add as
brand-ui options.

> Sibling of `15-elevated-blocks-gap-analysis.md`. That pass covered dashboard widgets;
> this one covers shells, charts, content, comparison, gallery, background texture, and the
> AI composer.

---

## What was rebuilt this pass (2 verified exemplars)

| What                                                         | File                                                  | Title                              | Notes                                                                                                                                                                                                                             |
| ------------------------------------------------------------ | ----------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AI "double card" composer** (the user's explicit favorite) | `packages/ai/src/blocks-ai-composer.stories.tsx`      | `Patterns/Blocks/AI Composer`      | Real `PromptInput` + `Suggestions` framed as a rounded two-tone double card (outer `bg-card` + inner `bg-surface-muted` well), notice strip, rounded-full model pill, circular primary send, suggestion chips, centered greeting. |
| **Comparison Table** (the top cross-cutting gap)             | `packages/ui/src/blocks-comparison-table.stories.tsx` | `Patterns/Blocks/Comparison Table` | Plan/feature matrix: featured column, check/dash/value cells, price + CTA rows. `Table` + `Badge` + `Button`.                                                                                                                     |

Both: **tsc 0 errors**, **eslint clean**, **no raw colors**. ⚠️ **Not visually verified** (no
Storybook here) — three-theme sweep + `test-storybook` still owed on a Mac.

**Composer fidelity note:** the reference tints the OUTER card and keeps the inner WHITE.
brand-ui's `PromptInput` hardcodes a `bg-surface-muted` inner ("surface" InputGroup
variant), so the rebuild inverts to a lighter `bg-card` outer + recessed inner well — the
exact tinted-outer/white-inner look would be a `PromptInput` `tone` prop (tracked).

---

## Findings by group (valuable blocks → brand-ui status)

### Application Shell (14)

- **IDE-Style File Explorer (9)** — activity icon-rail → file tree (git M/U badges) → main — **missing (= archetype-A tool/workspace shell)** → already tracked **#245** (StatusBar + tool shell).
- **Two-tier sidebar + org switcher (12)** — tenant switcher atop grouped nav — **partial** (no OrgSwitcher).
- **Inset sidebar icon-collapse (2)**, **Floating sidebar (5)**, **Support ticket master-detail (10)** — **partial** (covered by our admin-console / object-detail-hub).

### Chart Group (15)

- **Full Analytics Bento Dashboard (14)** — page header + preset/date-range control + KPI row + chart grid — **partial** (have the tiles; missing the assembled, filter-headed dashboard block).
- **Revenue + Date-Range Picker (11)** — chart bound to a range control — exposes the **missing `DateRangePicker` primitive** (needed by almost every dashboard).
- Stats-row-over-chart (7), donut+bar pair (6), infra-monitoring gauges (10) — mostly **have** (MetricGrid + ChartCard + Gauge/Sparkline).

### Compare (10) — biggest content gap

- **3-column feature table w/ tooltips (7)**, **three-model metric table (9)**, **tab-assisted comparison (6)** — **missing** → **rebuilt** (`Comparison Table`). Belongs in `@qlik-coe-emea/qlabs-components-marketing` (`ComparisonTable`) on `@qlik-coe-emea/qlabs-components-ui` `Table`.

### Changelog (7)

- **Sticky version+date rail (1)**, **on-this-page TOC (8)** — **missing** but **cheap** (`Timeline`/`RevisionTimeline` already exist) → `ChangelogFeed`.

### Case Study (3)

- **Long-form w/ metrics + sidebar (1)** — **missing** → `CaseStudy` (MetricGrid + editor Prose + sticky sidebar). Plays to our charts strength.

### Blog Post (7)

- **Article w/ sticky sidebar (2)**, **breadcrumbs + share rail + back-to-top (4)** — **missing** → `ArticleLayout` wrapping `@qlik-coe-emea/qlabs-components-editor` Prose.

### Gallery (34)

- **Lightbox image grid (33/34)** — **missing** (no lightbox anywhere) → `Dialog` + `AspectRatio` + `ScrollArea`. High reuse (product shots, evidence panels).
- **Masonry / asymmetric column (28/31)**, **image-carousel preset** — **partial/missing** (have `Carousel`, no image-gallery preset).

### Background Pattern (52)

- **Directional dot/line-grid FADE masks (7-9, 111-117)** — **partial** → ship as token-driven `mask-image` fade utilities **extending the existing `--decoration` system** (systemic, not hand-placed widgets).
- **Glow / mesh / noise gradients (95-100)** — **missing** → only if mapped to semantic `--chart-*`/`--primary` tokens (never raw hex; they fight qlik-dark otherwise).
- ⚠️ Full-bleed grids **conflict** with blueprint's squared grid — ship only the fade-mask gesture.

### AI chat (shadcnuikit ai-chat-v2)

- **Double-card composer** — **rebuilt** (`AI Composer`). Missing pieces for the exact look: a `PromptInput` two-tone `tone` variant, a notice-strip slot, rounded-full circular send + model pill, and a gradient-orb greeting block.
- **Suggestion chips under composer**, **two-pane thread layout**, **greeting empty-state** — mostly **have** (`Suggestions`, `ChatShell`); the greeting block is composable.

---

## Recommendations (ranked) + issues filed

1. **`DateRangePicker` + preset-range control** — missing primitive, blocks every dashboard → **#253** (P1).
2. **AI two-tone composer**: `PromptInput` `tone` variant + greeting empty-state block (productize the rebuild — the user's favorite) → **#254**.
3. **Content/marketing family**: `ComparisonTable` (rebuilt) + `ChangelogFeed` + `CaseStudy` + `ArticleLayout` → **#255**.
4. **Gallery**: lightbox grid + masonry + image-carousel preset → **#256**.
5. **Background fade-mask utilities** extending `--decoration` (gate colorful gradients behind semantic tokens) → **#257**.
6. **Assembled analytics dashboard page block + org switcher** (two-tier sidebar) → **#258**.
   Plus: IDE/tool-workspace shell already tracked (**#245**); promote the 2 rebuilt blocks to installable registry items (folds into **#252**).
