# ADR 0039 — Responsive chart contract: container breakpoints, `Responsive<T>`, plot height

- **Status:** Accepted — confirmed by the maintainer on 2026-09-18 with three changes (the middle
  tier is named `medium`; `narrow` applies the full `sm` density; framed charts drop the 260 px
  body in this minor). See "Maintainer confirmation" below.
- **Date:** 2026-09-18
- **Deciders:** maintainer (drafted by `brand-ui-component-builder` for RM-107)
- **Context:** `docs/review/2026-09-18-datawrapper-gap-analysis.md` §4 (Datawrapper's responsive
  model, ours, and the design to adopt); `docs/review/datawrapper/dw-blog-responsive.md`;
  `docs/review/datawrapper/ours-inventory.md` §3
- **Issue:** #476 (RM-107). Blocks RM-110, RM-111, RM-112, RM-113, RM-114, RM-117, RM-118,
  RM-120, RM-123, RM-125; RM-108 and RM-109 build against it in parallel.
- **Related:** ADR [0012](./0012-metric-card-canonical-home.md) (a shared need moves _down_, never
  sideways), ADR [0020 taste profile](./0020-taste-profile.md) (the app-wide `density` taste axis —
  a different knob from the chart `density` tier), ADR
  [0037](./0037-dashboard-surface-in-charts-subpath.md) (the sheet computes the chart `density`
  tier from tile pixels), [`DEPRECATION.md`](../DEPRECATION.md), `.claude/rules/charts.md`

## Context

### What a chart does with its own width today

- **Sizing.** Every container measures itself — visx `ParentSize` (10 ms debounce; 100 ms on bar,
  area and radar) or `react-use-measure` — inside a root whose height comes from a CSS
  `aspectRatio` string prop. The default is `"2 / 1"` for line, area, bar, composed, candlestick,
  scatter, dumbbell, bump, sankey and parallel coordinates; `"16 / 9"` for network, treemap,
  choropleth and heatmap (`"6 / 1"` for the calendar heatmap); pie, ring and radar are
  `aspect-square` or a fixed `size`; funnel is `"2.2 / 1"` or `"1 / 1.8"` by orientation; the unit
  chart derives its box from the data; distribution fills its parent; waterfall takes an optional
  px `height`.
- **Frame.** `ChartFrame` gives its body an inline `height ?? 260` px with `overflow-auto`, except
  `chrome="tile"` without `height`, which fills the host (#444). `AutoChart` has its own
  `height` (default 280) that it applies as the body height, or as a `minHeight` floor for the
  families that size by aspect.
- **What reacts to width.** The category-axis fit cascade, LTTB decimation, tick-label de-dupe and
  tooltip clamping. Tick counts, fonts, margins, legend placement, date format and annotation
  placement are static.
- **Simplification.** Only the host-supplied `density` tier (`xs | sm | md | lg`, RM-072), which
  only the dashboard sheet computes.
- **By construction** (read from the code, not observed in a browser): a 2 : 1 chart in a card
  frame is `width / 2` tall inside a 260 px body, so any chart wider than 520 px is taller than
  its body and scrolls inside it, and any narrower one leaves an empty band below it.

### What Datawrapper does (review §4.1)

Element width, never the viewport. Fonts never scale. The author sets the _plot_ height (px or %
of width), which excludes header, colour key, annotation key and footer, so a wrapping title
never squeezes the data. Ticks thin, labels relocate, annotations become a numbered key, facets
collapse, and "show on desktop / mobile" overrides appear wherever an option is per-device.

## Decision

### 1. Breakpoints: three container tiers at 480 and 768 px

```ts
export type ChartBreakpoint = "narrow" | "medium" | "wide";

/** A width below `narrow` is narrow; below `medium` is medium; anything else is wide. */
export const CHART_BREAKPOINT_THRESHOLDS = { narrow: 480, medium: 768 } as const;

export function breakpointForWidth(width: number): ChartBreakpoint;
```

| Tier     | Container width     | Typical host                                                       |
| -------- | ------------------- | ------------------------------------------------------------------ |
| `narrow` | `< 480` px          | a phone in portrait, a sidebar, a third of a desktop dashboard row |
| `medium` | `480 ≤ width < 768` | a tablet in portrait, half of a desktop dashboard row              |
| `wide`   | `≥ 768` px          | a desktop content column, a full-width dashboard row               |

**Boundaries** belong to the wider tier: 480 is `medium`, 768 is `wide`. Widths are compared
unrounded.

**Measured** as the container root's width in CSS px by one shared hook
(`useMeasuredChartBreakpoint`, a `ResizeObserver` on the root). It is deliberately separate from
the family's drawing measurement (`ParentSize`, `useMeasure`): that width lives inside a render
prop below the root, where it can reach neither the root's attribute nor the root's own height
style without restructuring every family. The observer only re-renders when the _tier_ changes,
not on every pixel. Because browser zoom shrinks the box in CSS px,
a 1280 px desktop at 400 % zoom (320 CSS px) is `narrow`: WCAG 1.4.10 Reflow runs through the same
path as a phone.

**Not measured yet** (server render, the first `ParentSize` pass, `display: none`): a width that is
`0` or not finite resolves to `wide`, so the first paint is exactly today's layout.

**Precedence:** (1) a host-forced tier, `<ChartConfigProvider value={{ breakpoint: "narrow" }}>`
(stories, fixed-width export, thumbnails, tests); (2) the measured width; (3) `wide`. Forcing
changes the tier only — widths, decimation and the fit cascade still use the real size.

**Exposed** in two places, both always present:

- `data-chart-breakpoint="narrow" | "medium" | "wide"` on every container's root element (the one
  that carries its `ref`, `className` and root `data-slot`). It is the styling hook
  (`[data-chart-breakpoint="narrow"] …`) and the testing hook.
