# Datawrapper — responsive behaviour, chart-choice guidance, and recent feature direction

Research date: 2026-09-18. Sources: datawrapper.de/academy, datawrapper.de/blog (incl. redirected blog.datawrapper.de / academy.datawrapper.de URLs), developer.datawrapper.de, plus data.europa.eu's data-visualisation guide (third-party, describes Datawrapper behaviour). Everything fetched via WebFetch summaries; items marked **[unverified]** were not directly confirmed on a Datawrapper page.

---

## A. Responsive design — how Datawrapper charts, tables and maps adapt to width

### A1. The core model: element width, auto height, "mobile" as a width class

- **Width is never defined by the author for embeds.** "If your visualization gets embedded, the width can't be defined; it depends on the device the visualization is viewed on." The Academy quotes typical widths of **380–400px on mobile** and **~700px on desktop**. (https://www.datawrapper.de/academy/how-to-change-the-size-of-your-visualizations)
- **Responsiveness is driven by the width of the embed container (iframe / web component), not the viewport.** The responsive iframe is styled `width: 0; min-width: 100% !important` so it always fills its parent; the visualization measures its own width inside. (https://developer.datawrapper.de/docs/custom-embed-code) — Whether they use CSS container queries vs. JS `ResizeObserver` internally is **[unverified]**; behaviour is element-width based either way.
- **Height is always derived, never a fixed embed height.** Since the "mobile-first" release (Nov 3, 2016) "charts automatically extend to the correct height when you embed them. There's nothing to scroll for your users, and there's no gap below the chart." (https://www.datawrapper.de/blog/datawrapper-becomes-mobile-first-charting-tool)
- **Two-tier height derivation:**
  1. **Data-driven height (no author control):** bar charts (each bar has a fixed thickness → height = f(number of rows)), dot / range / arrow plots (row count), pie/donut/election donut (depends on width, via pie diameter), choropleth & symbol maps ("automatically calculated according to the width of the visualization" and the base map's shape), tables (rows per page). (https://academy.datawrapper.de/article/365-i-cant-customize-the-height-of-the-visualization)
  2. **Author-controlled _plot_ height** (since Mar 22, 2024) for line, area, scatter, column (regular/grouped/stacked) and locator maps: choose **fixed plot height in px** (same plot height at 400px and 700px width) **or width-relative plot height** (constant aspect ratio, "100% based on width" = square). "Plot" = chart area _excluding_ header, footer, color key and annotations, so title wrapping on mobile never squeezes the data area. Set via dragging a pink handle or typing px in Refine tab. Applies only to responsive embeds; static exports (PNG/PDF/SVG) have a separate _total_ height. (https://www.datawrapper.de/blog/responsive-height-control, https://www.datawrapper.de/academy/how-to-change-the-size-of-your-visualizations)
- **Total height = header (title/description, wraps) + color key (may stack) + plot + annotation key (mobile) + footer.** Each part reflows independently, then the iframe is resized to the sum via postMessage (see A2).

### A2. Embed mechanics (developer-facing)

Three embed types (https://www.datawrapper.de/academy/how-to-embed-charts):

| Embed                                    | Width                     | Height                                                      | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------- | ------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Script / web component** (recommended) | fills parent              | auto (content)                                              | `<div style="min-height:442px"><script src="https://datawrapper.dwcdn.net/{ID}/embed.js" ...></script></div>` inserts a `<datawrapper-visualization>` custom element. `min-height` is only a layout-shift placeholder (= published height). Styles encapsulated (shadow DOM); fonts injected if missing. Render flags as `data-*` attrs (`data-dark="true"`, `data-logo="on"`), `data-target` for a CSS selector, programmatic `datawrapper.render(embedData, { target, flags })`. (https://developer.datawrapper.de/docs/web-components, https://www.datawrapper.de/blog/web-component-embedding) |
| **Responsive iframe**                    | `width:0; min-width:100%` | auto via **postMessage**                                    | iframe posts `{ 'datawrapper-height': { [chartId]: px } }`; a once-per-page listener does `iframe.style.height = event.data['datawrapper-height'][chartId] + 'px'`. Iframe `src` is `https://datawrapper.dwcdn.net/{ID}/`. (https://developer.datawrapper.de/docs/responsive-iframe)                                                                                                                                                                                                                                                                                                               |
| **Plain iframe**                         | fixed `width`             | fixed `height` (e.g. `height="578"`, value at last publish) | Not responsive; "might look cut-off or not fit the full width".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

- **Failure mode documented:** if a CMS strips the JS, charts are "cut off on mobile" or have "too much space underneath", because "line breaks in the headline might result in the visualization taking up more space on mobile". (https://www.datawrapper.de/academy/my-embedded-charts-are-cut-off-or-have-too-much-space-underneath)
- **Custom embed templates** expose `%chart_width%`, `%chart_height%` (dimensions at last publish), `%embed_js%` (the standard resize snippet, "identical for every visualization"), `%aria_description%`, etc. (https://developer.datawrapper.de/docs/custom-embed-code)
- **Render flags** (query params on iframe URL or `data-*` on script): `dark=true|false|auto`, `plain=true` (no header/footer), `static=true` (no interactivity), `transparent=true`, `logo=on|off`, `logoId`, `search=<text>` (tables). No mobile-forcing flag documented. (https://www.datawrapper.de/academy/how-to-style-embedded-visualizations)
- **Dark mode**: auto via `prefers-color-scheme` when the "automatic dark mode" toggle is on (Layout tab); colors converted by a contrast-preserving algorithm (each element keeps the same contrast against the background); optional "use the same colors in dark mode"; `.hide-in-dark` / `.hide-in-light` CSS classes for custom HTML. (https://www.datawrapper.de/blog/dark-mode-for-embedded-visualizations, Jan 26 2022; https://www.datawrapper.de/academy/dark-mode-in-embedded-datawrapper-visualizations)

### A3. What concretely changes at narrow widths (per element / chart type)

Datawrapper does **not publish a numeric list of breakpoints**. The only hard number found is the table card-view threshold (**< 450px**). Everything else is described as "mobile" vs "desktop" (the editor's preview buttons: mobile / tablet / desktop). The chart-level "mobile" threshold is **[unverified]** (community knowledge suggests roughly ≤ 400–480px container width, which matches their "380–400px on mobile" statement).

**Line charts**

- Direct line labels (placed in a right-hand "label margin") **move into a color key at the top on mobile**: "on mobile screens, that margin gets ignored, and all line labels move into a color legend at the top." (https://www.datawrapper.de/academy/customizing-your-line-chart; first announced Nov 2016 "line charts switch from direct labeling to legend-based labeling")
- **Fewer x-axis ticks** at narrow widths and more compact date formats — the EU guide points readers to "the difference in the way the lines are labeled, and the number of tick marks on the x axis" when resizing a Datawrapper chart. (https://data.europa.eu/apps/data-visualisation-guide/accessibility-in-datawrapper) — exact tick algorithm **[unverified]**.
- **Automatic value labels** (Sep 18, 2024) use collision avoidance and thin out automatically: "won't overlap each other or your lines. That's also true on mobile." Modes: all points / first & last / "peaks and troughs" auto-selection. (https://www.datawrapper.de/blog/automatically-label-values-in-line-charts)
- Plot height: fixed px or width-relative (A1).

**Column charts (incl. grouped/stacked)**

- X-axis label rotation setting: **auto / always / never** — "auto" rotates only when labels don't fit horizontally. (https://academy.datawrapper.de/article/44-customizing-your-column-chart)
- Value labels "on hover or always at the top of columns".
- Plot height fixed or width-relative (A1).
- Guidance rather than automation: "A bar chart is often a safer pick for small screens than a column chart, since it grows vertically rather than horizontally." (https://www.datawrapper.de/blog/chart-types-guide) — i.e. Datawrapper does **not** auto-switch column → bar.

**Bar charts / dot / range / arrow plots**

- Height grows with row count; bars keep a fixed thickness regardless of width, so narrow screens just shorten bars. Label options: align labels left/right or "display them in a separate line" (author choice; used to make room on mobile). (https://www.datawrapper.de/academy/customizing-your-bar-chart)
- Value overlays / confidence intervals: authors are told to "check how it'll appear to readers on mobile screens" so direct labels don't overlap. (https://www.datawrapper.de/blog/confidence-intervals-value-markers-bar-charts)

**Scatter plots**

- "In the mobile view, fewer labels will appear than the desktop view" (automatic label thinning); authors can add custom labels for mobile. (https://www.datawrapper.de/academy/customizing-your-scatter-plot-annotate)
- Plot height fixed or aspect-ratio (A1).

**Small multiples (line, Feb 2024; column, Feb 2025)**

- **Separate "columns" setting for desktop and for mobile** (number of panels per row).
- Panel height: fixed px or "100% based on width" (square).
- Shared-scale mode shows axis labels only on the first column / bottom row; independent scales show labels in every panel.
- **"Hide panels on mobile"** option. (https://www.datawrapper.de/blog/small-multiple-line-charts, https://www.datawrapper.de/blog/small-multiple-column-charts)

**Text annotations (all chart types, since Nov 2, 2020; bar/dot/range since Nov 1, 2024)**

- Annotation **width is measured in % of chart width, not px**; a chart authored at 800px embedded at 600px gets annotations 25% narrower and text re-wraps. Delete the width to get fixed (auto) width.
- Position anchored in **data coordinates** with a 9-point anchor grid + px offset.
- **Default "Show as key on mobile": on mobile annotations are numbered and moved below the chart** as a list; per-annotation toggle to keep them in-chart, or show only on desktop / only on mobile; drag to reorder the numbering.
- Connector-line circle size is _not_ responsive (same px at 400 and 800). (https://www.datawrapper.de/blog/better-more-responsive-annotations-in-datawrapper-data-visualizations, https://www.datawrapper.de/academy/how-to-create-text-annotations, https://www.datawrapper.de/blog/annotations-in-bar-charts)

**Color keys / legends**

- Placed above the plot; "Stacked color legends" (2024) allow a vertical stack for all chart types. On mobile the key is the default home for line labels and annotations. Guidance: "Mobile screens demand more aggressive value-skipping" in quantitative keys. (https://www.datawrapper.de/blog/feature-recap-2024, https://www.datawrapper.de/blog/color-keys-for-data-visualizations)

**Tables**

- Default: horizontal scroll on narrow screens.
- **"Mobile fallback" = transposed card layout below 450px**: "The table switches to a 'transposed' layout, also known as a card design, on devices smaller than 450px."
- **Per-column "Show on" checkbox: desktop / mobile / both / neither** → hide low-priority columns on mobile.
- Compact mode (tighter rows), fixed column width (wrap instead of grow), sticky rows (survive search/pagination), pagination and search stay on mobile. (https://academy.datawrapper.de/article/196-customizing-your-table, https://www.datawrapper.de/blog/new-table-tool-barcharts-fixed-rows-responsive-2 (May 15 2019), https://academy.datawrapper.de/article/329-how-to-control-column-widths-in-tables)

**Maps**

- Choropleth/symbol: height computed from width and base-map shape (aspect ratio preserved); "crop to data" and inset maps (Apr 2024).
- **Locator maps**: per-marker visibility **desktop-only / mobile-only** (Advanced options), pattern of duplicating a marker with a shorter label for mobile; a **map "key" mode** that moves marker labels to a list above/below the map; **aspect ratio** setting ("100 = square; increase to make the map narrower and mobile-friendly"); advice to "spend most of your time in mobile view". (https://www.datawrapper.de/academy/locator-maps-for-mobile-devices)

**Header / footer / chrome**

- Title and description are the same text on mobile (no alternate mobile title found — **[unverified negative]**); they wrap, and the height listener absorbs the extra lines.
- Sharing buttons stack vertically on mobile (2016 post).

### A4. Editor affordances

- **Responsive preview buttons** (mobile / tablet / desktop) under the chart plus a drag handle (←→) in the bottom-right corner and numeric width input; "With one click, you can compare how your chart will appear on mobile devices and on Desktop computers." (2016 post; https://www.datawrapper.de/academy/customizing-your-bar-chart)
- Per-breakpoint overrides that exist: table column visibility, small-multiple columns, hide panels on mobile, annotation visibility/key, locator-map marker visibility, aspect ratio / plot height. **Not found:** mobile-specific sort order, mobile-specific title, mobile-specific color key placement.

### A5. Design principles they state for responsive charts (worth copying)

- Reflow rather than scale: legend/labels/annotations _relocate_ (to key, below chart), axis label density _reduces_, formatting becomes _compact_; drop the least important annotations on mobile; keep data area (plot) height decoupled from text height. (https://www.datawrapper.de/blog/text-in-data-visualizations; https://data.europa.eu/apps/data-visualisation-guide/responsiveness-adapting-annotations-axes-and-legends)
- Prefer bar (grows vertically) over column on small screens. (chart-types-guide)
- Never rotate axis labels as a first resort — rephrase, abbreviate, or change chart type. (text-in-data-visualizations)

---

## B. Chart-choice and design rules (one-liners, with source)

### B1. Choosing a chart type

- Decide the message first; "the chart's main statement becomes a compass" for type, title and color. — https://www.datawrapper.de/blog/chart-types-guide (Jun 16 2025)
- Prefer familiar basic charts; fancy types "require a learning curve"; introduce complexity gradually. — chart-types-guide
- Change over time: line chart is "usually a solid choice"; use columns for "just a few points in time"; stacked columns to add subcategories; grouped columns to compare subcategories (not totals). — chart-types-guide
- Many overlapping lines ("spaghetti") → small multiples. — chart-types-guide; https://www.datawrapper.de/blog/what-to-consider-when-creating-small-multiple-line-charts
- Area charts only for how a breakdown of a total changes over time; need zero baseline; skip for single series, small differences, or <~10 dates (use stacked columns). — https://www.datawrapper.de/blog/area-charts
- Slope chart = line chart with the middle erased; arrow plot for many categories in little space but harder for mainstream readers. — chart-types-guide
- Shares: pies/donuts signal "percentages", but "circle sections aren't exactly easy to compare"; election results etc. are "almost always shown as bar charts". — chart-types-guide
- Pie: max ~5 slices, best at 25/50/75%, never for two values, one total per pie, group rest into "others", label small slices outside. — https://www.datawrapper.de/blog/pie-charts
- Stacked columns: most important series at the bottom (shared baseline), ≤~10 totals, include all parts, don't show the total as a series, don't use with unequal time intervals (use line/area), long labels → stacked bars, "overtaking" stories → line chart. — https://www.datawrapper.de/blog/stacked-column-charts
- Stacked bars for survey/Likert; Marimekko when absolute + relative both matter; treemap only for hierarchy. — chart-types-guide
- Absolute numbers: bar chart is "perfect"; dot plot when >2–3 values per category; split bars / population pyramids for mirrored comparisons. — chart-types-guide
- Correlation: scatter/bubble; use 2D histogram/heatmap when dots overlap; warn that "many of your readers will find them overwhelming". — chart-types-guide
- Rankings only → bump chart via line chart; rank + magnitude → scatter; rankings alone can mislead. — https://www.datawrapper.de/blog/favorite-popular-chart-types
- Maps: choropleth for admin-region rates (turnout), symbol map for many locations, locator map for a few points/events. — chart-types-guide; https://www.datawrapper.de/blog/choroplethmaps
- Tables when readers need to look up their own value; structure with more rows than columns; hide non-essential columns on mobile. — https://www.datawrapper.de/blog/guide-what-to-consider-when-creating-tables
- Dual axes: 2018 post advised against; 2026 reversal "Why I changed my mind on dual-axis charts" — OK for regular/expert readers, different units, Pareto; align scales so both grow proportionally, zero-baseline both or neither, avoid crossovers, use different mark types (line + column), color-match axis labels to series, label values, state units. Don't use for mainstream audiences unless very well designed; don't compare overlapping ranges (use small multiples or indexed chart). — https://www.datawrapper.de/blog/dual-axis-charts-guide, https://www.datawrapper.de/blog/why-i-changed-my-mind-on-dual-axis-charts (Jul 23 2026)
- Waterfall charts: new 2026 type with its own do's/don'ts. — https://www.datawrapper.de/blog/waterfall-charts-guide
- 3D charts: not offered; no dedicated post found **[unverified]**.

### B2. Axes, baselines, sorting, small multiples

- Line charts don't need a zero baseline, but "consider extending your y-axis to zero" when data is near zero; area and bar charts must start at zero. — https://www.datawrapper.de/blog/line-charts, area-charts
- Avoid "natural"/"cardinal" curve interpolation (distorts); plain "curved" is acceptable. — line-charts
- Skip point symbols on lines with regular intervals. — line-charts
- Sort bars/tables by the interesting value, not alphabetically. — guide-what-to-consider-when-creating-tables
- Small multiples: same y-scale by default; if independent, warn readers; sort panels meaningfully (start/end/change); curate panels; faint "all lines" in background; test on mobile — too much scrolling = too many panels. — what-to-consider-when-creating-small-multiple-line-charts (Feb 7 2024)
- Log scales: no dedicated blog rule found **[unverified]**.

### B3. Text, titles, labels

- The title is the finding ("Headlines are our hypotheses"); biggest, boldest text; conversational wording, technical precision in the description. — https://www.datawrapper.de/blog/better-charts, https://www.datawrapper.de/blog/text-in-data-visualizations
- Always add a source; explain every color; add a description of what is shown. — better-charts
- Label directly; legends only when direct labels can't fit (and on mobile). — text-in-data-visualizations; https://www.datawrapper.de/blog/10-ways-to-use-fewer-colors-in-your-data-visualizations
- Repeat units in axis labels, tooltips and annotations; tooltips say "3.4% unemployed" not "3.4%". — text-in-data-visualizations
- Max two font sizes for labels/annotations; left-align; never rotate axis labels; use text outlines over marks. — text-in-data-visualizations
- Annotations ≈ ≤10 words; hide the least important on mobile; move non-essential ones below the chart. — text-in-data-visualizations
- Always add comparison context (previous year, average, peers). — better-charts, line-charts
- "Respect your readers' time": say the takeaway up front. — https://www.datawrapper.de/blog/readers-time

### B4. Numbers

- Abbreviate (12.8k, 12.8m), strip trailing zeros and needless decimals; exact values go to tooltips/downloads. — text-in-data-visualizations, guide-what-to-consider-when-creating-tables

### B5. Color

- ≤7 colors; more → regroup or change chart type. — https://www.datawrapper.de/blog/colors
- "Grey is the most important color in data vis"; make everything grey except what matters; one highlight. — better-charts; https://www.datawrapper.de/blog/emphasize-with-color-in-data-visualizations
- De-emphasize with the same hue at lower saturation/opacity, not new hues; saturation signals importance. — emphasize-with-color
- Categories = different hues; ordered data = lightness gradients; light = low, dark = high. — colors; https://www.datawrapper.de/blog/which-color-scale-to-use-in-data-vis
- Sequential for low→high, diverging for a meaningful midpoint; classed vs unclassed is a trade-off (series parts 2–4). — diverging-vs-sequential-color-scales, classed-vs-unclassed-color-scales
- Colorblind safety: blue is the safest hue, pair with orange/red, "get it right in black & white", 3–4 colors max, double-encode with shapes/patterns/dashes, test with simulators. — https://www.datawrapper.de/blog/colorblindness-part2
- Palette construction: even lightness steps (e.g. 40/48/56/64/72/80%), lower saturation for dark colors, check WCAG contrast, test in several chart types. — https://www.datawrapper.de/blog/create-good-color-palettes
- Contrast: ≥2.5:1 for large text, ≥4:1 for small text. — colors
- Same variable → same color across all charts of a story. — colors
- 10 ways to use fewer colors (none, shades, highlight few, direct labels, merge, borders, change chart type, small multiply, other encodings, tooltips). — 10-ways-to-use-fewer-colors
- Color keys: order like the chart, largest first for pies, skip every other value in quantitative keys (more on mobile), label ends with "less/more" when exact values confuse. — color-keys-for-data-visualizations
- Remind readers of colors inside the text/annotations rather than only in a key. — https://www.datawrapper.de/blog/remind-readers-of-colors-in-data-vis
- Domain palettes: gender (not pink/blue), party colors, race/ethnicity/world regions. — gendercolor, partycolors, colors-for-race-ethnicity-world-regions

### B6. Uncertainty

- Show ranges as overlays, counter "within-the-bar bias" via opacity/pattern/transparent bars, always label what the range is (95% CI, SD, …), check mobile overlap. — https://www.datawrapper.de/blog/confidence-intervals-value-markers-bar-charts
- Line-chart confidence bands via area ranges. — https://www.datawrapper.de/academy/how-to-show-confidence-intervals-in-datawrapper-line-charts

### B7. Dark mode

- Provide dark mode automatically from `prefers-color-scheme`; derive dark colors by preserving contrast against the background rather than hand-picking; allow "keep same data colors". — dark-mode-for-embedded-visualizations

---

## C. Recent feature-direction posts (2024–2026)

- Jul 23 2026 — New: Dual-axis charts — https://www.datawrapper.de/blog/dual-axis-charts
- Jul 23 2026 — New: Waterfall charts — https://www.datawrapper.de/blog/waterfall-charts
- Jul 23 2026 — Pro & Business plans — https://www.datawrapper.de/blog/pro-and-business-plans
- Jul 30 2026 — How to make animated visualizations — https://www.datawrapper.de/blog/give-me-a-flashing-sign (slug **[unverified]**)
- Jun 11 2026 — Arrows in locator maps — https://www.datawrapper.de/blog/arrows-in-locator-maps
- Apr 16 2026 — Undo/redo — https://www.datawrapper.de/blog/undo-redo-in-datawrapper
- Mar 6 2026 — Permissions & guest roles — https://www.datawrapper.de/blog/new-permissions-guest-roles
- Dec 22 2025 — New website — https://www.datawrapper.de/blog/new-website-launch
- Dec 10 2025 — New locator-map marker editor — https://www.datawrapper.de/blog/new-locator-map-marker-editor
- Sep 5 2025 — Workspaces — https://www.datawrapper.de/blog/new-workspaces
- Jul 23 2025 — Globe projection in locator maps — https://www.datawrapper.de/blog/new-globe-projection-locator-maps
- Jun 16 2025 — A friendly guide to choosing a chart type — https://www.datawrapper.de/blog/chart-types-guide
- Apr 1 2025 — "New: Real Tables" — April Fools' (furniture), ignore — https://www.datawrapper.de/blog/real-tables-april-1
- Feb 18 2025 — Small multiple column charts — https://www.datawrapper.de/blog/small-multiple-column-charts
- Feb 7 2025 — Comparison columns (elections) — https://www.datawrapper.de/blog/comparison-columns
- Jan 20 2025 — Combine series with different intervals in line charts — https://www.datawrapper.de/blog/connect-all-points-in-line-charts
- Dec 16 2024 — What we built in 2024 (stacked color legends, heatmaps for text columns, insets/globes, trash, 2FA) — https://www.datawrapper.de/blog/feature-recap-2024
- Dec 11 2024 — How to find & create good color palettes — https://www.datawrapper.de/blog/create-good-color-palettes
- Nov 1 2024 — Annotations in bar, range, dot charts — https://www.datawrapper.de/blog/annotations-in-bar-charts
- Oct 29 2024 — Arrow maps — https://www.datawrapper.de/blog/arrow-maps
- Sep 18 2024 — Automatic value labels in line charts — https://www.datawrapper.de/blog/automatically-label-values-in-line-charts
- Sep 11 2024 — Comments & notifications — https://www.datawrapper.de/blog/comments-and-notifications
- Sep 5 2024 — Patterns in choropleth maps — https://www.datawrapper.de/blog/pattern-overlay-in-choropleth-maps
- Aug 27 2024 — Datawrapper for PowerPoint — https://www.datawrapper.de/blog/create-data-visualizations-in-powerpoint
- May 2 2024 — Improved line chart editing — https://www.datawrapper.de/blog/improved-line-chart-editing
- Apr 12 2024 — Cropped view & inset maps — https://www.datawrapper.de/blog/cropped-view-inset-maps
- Mar 22 2024 — Responsive height control — https://www.datawrapper.de/blog/responsive-height-control
- Mar 14 2024 — Edit history; live collaboration — https://www.datawrapper.de/blog/introducing-edit-history, https://www.datawrapper.de/blog/introducing-live-collaboration
- Feb 5 2024 — Small multiple line charts — https://www.datawrapper.de/blog/small-multiple-line-charts
- Ongoing — "Fix my chart" series (e.g. donuts → bars, May 14 2025; approval ratings, Mar 25 2026); "Data Vis Dispatch" weekly.
- **AI:** no Datawrapper product post announcing AI/LLM chart generation was found (searched blog and news category through Sep 2026). Their direction is collaboration, new chart types, maps, annotations, and theming — not generative features. **[negative finding, unverified beyond search]**
- Custom themes (product page, undated): fonts per text element, categorical colors + gradients, per-element colors incl. dark-mode equivalents and CMYK, logos, header/footer layout with custom fields, multiple themes per org, lock-down of choices. — https://www.datawrapper.de/custom-themes

---

## D. Sources

Academy

- https://www.datawrapper.de/academy/how-to-change-the-size-of-your-visualizations
- https://www.datawrapper.de/academy/how-to-embed-charts
- https://www.datawrapper.de/academy/my-embedded-charts-are-cut-off-or-have-too-much-space-underneath
- https://academy.datawrapper.de/article/365-i-cant-customize-the-height-of-the-visualization
- https://www.datawrapper.de/academy/customizing-your-line-chart
- https://academy.datawrapper.de/article/44-customizing-your-column-chart
- https://www.datawrapper.de/academy/customizing-your-bar-chart
- https://www.datawrapper.de/academy/customizing-your-dot-plot
- https://www.datawrapper.de/academy/customizing-your-scatter-plot-annotate
- https://academy.datawrapper.de/article/196-customizing-your-table
- https://academy.datawrapper.de/article/329-how-to-control-column-widths-in-tables
- https://www.datawrapper.de/academy/how-to-create-text-annotations
- https://www.datawrapper.de/academy/annotate-tab
- https://www.datawrapper.de/academy/locator-maps-for-mobile-devices
- https://www.datawrapper.de/academy/dark-mode-in-embedded-datawrapper-visualizations
- https://www.datawrapper.de/academy/how-to-style-embedded-visualizations
- https://www.datawrapper.de/academy/how-to-show-confidence-intervals-in-datawrapper-line-charts

Developer docs

- https://developer.datawrapper.de/docs/responsive-iframe
- https://developer.datawrapper.de/docs/web-components
- https://developer.datawrapper.de/docs/custom-embed-code
- https://developer.datawrapper.de/docs/embedding-charts-via-oembed

Blog (responsive / product)

- https://www.datawrapper.de/blog/datawrapper-becomes-mobile-first-charting-tool (2016)
- https://www.datawrapper.de/blog/new-table-tool-barcharts-fixed-rows-responsive-2 (2019)
- https://www.datawrapper.de/blog/better-more-responsive-annotations-in-datawrapper-data-visualizations (2020)
- https://www.datawrapper.de/blog/dark-mode-for-embedded-visualizations (2022)
- https://www.datawrapper.de/blog/web-component-embedding
- https://www.datawrapper.de/blog/responsive-height-control (2024)
- https://www.datawrapper.de/blog/small-multiple-line-charts (2024), https://www.datawrapper.de/blog/small-multiple-column-charts (2025)
- https://www.datawrapper.de/blog/automatically-label-values-in-line-charts (2024)
- https://www.datawrapper.de/blog/annotations-in-bar-charts (2024)
- https://www.datawrapper.de/blog/feature-recap-2024
- https://www.datawrapper.de/blog/category/datawrapper-news, https://www.datawrapper.de/blog/posts

Blog (guidance, "Data vis do's & don'ts")

- https://www.datawrapper.de/blog/chart-types-guide · dual-axis-charts-guide · why-i-changed-my-mind-on-dual-axis-charts · waterfall-charts-guide · pie-charts · line-charts · area-charts · stacked-column-charts · choroplethmaps · guide-what-to-consider-when-creating-tables · what-to-consider-when-creating-small-multiple-line-charts · favorite-popular-chart-types
- https://www.datawrapper.de/blog/colors · colorguide · which-color-scale-to-use-in-data-vis · quantitative-vs-qualitative-color-scales · diverging-vs-sequential-color-scales · classed-vs-unclassed-color-scales · interpolation-for-color-scales-and-maps · colorblindness-part2 · create-good-color-palettes · emphasize-with-color-in-data-visualizations · color-keys-for-data-visualizations · remind-readers-of-colors-in-data-vis · 10-ways-to-use-fewer-colors-in-your-data-visualizations · gendercolor · partycolors · colors-for-race-ethnicity-world-regions
- https://www.datawrapper.de/blog/text-in-data-visualizations · fonts-for-data-visualization · better-charts · readers-time · confidence-intervals-value-markers-bar-charts
- https://www.datawrapper.de/custom-themes

Third-party

- https://data.europa.eu/apps/data-visualisation-guide/responsiveness-adapting-annotations-axes-and-legends
- https://data.europa.eu/apps/data-visualisation-guide/accessibility-in-datawrapper