- `useChartBreakpoint()` for parts rendered inside a container (axes, labels, an in-chart legend),
  reading a breakpoint scope the container root provides around its whole interior. Outside any
  container it returns the enclosing `ChartFrame`'s tier, else the forced tier, else `wide`. The
  chart context's existing `width` / `height` are already the measured plot box (§3); no
  duplicate `plotSize` field is added.

`ChartFrame` measures its own body with the same hook and provides the same scope, so frame-level
parts that sit **outside** the container (a legend composed beside the chart, later the
annotation key) follow the frame's tier; the frame root carries `data-chart-breakpoint` too. There
is never a second threshold table.

**Invariants that come with the tiers:**

- **Fonts never scale.** Type roles and `--type-factor` stay the only size knobs; a tier changes how
  much is drawn, never how big the text is. A `Responsive` font size is a violation.
- **`density` stays host-driven** (RM-072), with one coupling: at `narrow`, a host density of `md`
  or `lg` becomes **`sm`** inside that scope — the full `sm` behaviour: the value axis and the
  legend are hidden, and the one remaining axis keeps at most `CHART_DENSITY_SM_MAX_TICKS` (4)
  ticks. The coupling is one-way: a wider tier never raises a host `xs` / `sm`. It is resolved
  once (`resolveDensityForBreakpoint`) and applied by the breakpoint scope, so the existing density
  readers (axes, legends) need no change.
- **Per-chart escape hatch.** The host density may itself be a `Responsive<ChartDensity>`; a value
  with an explicit `narrow` entry wins over the coupling —
  `<ChartFrame density={{ base: "md", narrow: "md" }}>` or
  `<ChartConfigProvider value={{ density: { base: "md", narrow: "md" } }}>` keeps the legend and
  the value axis on a narrow chart. Forcing the tier (`breakpoint: "medium"`) is the blunter
  alternative; it also changes the plot height.
- **No viewport media queries** in chart containers.

**Rejected alternatives**

| Option                                                                    | Verdict                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Viewport media queries (Tailwind `sm:` / `md:`)                           | rejected — the wrong axis: a chart in a sidebar, a tile or a third of a dashboard row on a desktop is narrow while the viewport is wide                                                                                                                                                                                |
| CSS container queries (`@container`) as the source of truth               | rejected — families need the tier in JS (tick targets RM-108, label placement RM-110, annotation keys RM-111); an element cannot query its own size without a wrapper; a CSS-only tier cannot be forced by a host. May later help the first paint of the plot aspect, never as a second source                         |
| Continuous functions of width only, no tiers                              | rejected — tick targets can and will be continuous (RM-108), but an authored per-device override needs a name to hang on; nobody writes a value per pixel                                                                                                                                                              |
| Two tiers (Datawrapper's desktop / mobile)                                | rejected — no answer for the half-row dashboard cell or a tablet, where a desktop layout crowds; three is the fewest that separates phone, half row and full row                                                                                                                                                       |
| Thresholds 450 / 700 (Datawrapper's table switch / "desktop ≈ 700")       | rejected — the widest phones in portrait are about 430–440 CSS px, so 450 sits on the edge of a full-bleed phone chart; 480 clears every phone with room. 768 matches Tailwind's `md` viewport rung and its `@3xl` container rung (48 rem), so an app whose layout switches at `md` hands its charts a consistent tier |
| A hysteresis band around each threshold                                   | rejected — with the default plot heights (§3) a narrower chart is never shorter, so a page scrollbar that appears because the chart grew cannot flip it back; a flip-flop needs a narrower state that is also shorter (see Watch for)                                                                                  |
| A fourth `unmeasured` value, or no attribute until measured               | rejected — every consumer would handle a fourth case, and the contract test and check rule want the attribute on every render; `wide` reproduces today's first paint                                                                                                                                                   |
| Middle tier named `compact` (RM-107's wording)                            | rejected by the maintainer — `compact` already means a number notation (`valueFormat="compact"`, `1.2k`) and an app density (`data-density="compact"`, ADR 0020), and in Apple's size classes "compact" is the phone. The tier is `medium`                                                                             |
| At `narrow`, apply only the `sm` tick ceiling; keep legend and value axis | rejected by the maintainer — the draft's choice; the RM's literal wording (the full `sm` behaviour) stands, with the `Responsive` density escape hatch above for a chart that must keep its key                                                                                                                        |

### 2. `Responsive<T>`: desktop-first overrides with a cascade

```ts
export interface ResponsiveByBreakpoint<T> {
  /** The value at `wide`, and the fallback for every tier that sets nothing. */
  base: T;
  /** At `medium` — and at `narrow` too, unless `narrow` is set. */
  medium?: T;
  /** At `narrow` only. */
  narrow?: T;
}

export type Responsive<T> = T | ResponsiveByBreakpoint<T>;

export function resolveResponsive<T>(value: Responsive<T>, breakpoint: ChartBreakpoint): T;
/** `resolveResponsive(value, useChartBreakpoint())`. */
export function useResponsiveValue<T>(value: Responsive<T>): T;
```

**Resolution rule — the whole of it:**

| Breakpoint | Result                                |
| ---------- | ------------------------------------- |
| `wide`     | `base`                                |
| `medium`   | `medium ?? base`                      |
| `narrow`   | `narrow ?? medium ?? base`            |
| any        | a plain `T` is returned at every tier |

An override applies at its own tier and at every narrower tier that does not set its own
(a max-width cascade). "Not set" means `undefined`; `null` is a real value when `T` admits it.

**Detection.** A value is a `ResponsiveByBreakpoint` when it is a non-null, non-array object with
an own `base` key. Consequently `T` must never be an object type with its own `base` key; a type
test in `chart-breakpoint.test.ts` pins this. `T = { aspect: number }` (§3) is fine. There is no
`wide` key — `base` _is_ wide — and TypeScript's excess-property check rejects `{ wide: … }` in a
literal.

**Serializable.** When `T` is JSON, `Responsive<T>` is JSON, so a responsive value can later enter
`ChartSpec` and the A2UI catalog unchanged (not added by this ADR).

**Read rule.** A prop typed `Responsive<…>` is read only through `resolveResponsive` or
`useResponsiveValue`, never raw — enforced by the `charts-responsive` check rule (§6). A new
per-device option is a `Responsive<T>` prop, never a `mobileX` / `hideOnMobile` prop.

**Where it lives.** `packages/charts/src/charts/chart-breakpoint.ts` (pure functions, the hook and
the thresholds), exported from the `@elabs-ai/components-charts` barrel with `ChartBreakpoint`,
`CHART_BREAKPOINT_THRESHOLDS`, `breakpointForWidth`, `Responsive`, `ResponsiveByBreakpoint`,
`resolveResponsive`, `useChartBreakpoint` and `useResponsiveValue`.

**Rejected alternatives**

| Option                                                        | Verdict                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile-first `{ base (= narrow); medium?; wide? }` (Tailwind) | rejected — every existing default was authored for a desktop-width chart; mobile-first would force each existing scalar to be restated as the phone value the day it becomes responsive. Desktop-first turns `3` into `{ base: 3, narrow: 1 }` without rethinking `3` |
| No cascade (`narrow` falls straight back to `base`)           | rejected — `{ base: 3, medium: 2 }` would give three facet columns on a phone and two on a tablet                                                                                                                                                                     |
| All-optional `{ narrow?; medium?; wide? }`                    | rejected — needs a separate default and an answer for `{}`                                                                                                                                                                                                            |
| Tuple `[wide, medium?, narrow?]`                              | rejected — unreadable in JSX and in an agent-emitted spec; position is a trap                                                                                                                                                                                         |
| Sibling props (`plotHeight` + `plotHeightNarrow`, `mobile*`)  | rejected — props × tiers; the API shape of Datawrapper's duplicated "show on desktop / mobile" switches                                                                                                                                                               |
| A function `(breakpoint) => T`                                | rejected — not serializable, so it can never enter `ChartSpec` or the A2UI catalog                                                                                                                                                                                    |

### 3. `plotHeight`: the height of the drawing, not of the box around it

```ts
/** CSS px, or the plot's width ÷ height (`{ aspect: 2 }` = twice as wide as tall). */
export type ChartPlotHeight = number | { aspect: number };

plotHeight?: Responsive<ChartPlotHeight>;
```

Accepted by every container listed in RM-107's `touches`, by `ChartFrame` and by `AutoChart`.

**What it sets.** The height of the **plot box**: the container root the family measures, which is
the `<svg>` it draws — margins, axes, tick labels, gridlines and in-SVG labels are inside it. A
number sets the root's CSS `height`; `{ aspect }` sets CSS `aspect-ratio: <aspect> / 1`. It is not
the inner drawing area: that stays `innerHeight` on the chart context (plot height minus margins).
`distribution-chart.tsx` currently names its inner area `plotHeight` locally; that local is
renamed during implementation so the word has one meaning.

**What it excludes.** The frame header (title, description), the toolbar, any HTML legend or colour
key (whether a family renders it — unit chart, sankey — or the consumer composes it), the
annotation key (RM-111), the source / notes row, and any other HTML a family renders outside its
`<svg>`. These stack around the plot and the frame grows to hold them:

> frame height = header + legend + plot + annotation key + source row

So a two-line title makes the frame one line taller and leaves the `<svg>` exactly as tall.

**Defaults** (each family exports its default as a `Responsive<ChartPlotHeight>` constant):

- Families whose default today is `"2 / 1"` — line, area, bar, composed, candlestick, scatter,
  dumbbell, bump, waterfall, sankey, parallel coordinates:
  `{ base: { aspect: 2 }, narrow: { aspect: 1.25 } }`. A 900 px chart is 450 px tall, a 600 px chart
  300 px, a 380 px chart 304 px.
- Every other family keeps its current default at every tier: pie, ring and radar `{ aspect: 1 }`;
  network, treemap, choropleth and heatmap `{ aspect: 16 / 9 }`; the calendar heatmap
  `{ aspect: 6 }`; funnel `2.2` or `1 / 1.8` by orientation; the unit chart and distribution keep
  their data- or parent-derived sizing. Their `narrow` value belongs to the item that reflows
  that family (for example RM-125 for map height), not to this ADR.

**Precedence** — the first rung that speaks wins:

0. A host's forced plot height, `ChartConfigProvider value={{ plotHeight }}` (added 2026-09-25,
   see the addendum below): px, `{ aspect }`, or `"fill"`. It overrides rungs 2–5 for every chart
   inside; rung 1 (`size`) still wins.
1. `size` on pie, ring and radar (a fixed square, unchanged); `plotHeight` is ignored when `size`
   is set.
2. The container's own `plotHeight`.
3. The container's `aspectRatio`, kept as an alias (not deprecated here): a ratio CSS accepts
   (`"2 / 1"`, `"1.5"`) maps to `{ aspect }`; `"auto"` means "no height of my own" and defers to
   rung 4, or — outside a frame — to the caller's CSS (today's "omit to fill a sized parent").
4. The enclosing `ChartFrame`: its `plotHeight` (or its deprecated `height`, §4), resolved against
   the container's own tier; or, for `chrome="tile"` with neither, **fill** — the plot takes the
   body's remaining height (the #444 behaviour, now reaching the chart instead of stopping at the
   body). Delivered through an internal context that the package barrel does not export, the same
   pattern as `ChartFrameProvider`.
5. The family default.

**Validation.** A number must be finite and `> 0`, an aspect finite and `> 0`; anything else is
ignored (the next rung applies) with a one-time dev warning.

**No clamp.** `{ aspect: 2 }` at 1600 px is 800 px tall, exactly as a bare chart is today. An author
who wants a ceiling writes px, per tier if needed.

**Rejected alternatives**

| Option                                                             | Verdict                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep a fixed frame body (260 px) and fit the chart into it         | rejected — the status quo: a wrapping title or a legend squeezes or scrolls the data, and body and plot disagree at every width but one                                                                                                                                                                                                                                                |
| `height` = total frame height; the frame subtracts measured chrome | rejected — needs a measure-then-layout pass (a visible jump), and a two-line title silently shrinks the plot, the exact failure Datawrapper's model exists to prevent                                                                                                                                                                                                                  |
| Datawrapper's authoring form, a `"56%"` string                     | rejected — `{ aspect }` is the same idea as a typed, serializable number that maps 1 : 1 onto CSS `aspect-ratio`; a percent string needs parsing and invites a "% of the parent's height" misreading                                                                                                                                                                                   |
| A public `"fill"` value in `ChartPlotHeight`                       | rejected — its one real consumer, the dashboard tile, gets fill from the frame (rung 4); a public `fill` invites a 0 px chart in an unsized parent. Filling a sized parent stays expressible as `aspectRatio="auto"` plus the caller's CSS; revisit on a second host (revisited 2026-09-25: the expand view is that host — see the addendum; the chart's own prop still has no `fill`) |
| Inner-area height (axes excluded)                                  | rejected — an author cannot predict axis and label margins, and the measurable thing is the `<svg>`; the inner area stays `innerHeight` on the context                                                                                                                                                                                                                                 |

### 4. Deprecating `ChartFrame height` (and the other two px `height` props)

**Chosen.**

- `ChartFrame height?: number` becomes a **deprecated alias for `plotHeight={height}`**. The number
  now sets the plot (§3), not the body; the body gets no inline height. When both are passed,
  `plotHeight` wins.
- The same treatment, in the same release, for **`AutoChart height`** (its 280 px default is
  dropped: with neither prop it uses the frame's or the family's default, and its `minHeight`
  floors become exact heights) and **`WaterfallChart height`** (a px alias for `plotHeight={n}`).
- **What warns.** A dev-only `console.warn`, once per deprecated prop per page load (a module-level
  set — the once-per-message pattern `chart-context.tsx` already uses for palette warnings),
  silent when `NODE_ENV` is `production`. It fires whenever the prop is passed, including next to
  `plotHeight`:
  `[ChartFrame] "height" is deprecated and will be removed in 5.0.0. Use "plotHeight": it sets the chart's own height, and the title, legend and notes are added around it.`
- **How it is marked** (DEPRECATION.md §1): `@deprecated` JSDoc naming `plotHeight`; a Storybook
  autodocs note on `ChartFrame`, `AutoChart` and `WaterfallChart`; a changeset (minor) with a
  "Deprecated" line.
- **When it is removed.** In the next major, **5.0.0** (lockstep; DEPRECATION.md §2) — never in a
  4.x release. The 5.0.0 changelog carries the numbered migration steps below.
- **What consumers change.**
  1. `height={n}` → `plotHeight={n}` — a mechanical rename, on all three components.
  2. If `n` was chosen to make room for a legend or notes composed inside the frame body next to the
     chart, lower it by their height or drop it: they are now added around the plot.
  3. To keep the exact look of a card whose body was 260 px, write `plotHeight={260}`.
- **What changes with no consumer edit** (the visible part, shipping in a minor, called out in the
  changeset): a card `ChartFrame` without `height` no longer boxes its chart at 260 px. The frame
  is as tall as its content, so a default 2 : 1 chart 800 px wide is 400 px tall instead of
  scrolling inside a 260 px body, and a 380 px chart is 304 px tall. `plotHeight={260}` keeps the
  old look; the changeset and the 5.0.0 migration note say so. Dashboard tiles (`chrome="tile"`)
  are unaffected: a tile without `height` fills its host as before, and the chart inside fills
  with it.

**Rejected alternatives**

| Option                                                  | Verdict                                                                                                                                                                                                     |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Remove `height` now                                     | rejected — a removal in a minor; DEPRECATION.md §2 forbids it                                                                                                                                               |
| Keep `height` with its body meaning beside `plotHeight` | rejected — two height models in one frame; `height` would keep clipping legends and notes, and every later item (RM-111 annotation key, RM-118 legend) would need an answer for both                        |
| Alias silently, no warning                              | rejected — consumers would first learn of it when 5.0.0 breaks their build                                                                                                                                  |
| Warn per instance or per render                         | rejected — a dashboard of forty tiles floods the console with one message                                                                                                                                   |
| Keep 260 px as the frame default until 5.0.0            | rejected — it keeps the scroll-inside-the-card defect for a whole major and makes every later reflow item (RM-110, RM-111, RM-118) solve for a fixed body first; `plotHeight={260}` is the one-line opt-out |

### 5. Reflow ownership — what this ADR does not change

RM-107 changes no family's _drawing_ beyond honouring the plot height and publishing the tier.
The reflow rules land per item, each reading the tier through `useChartBreakpoint()` /
`useResponsiveValue()` and none adding a second threshold table: RM-108 ticks, RM-110 labels,
RM-111 annotations (numbered key), RM-118 legend position, RM-120 facets, RM-123 table columns,
RM-125 map height.

### 6. Gate

- **Contract test** `packages/charts/src/__contract__/responsive.contract.test.tsx`: every exported
  container rendered in a 380 / 600 / 900 px box reports `narrow` / `medium` / `wide`; a new
  container that forgets the attribute fails it.
- **Check rule** `pnpm check --rule charts-responsive`: every file exporting a container under
  `packages/charts/src/charts/**` renders `data-chart-breakpoint`, and a `Responsive<…>` prop is
  read only through `resolveResponsive` / `useResponsiveValue`; a failing fixture lives under
  `scripts/check/fixtures/`.
- **Storybook** `Charts/Responsive`: every family in a 380 / 600 / 900 px column trio (a CSS grid,
  not the viewport), plus 380 / 600 / 900 viewport presets in `apps/docs/.storybook/preview.tsx`
  for the driven check — screenshots in both themes quoting `data-chart-breakpoint` and the
  measured `<svg>` height.
- **Rule text**: `.claude/rules/charts.md` gains a "Responsive" section with the thresholds, the
  no-font-scaling rule, the plot-height model and the `Responsive<T>`-never-`mobile*` rule.

## Consequences

- Every container gains one root attribute and one plot-height resolution; each edit stays inside
  the family's measured-size block.
- The charts barrel gains the names listed in §2 plus `ChartPlotHeight`. `ChartConfigValue` gains
  an optional `breakpoint` (the forced tier), and its `density` input accepts a
  `Responsive<ChartDensity>`; `ChartFrame` gains `plotHeight` and a `Responsive` `density`.
- One visible change ships in a minor: framed charts take their plot's height instead of 260 px
  (§4), disclosed in the changeset with the one-line opt-out.
- One new check rule, `charts-responsive`.
- `MetricGrid` keeps its viewport media queries; it is not a chart container, and moving it onto a
  container tier is a separate follow-up, not decided here.

## Watch for

- **`base` means the opposite of Tailwind's unprefixed class.** Here `base` is the wide value and
  overrides go _down_; in Tailwind the unprefixed class is the phone and prefixes go up. The JSDoc
  on `ResponsiveByBreakpoint` says so; a review that sees `{ base: <phone value> }` should ask.
- **Copies of the threshold table.** RM-123 (`data`) and RM-125 (`maps`) plan documented copies,
  because neither package may import `charts`. RM-123's table switch is 450 px and is also called
  `narrow`, so two different "narrow"s would exist. When the second copy lands, ADR 0012's move —
  the pure module (types, thresholds, `breakpointForWidth`, `resolveResponsive`) down into `ui` —
  is the question to put to the maintainer.
- **Author values that make a narrower chart shorter** (`{ base: 400, narrow: 200 }`) can flip-flop
  at a threshold when a page scrollbar appears and disappears. Not guarded; revisit on a report.
- **Unclamped aspect at very wide widths** (§3). Revisit if full-bleed dashboards complain.
- **A `Responsive` font size or font-bearing prop** — a breach of the fonts-never-scale invariant.

## Maintainer confirmation (2026-09-18)

The maintainer answered in chat on 2026-09-18:

1. Container-measured tiers `narrow < 480`, `< 768`, `wide`, exposed as `data-chart-breakpoint`
   and on the chart scope, forceable by the host (§1) — accepted.
2. The middle tier is renamed **`compact` → `medium`** everywhere: the `ChartBreakpoint` union,
   the `Responsive<T>` key, the attribute value, stories, tests and docs (§1, §2) — changed.
   `compact` number notation and `compact` app density are unchanged.
3. `narrow` applies the **full `sm` density** — legend and value axis hidden, 4-tick ceiling — with
   a per-chart override kept (§1) — changed from the draft.
4. `Responsive<T> = T | { base; medium?; narrow? }` with the cascade `narrow → medium → base`
   (§2) — accepted.
5. `plotHeight` is the drawing only; defaults `{ aspect: 2 }`, and `{ aspect: 1.25 }` at `narrow`
   (§3) — accepted.
6. `ChartFrame` / `AutoChart` / `WaterfallChart` `height` → deprecated alias with one dev warning,
   removed in 5.0.0 (§4) — accepted. Framed charts drop the 260 px body **in this minor**;
   `plotHeight={260}` is the documented way back; tiles are unaffected — accepted.

## Addendum (2026-09-25): a host's forced plot height

The expand view is the second host the `fill` row above waited for. An expanded chart kept the
size it was authored at — its own `plotHeight`, or 2 : 1 of the pane's width — so `ChartFrame`'s
expand dialog and the website's enlarged examples showed the chart with a third of the pane
empty. A chart's own `plotHeight` (rung 2) outranks the frame (rung 4), so no frame value could
fix it.

- `ChartConfigValue.plotHeight?: ChartHostPlotHeight` (`ChartPlotHeight | "fill"`) is rung 0.
  It is a HOST setting, like the forced `breakpoint`: the chart's own props gain nothing.
- `"fill"` is `height: 100%` with the chart's own size as the fallback — a px value becomes
  `min-height`, a ratio stays as `aspect-ratio` beside `width: 100%` — so an unsized parent
  keeps the authored size instead of a 0 px plot (the reason the chart-level `fill` was rejected).
- It cascades: a nested `ChartConfigProvider` inherits it unless it sets its own, so an app's
  provider for `interactions` cannot undo an expand view.
- `ChartFrame`'s expand dialog sets `"fill"`. The docs app's `expand-fit` decorator sets a
  measured px value for the website's enlarged view, where story wrappers break the height chain;
  it first lifts the story's own fixed box (`h-72 w-[560px]`) around each chart, and puts a
  story whose height does not follow the plot height (sparkline, gauge, Gantt) back as authored.
