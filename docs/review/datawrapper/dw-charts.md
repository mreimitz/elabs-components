# Datawrapper CHARTS — feature & settings catalogue (competitive gap analysis input)

Researched 2026-09-18 via datawrapper.de/charts, the Datawrapper Academy (academy.datawrapper.de / datawrapper.de/academy) and the Datawrapper blog. Only web-fetchable sources were used; nothing below is inferred from the editor UI itself. Items marked **[unverified]** could not be confirmed from a fetched page. Some Academy "Customizing your …" articles (notably column / grouped column / stacked column) are visibly older than the product (e.g. they still say "you can only modify the maximum value", and don't mention overlays or plot-height controls that the blog confirms exist for column charts) — where the blog contradicts/extends an Academy article this is flagged.

---

## Section 1 — Full chart-type list

Datawrapper's marketing page claims **"23 interactive, responsive, and accessible chart types"** grouped into: Line & area charts · Bar charts · Column charts · Pie & donut charts · Dot plots · Scatterplot · Dual-axis & waterfall (plus Maps and Tables, out of scope). The 23 individual chart types found across the site/Academy:

| #   | Chart type (editor name)                                         | Group                 | What it's for                                                                                                          |
| --- | ---------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | **Bar chart**                                                    | Bars                  | One numeric column per category, horizontal bars; ranked comparisons.                                                  |
| 2   | **Split bars**                                                   | Bars                  | Several numeric columns shown as side-by-side small bar panels (one panel per column), rows aligned.                   |
| 3   | **Stacked bars**                                                 | Bars                  | Parts-of-whole per row, horizontal; "diverging" mode for Likert/survey data; 100 % stacking.                           |
| 4   | **Grouped bars**                                                 | Bars                  | Several numeric columns as grouped bars per category (needs ≥2 numeric columns).                                       |
| 5   | **Bullet bars**                                                  | Bars                  | Outer (target/plan) bar with inner (actual) bar — plan vs. actual, target attainment.                                  |
| 6   | **Column chart**                                                 | Columns               | Vertical bars, one numeric column; supports "comparison columns" (2025) for context values.                            |
| 7   | **Grouped column**                                               | Columns               | Several series as grouped vertical columns.                                                                            |
| 8   | **Stacked column**                                               | Columns               | Vertical stacked parts-of-whole; totals labels; connected areas.                                                       |
| 9   | **Multiple columns** (small-multiple columns; launched Feb 2025) | Columns               | One column-chart panel per category, sortable/scaled panels.                                                           |
| 10  | **Line chart**                                                   | Lines                 | Trends over time (date x-axis) or ordered categories; single or multiple lines.                                        |
| 11  | **Multiple lines** (small multiples; launched Feb 2024)          | Lines                 | One panel per series, with optional repeated baseline line in all panels.                                              |
| 12  | **Area chart**                                                   | Lines                 | Stacked / unstacked / 100 %-stacked areas over time.                                                                   |
| 13  | **Scatter plot**                                                 | Scatter               | X/Y relationships, bubble size, color/shape by category, trend line, custom lines/areas, timelines, connected scatter. |
| 14  | **Dot plot**                                                     | Dots                  | One or more values per row as dots on a shared horizontal axis; optional range bar between dots.                       |
| 15  | **Range plot**                                                   | Dots                  | Two values per row as start/end dots joined by a bar (gaps, before/after).                                             |
| 16  | **Arrow plot**                                                   | Dots                  | Two values per row as an arrow from start to end (change/direction).                                                   |
| 17  | **Pie chart**                                                    | Pie/Donut             | Single-column parts-of-whole.                                                                                          |
| 18  | **Donut chart**                                                  | Pie/Donut             | Pie with inner radius and a centre value/text.                                                                         |
| 19  | **Election donut**                                               | Pie/Donut             | Half-donut ("parliament") of seat shares, party colours, data-order preserved.                                         |
| 20  | **Multiple pies**                                                | Pie/Donut             | Grid of pies, one per column.                                                                                          |
| 21  | **Multiple donuts**                                              | Pie/Donut             | Grid of donuts, one per column.                                                                                        |
| 22  | **Dual-axis chart** (launched Jul 2026)                          | Dual-axis & waterfall | Two vertical axes; any combination of lines / (stacked/grouped) columns / stacked areas, at least one side lines.      |
| 23  | **Waterfall chart** (launched Jul 2026)                          | Dual-axis & waterfall | Running-total bridge: increases/decreases/subtotals, differences or running-total input.                               |

Also on the site but out of scope: Tables (with sparklines/bar cells/heatmaps), choropleth/symbol/locator maps. Datawrapper has no native histogram, box plot, heatmap-chart (only in tables), treemap, sankey, radar, gauge, bubble/packed circle, or candlestick chart type.

The "population pyramid" is a recipe using **Grouped bars / Split bars**, not a chart type. "Bar-line combination" is a recipe using a **Line chart** with area fills + step interpolation + symbols (or, since 2026, the Dual-axis chart). "Timeline" and "connected scatter" are scatter-plot recipes.

---

## Section 2 — Per chart type: Refine-step settings

Conventions: "Number format" everywhere means the shared number-format dropdown + custom format string (see §3.2). "Plot height" = the March-2024 responsive height control (fixed px or % of width). "Overlays" = the value/range overlay system (§3.6).

### 2.1 Bar chart (single column)

| Setting                                                     | Values                                                                                                                        | Notes / default                                                                                               |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Labels › Alignment                                          | Left / Right                                                                                                                  | Category labels in front of bars                                                                              |
| Labels › Move labels to separate line                       | on/off                                                                                                                        | Label on its own line above bar (for long labels)                                                             |
| Labels › Show values                                        | on/off; sub: value alignment left/right; number format                                                                        | On by default (blog 2020); values on bar ends                                                                 |
| Labels › Replace country codes with flags                   | on/off                                                                                                                        | ISO codes → flag icons (also in split/grouped bars)                                                           |
| Horizontal axis › Custom range                              | min, max                                                                                                                      | Default max = largest bar; e.g. extend to 100 %                                                               |
| Horizontal axis › Grid lines                                | on/off; custom positions ("500000, 1000000"); position above/below chart; number format                                       | Off by default                                                                                                |
| Appearance › Base color                                     | color                                                                                                                         | Single colour for all bars                                                                                    |
| Appearance › Customize colors                               | per-bar / per-category colour; multi-select (Shift/Ctrl); reset all                                                           | Drag & drop reorder of colour-key categories, editable key text, merge same-colour categories (2020 redesign) |
| Appearance › Color by column                                | choose a categorical column                                                                                                   | Assigns colours by category; auto colour key                                                                  |
| Appearance › Show color key                                 | on/off; edit descriptions                                                                                                     |                                                                                                               |
| Appearance › Thick bars                                     | on/off                                                                                                                        |                                                                                                               |
| Appearance › Separate rows with lines / category separators | on/off                                                                                                                        |                                                                                                               |
| Appearance › Grey background bars                           | on/off                                                                                                                        | "what's missing to 100 %" effect                                                                              |
| Overlays                                                    | + Add overlay: Type value/range; column(s); title; color; opacity; pattern (range only); "Label on first row" (on by default) | Confidence intervals / value markers; multiple overlays stackable; hide (eye) / delete                        |
| Sorting & Grouping › Sort bars                              | on/off (largest first)                                                                                                        |                                                                                                               |
| Sorting & Grouping › Reverse order                          | on/off                                                                                                                        |                                                                                                               |
| Sorting & Grouping › Group bars by column                   | categorical column                                                                                                            | Visual group separation with group headers                                                                    |
| Annotate                                                    | text annotations (row-anchored), range highlights & reference lines (vertical only)                                           | Since Nov 2024                                                                                                |

### 2.2 Split bars

| Setting                                                  | Values                                           | Notes / default                            |
| -------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------ |
| Labels › Bar label alignment                             | Left / Right                                     |                                            |
| Labels › Show values on bars                             | on/off                                           | Default on                                 |
| Labels › Number format                                   | dropdown/custom                                  |                                            |
| Labels › Replace country codes with flags                | on/off                                           |                                            |
| Labels › Show color legend                               | on/off                                           | Default off (column headers act as labels) |
| Horizontal axis › Custom range                           | min/max                                          | Default scales to largest bar per column   |
| Horizontal axis › Use independent scales for each column | on/off                                           | Default off                                |
| Appearance › Customize colors                            | by column (default) or by row                    |                                            |
| Appearance › Bar thickness                               | slider                                           |                                            |
| Appearance › Bar separator                               | dotted line / none                               | Default none                               |
| Appearance › Grey background                             | on/off                                           | Default off                                |
| Appearance › Space between columns                       | slider                                           |                                            |
| Sorting & Grouping › Sort bars                           | off / by column                                  | Default: spreadsheet order                 |
| Sorting & Grouping › Reverse order                       | on/off                                           |                                            |
| Sorting & Grouping › Groups                              | extra column                                     |                                            |
| Annotate                                                 | range/line highlights can "repeat in all panels" |                                            |

### 2.3 Stacked bars

| Setting                                                                      | Values                                | Notes / default                                |
| ---------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------- |
| Labels › Value alignment                                                     | Standard / Diverging                  | Diverging centres the middle category (Likert) |
| Labels › Label alignment                                                     | Left / Right; "move to separate line" |                                                |
| Labels › Show value labels                                                   | on/off                                |                                                |
| Labels › Number format                                                       | dropdown/custom                       | Unavailable when "Stack percentages" on        |
| Horizontal axis › Custom range                                               | min/max                               | Default = sum of row; disabled when stacked %. |
| Horizontal axis › Grid lines                                                 | on/off + positions                    |                                                |
| Appearance › Base color / Customize colors                                   | as bar chart; opacity via 8-digit hex |                                                |
| Appearance › Bar thickness                                                   | slider                                |                                                |
| Appearance › Separate rows with lines                                        | on/off                                |                                                |
| Appearance › Stack percentages                                               | on/off                                | Normalises rows to 100 %                       |
| Appearance › Show color key                                                  | on/off                                |                                                |
| Sorting & Grouping › Sort bars (by column) / Reverse order / Group by column |                                       |                                                |

### 2.4 Grouped bars

| Setting                                                                          | Values                                                                                    | Notes / default        |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------- |
| Labels › Alignment                                                               | Left / Right                                                                              |                        |
| Labels › Move labels to separate line                                            | on/off                                                                                    | Increases chart height |
| Labels › Show values                                                             | on/off (default on); visibility always / hover; value alignment left/right; number format |                        |
| Labels › Replace country codes with flags                                        | on/off                                                                                    |                        |
| Labels › Show color legend                                                       | on/off (default on); Stack labels (vertical list)                                         |                        |
| Horizontal axis › Custom range                                                   | min/max                                                                                   |                        |
| Horizontal axis › Grid lines                                                     | off (default) / on with custom positions; position above (default) / below; number format |                        |
| Appearance › Bar colors                                                          | per category element                                                                      |                        |
| Appearance › Thicker bars / Category separators / Grey background                | toggles                                                                                   |                        |
| Sorting & Grouping › Sort bars (keep order / by column) / Reverse order / Groups |                                                                                           |                        |

### 2.5 Bullet bars

| Setting                                                               | Values                        | Notes / default        |
| --------------------------------------------------------------------- | ----------------------------- | ---------------------- |
| Bars › Outer bar                                                      | numeric column (e.g. planned) |                        |
| Bars › Inner bar                                                      | numeric column (e.g. actual)  | Same unit as outer     |
| Labels › Alignment                                                    | Left / Right                  |                        |
| Horizontal axis › Custom range                                        | min/max                       | Default to largest bar |
| Horizontal axis › Number format                                       | incl. "0" whole numbers       |                        |
| Horizontal axis › Custom grid lines                                   | "0.5, 1, 2"                   | Default auto spacing   |
| Horizontal axis › Tick position                                       | above / below                 |                        |
| Appearance › Outer bar color / Inner bar color                        | colour                        |                        |
| Appearance › Color key                                                | on/off                        |                        |
| Appearance › Dotted lines / thicker bars                              | toggles                       |                        |
| Sorting & Grouping › Sort bars / Reverse order / Group bars by column |                               |                        |

### 2.6 Column chart

Academy article (older) + blog (2024/2025) combined:

| Setting                                     | Values                                                                       | Notes / default                                                                                                                                  |
| ------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Vertical axis › Custom range                | min/max                                                                      | Default starts at 0; Academy says only max editable (bars/columns "start at zero or below" by policy; negative values allowed)                   |
| Vertical axis › Grid lines                  | on/off                                                                       |                                                                                                                                                  |
| Vertical axis › Axis labels / Number format | dropdown/custom                                                              |                                                                                                                                                  |
| Horizontal axis › Sort columns              | off / automatic (descending) / reverse (ascending)                           |                                                                                                                                                  |
| Horizontal axis › Rotate labels             | auto / always / never                                                        |                                                                                                                                                  |
| Appearance › Customize colors               | per column; select/deselect all; reset                                       | Color by column category [unverified for column charts]                                                                                          |
| Appearance › Show values                    | on hover / always (on top of columns)                                        | Blog (comparison-columns, Feb 2025): values can be shown _below_ columns, differences to comparison column in grey, label colour = column colour |
| Appearance › Space between columns          | slider (% of width)                                                          |                                                                                                                                                  |
| Comparison columns (Feb 2025)               | choose comparison column(s) when ≥2 numeric columns                          | Muted background column behind the main one; label/colour styling customisable on Custom/Enterprise via support                                  |
| Overlays (Oct 2021+)                        | value / range overlays as in bar charts                                      | Confidence intervals, value markers                                                                                                              |
| Appearance › Plot height (Mar 2024)         | fixed px / % of width                                                        |                                                                                                                                                  |
| Annotate                                    | text annotations, range highlights & reference lines (vertical & horizontal) |                                                                                                                                                  |

### 2.7 Grouped column

| Setting                                                   | Values                         | Notes / default               |
| --------------------------------------------------------- | ------------------------------ | ----------------------------- |
| Vertical axis › Custom range / Grid lines / Number format | as column chart                | Min fixed at zero per Academy |
| Horizontal axis › Sort columns                            | automatic / reverse            |                               |
| Horizontal axis › Rotate labels                           | auto / always / never          |                               |
| Appearance › Customize colors                             | per series                     |                               |
| Appearance › Show color key                               | on/off (above chart)           |                               |
| Appearance › Value labels                                 | hover (default) / always / off |                               |
| Plot height, overlays, annotations, mobile spacing        | see column chart               |                               |

### 2.8 Stacked column

| Setting                                                   | Values                                                      | Notes / default                                                                        |
| --------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Vertical axis › Custom range / Grid lines / Number format | as column chart                                             |                                                                                        |
| Horizontal axis › Sort columns / Rotate labels            |                                                             |                                                                                        |
| Appearance › Customize color                              | gradient shades of one base colour, or individual per stack |                                                                                        |
| Appearance › Value labels                                 | hover (default) / always                                    |                                                                                        |
| Appearance › Category labels                              | direct labels next to stacks / color key at top             | (Dec 2016 improvement)                                                                 |
| Appearance › Connect areas                                | on/off                                                      | Lightweight alternative to stacked area (2016)                                         |
| Appearance › Show totals labels                           | on/off                                                      | Announced as "tiny feature" (Facebook post; year unverified)                           |
| Appearance › Stack percentages (100 %)                    | on/off                                                      | **[unverified for stacked column — confirmed for dual-axis columns and stacked bars]** |
| Mobile spacing/layout                                     | mobile-specific spacing settings                            | (2016 blog)                                                                            |
| Plot height, overlays, annotations                        |                                                             |                                                                                        |

### 2.9 Multiple columns (small-multiple column charts)

| Setting                                                                                                                      | Values                                                                  | Notes / default                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Panel layout › Panels per row                                                                                                | Fixed (desktop count + mobile count) / Auto (min panel size)            | Default Fixed                                                                            |
| Panel layout › Panel height                                                                                                  | Fixed px / Based on width (% e.g. 100 % = square)                       | Default Fixed                                                                            |
| Panel layout › Sort panels                                                                                                   | Start / End / Difference / % change / Range / Title; reverse            |                                                                                          |
| Horizontal axis › Select column                                                                                              | first column default                                                    |                                                                                          |
| Horizontal axis (dates) › Custom range / Custom ticks / Tick format / Show grid labels in all panels                         |                                                                         | Default labels only in first column of panels                                            |
| Horizontal axis › Grid & grid labels                                                                                         | labels shown, no lines (default); grid lines / ticks only / hide labels |                                                                                          |
| Horizontal axis (categories) › Rotate labels                                                                                 | auto (default) / always / never                                         |                                                                                          |
| Horizontal axis (categories) › Reverse order                                                                                 | on/off                                                                  |                                                                                          |
| Vertical axis › Custom range / Custom ticks (comma-separated) / Number format                                                |                                                                         | Cannot cut data                                                                          |
| Vertical axis › Grid                                                                                                         | lines / ticks / off                                                     |                                                                                          |
| Vertical axis › Grid labels                                                                                                  | outside (default) / inside / hidden; Show in all panels (default off)   |                                                                                          |
| Vertical axis › Use independent scales for each panel                                                                        | on/off                                                                  | Disables custom range/ticks; enables **Range rounding** (aligns gridlines across panels) |
| Columns › Base color / Customize colors (by category → auto legend) / Space between columns (%)                              |                                                                         |                                                                                          |
| Panels › Use color for panel titles                                                                                          | on/off                                                                  |                                                                                          |
| Panels › per-panel: Panel title (rename), Show on (desktop >500 px / mobile / both / neither), Copy/paste settings, Reset    |                                                                         |                                                                                          |
| Labels › Placement                                                                                                           | outside / inside (auto-moves outside if no space)                       |                                                                                          |
| Labels › Number format                                                                                                       | separate from axis                                                      |                                                                                          |
| Labels › Prevent label overlapping                                                                                           | on (default)                                                            |                                                                                          |
| Overlays › Value marker (column, color, opacity, legend) / Range overlay (start+end column, color, opacity, pattern, legend) |                                                                         | Shown across all panels                                                                  |
| Tooltips › Sync tooltips in all panels (default on) / date format / number format                                            |                                                                         |                                                                                          |
| Annotate                                                                                                                     | annotations & highlights assignable to panels or "repeat in all panels" |                                                                                          |

### 2.10 Line chart

| Setting                                  | Values                                                                                                                                                                                       | Notes / default                                                        |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Horizontal axis › Select column          | date/time or category column                                                                                                                                                                 |                                                                        |
| Horizontal axis › Custom range           | start / end                                                                                                                                                                                  | Cut off or extend                                                      |
| Horizontal axis › Custom ticks           | comma list ("2015, 2020, 2021")                                                                                                                                                              |                                                                        |
| Horizontal axis › Date format            | auto-guessed; formats such as "2015, 2016"                                                                                                                                                   |                                                                        |
| Horizontal axis › Grid                   | lines / ticks / off                                                                                                                                                                          |                                                                        |
| Vertical axis › Scale type               | Linear (default) / Logarithmic                                                                                                                                                               | Log impossible with zero values                                        |
| Vertical axis › Custom range             | min / max                                                                                                                                                                                    |                                                                        |
| Vertical axis › Custom ticks             | comma list                                                                                                                                                                                   | Only non-overlapping within range                                      |
| Vertical axis › Number format            | dropdown/custom (e.g. 123.4k, 0%, 0.0)                                                                                                                                                       |                                                                        |
| Vertical axis › Grid                     | lines / ticks / off                                                                                                                                                                          |                                                                        |
| Vertical axis › Grid labels              | position outside / inside / auto / off; side left / right                                                                                                                                    |                                                                        |
| Customize lines (all lines) › Base color | colour                                                                                                                                                                                       |                                                                        |
| Customize lines › Show outline           | on/off (default off)                                                                                                                                                                         | Thin stroke in background colour to separate crossing lines (May 2024) |
| Customize lines › Interpolation          | Linear / Curved (monotone) / Steps (before) / Steps (after) / Steps (middle)                                                                                                                 | Names per Academy; "Curved" and "Linear" plus three step variants      |
| Customize lines › Connect all points     | on/off (all lines or selected lines)                                                                                                                                                         | Jan 2025; otherwise NA/– gaps stay visible                             |
| Customize lines › Width                  | px; 0 px hides line                                                                                                                                                                          |                                                                        |
| Customize lines › Dash                   | on/off + pattern                                                                                                                                                                             |                                                                        |
| Customize lines individually             | per-line: rename label, color, width, dash, interpolation, connect all points, label position, in-legend, value labels, symbols; multi-select All/None/Invert, Shift/Ctrl; copy/paste; reset | May 2024 redesign                                                      |
| Labels › Line labels                     | Legend (color key) / Right (direct labels; optional connector lines; use line color) / None                                                                                                  | Direct labels become color key on small screens                        |
| Labels › Show value labels               | on/off (default off); number format; placement first / last / all ("most interesting points" auto-picked); visible per line (count); outline labeled data points; use line color vs. black   | Sept 2024                                                              |
| Line symbols › Show line symbols         | on/off; type circle / square / diamond / triangle / cross / hexagon / star / wye; placement first & last / all; style filled / hollow; size; opacity                                         | Per line selectable                                                    |
| Fill areas › Add area fill               | From (line or zero baseline) → To (line); color; opacity; different colour for negative differences; interpolation                                                                           | Used for confidence bands & bar-line combos                            |
| Tooltips                                 | on/off; date format; number format                                                                                                                                                           | Tooltip _content_ not templatable for line charts (formats only)       |
| Appearance › Plot height                 | fixed px / based on width                                                                                                                                                                    | Mar 2024                                                               |
| Appearance › Label margin                | px (ignored on mobile)                                                                                                                                                                       | Space reserved for right-side labels                                   |
| Annotate                                 | text annotations; range highlights (vertical & horizontal) & reference lines                                                                                                                 |                                                                        |
| Highlight series on hover                | **[unverified for line chart; confirmed in dual-axis legend]**                                                                                                                               |                                                                        |

### 2.11 Multiple lines (small multiples)

Everything in the line chart's axis/line sections plus:

| Setting                                                                                                                                  | Values                                                                                               | Notes / default                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Panel layout › Panels per row                                                                                                            | Fixed (desktop / mobile) / Auto (min size)                                                           | Default Fixed                                                     |
| Panel layout › Panel height                                                                                                              | Fixed / Based on width (%)                                                                           |                                                                   |
| Panel layout › Sort panels                                                                                                               | Start / End / Difference / % change / Range / Title (+ reverse)                                      |                                                                   |
| Horizontal axis › Grid lines                                                                                                             | off (default) / on / ticks only; "Display grid labels in all panels" (default off)                   |                                                                   |
| Vertical axis › Use independent scales for each panel                                                                                    | on/off (default off)                                                                                 | When on: no log scale, no custom range/ticks; adds Range rounding |
| Vertical axis › Grid labels                                                                                                              | outside (default) / inside; show in all panels                                                       |                                                                   |
| Lines › Base color / Interpolation / Connect all points / Show line symbols (type, position, filled/hollow, size, opacity)               |                                                                                                      |                                                                   |
| Lines › Use line color for panel titles                                                                                                  | on/off                                                                                               | Darkens if too light                                              |
| Per panel › Panel title; Show on desktop / mobile / both / neither; color, width, dash; **Repeat line in all panels**; copy/paste; reset |                                                                                                      | Repeated line = baseline comparison                               |
| Area fill                                                                                                                                | on/off (default off); color; opacity; fill panel line ↔ zero baseline, or repeated line ↔ panel line |                                                                   |
| Tooltips › Sync tooltips in all panels (default on); date & number format                                                                |                                                                                                      |                                                                   |

### 2.12 Area chart

| Setting                                                                                                                                    | Values                                              | Notes / default                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- | -------------------------------------------------- |
| Horizontal axis › Select column / Custom range / Custom ticks / Date format / Grid (lines, ticks, off)                                     | as line chart                                       |                                                    |
| Vertical axis › Custom range / Custom ticks / Number format / Grid (lines, ticks, off) / Labels (inside, outside, off, auto; left / right) |                                                     |                                                    |
| Customize areas › Base color                                                                                                               | one colour → shades                                 |                                                    |
| Customize areas › Set colors                                                                                                               | per area                                            |                                                    |
| Customize areas › Opacity                                                                                                                  | 0–100 %                                             | Affects gridline show-through                      |
| Customize areas › Interpolation                                                                                                            | as line chart                                       |                                                    |
| Customize areas › Sort areas                                                                                                               | keep order / smallest first / largest first         |                                                    |
| Customize areas › Stack areas                                                                                                              | Stacked (default) / Unstacked / 100 % stacked       | Option: separate areas with lines in a line colour |
| Labels › Show color legend                                                                                                                 | on (default)                                        |                                                    |
| Labels › Stack labels                                                                                                                      | on/off                                              | Vertical legend                                    |
| Labels › Reverse label order                                                                                                               | on/off                                              |                                                    |
| Tooltips                                                                                                                                   | on/off; date format; number format                  |                                                    |
| Appearance › Plot height                                                                                                                   | fixed / based on width                              |                                                    |
| Annotate                                                                                                                                   | text annotations, range highlights, reference lines |                                                    |

### 2.13 Scatter plot

| Setting                                                                     | Values                                                                                                                                                                                        | Notes / default                                      |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Chart size                                                                  | drag corner / "Resize to" w×h                                                                                                                                                                 |                                                      |
| Horizontal / Vertical axis › Select column                                  | numeric or date column                                                                                                                                                                        |                                                      |
| Axis › Custom range                                                         | min/max                                                                                                                                                                                       |                                                      |
| Axis › Log scale                                                            | on/off                                                                                                                                                                                        |                                                      |
| Axis › Custom ticks                                                         | "50,100"                                                                                                                                                                                      |                                                      |
| Axis › Format                                                               | number format                                                                                                                                                                                 |                                                      |
| Axis › Position                                                             | bottom (default) / top; left (default) / right                                                                                                                                                |                                                      |
| Axis › Grid                                                                 | on (default) / off; axis labels shown/hidden independently                                                                                                                                    |                                                      |
| Color                                                                       | Fixed (one colour) / Variable (by category column → palette; or by numeric column → colour scale [unverified])                                                                                | Show color key on/off; Symbol opacity; Show outlines |
| Size                                                                        | Fixed / Variable by numeric column; Maximum size                                                                                                                                              | Bubble chart                                         |
| Symbol                                                                      | Fixed shape (circle, triangle, cross, …) / Variable by category column                                                                                                                        |                                                      |
| Trend line                                                                  | off / linear / logarithmic (matches axis scale)                                                                                                                                               | "How to choose a trend line" article                 |
| Annotate › Labeling                                                         | column to label; Automatic (labels where space, no overlap) / manual selection via dropdown or click; delete labels; "Highlight labeled symbols"                                              | Mobile spacing considered                            |
| Annotate › Customize tooltip                                                | Show tooltips on/off; full template editor with {{ }} expressions & HTML (§3.3)                                                                                                               | Only scatter (+maps) get full templating             |
| Annotate › Add custom lines and areas (experimental)                        | `y=50`, `x=2000`, point lists (2 pts = line, ≥3 = polygon), equations `y=sin(x*20)`; modifiers `@dashed @dotted @color:red @opacity:0.5 @stroke:red @width:2`; date coordinates in point form | Also used for connected scatter / timelines          |
| Annotate › Text annotations, range highlights & reference lines (both axes) |                                                                                                                                                                                               |                                                      |
| Appearance › Plot height                                                    | fixed / based on width                                                                                                                                                                        | Mar 2024                                             |

### 2.14 Dot plot

| Setting                                                                 | Values                                                                   | Notes / default      |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------- |
| Labels › Select column                                                  | category column                                                          |                      |
| Labels › Alignment                                                      | left (default) / right                                                   |                      |
| Labels › Show values on hover                                           | on/off                                                                   |                      |
| Horizontal axis › Axis range                                            | round / exact / custom                                                   |                      |
| Horizontal axis › Number format                                         |                                                                          |                      |
| Horizontal axis › Custom grid lines                                     | "0, 20"                                                                  |                      |
| Horizontal axis › Tick position                                         | top / bottom                                                             |                      |
| Appearance › Base color / Customize colors (per column)                 |                                                                          |                      |
| Appearance › Color key                                                  | on/off                                                                   |                      |
| Appearance › Highlight range between dots                               | on/off                                                                   | Thick connecting bar |
| Sorting & Grouping › Sort (by column) / Reverse order / Group by column |                                                                          |                      |
| Annotate                                                                | row-anchored text annotations, vertical range/line highlights (Nov 2024) |                      |

### 2.15 Range plot

| Setting                                                                          | Values                                                                                     | Notes / default |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------- |
| Range › Range start / Range end                                                  | numeric columns                                                                            |                 |
| Labels › Alignment                                                               | left / right                                                                               |                 |
| Labels › Show values                                                             | on/off; type absolute difference / % change; number format                                 |                 |
| Horizontal axis › Axis range                                                     | round / exact / custom                                                                     |                 |
| Horizontal axis › Number format / Custom grid lines / Tick position (top/bottom) |                                                                                            |                 |
| Appearance › Range start color / Range end color                                 | colours                                                                                    |                 |
| Sorting & Grouping › Sort rows                                                   | original / range start / range end / difference / % change; Reverse order; Group by column |                 |
| Annotate                                                                         | text annotations, vertical highlights (Nov 2024)                                           |                 |

### 2.16 Arrow plot

| Setting                                                                                                             | Values                                           | Notes / default |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------- |
| Arrows › Arrow start / Arrow end                                                                                    | numeric columns                                  |                 |
| Labels › Alignment; Show values (absolute difference / % change); Number format                                     |                                                  |                 |
| Horizontal axis › Axis range (round / exact / custom); Number format; Custom grid lines; Tick position (top/bottom) |                                                  |                 |
| Appearance › Arrow color (base) / Customize colors; Color key on/off with editable descriptions; Arrow thickness    |                                                  |                 |
| Sorting & Grouping › Sort rows (spreadsheet / start / end / difference / % change); Reverse; Group by column        |                                                  |                 |
| Annotate                                                                                                            | text annotations, vertical highlights (Nov 2024) |                 |

### 2.17 Pie chart

| Setting                                | Values                                                                                    | Notes / default       |
| -------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------- |
| Pie slices › Select column             | one numeric column                                                                        | Default first numeric |
| Pie slices › Slice color               | customize colors per slice                                                                |                       |
| Pie slices › Pie size                  | margin %                                                                                  |                       |
| Pie slices › Sort by                   | largest→smallest (default) / keep order                                                   |                       |
| Labels › Number format                 |                                                                                           |                       |
| Labels › Convert values to percentages | on/off                                                                                    |                       |
| Labels › Inside labels                 | on/off; Show labels; Show slice color for labels                                          |                       |
| Labels › Outside labels                | on/off; Show values                                                                       | Disables color key    |
| Color key                              | on/off; Position top / bottom / left / right; Stack labels (top/bottom only); Show values |                       |
| Grouping › Automatic grouping          | > 5 slices → smallest grouped; max slice count; group label text                          |                       |

### 2.18 Donut chart

As pie, plus: **Outer radius** (margin %), **Inner radius** (thickness), Inside labels sub-options (labels, values, use slice colour), **Show value inside donut** (sum / single slice / custom text), automatic grouping threshold > 7 slices.

### 2.19 Election donut

| Setting                                                            | Values                                                | Notes / default |
| ------------------------------------------------------------------ | ----------------------------------------------------- | --------------- |
| Base color / Customize colors                                      | per party slice                                       |                 |
| Sort by size                                                       | on/off (default off → data order, i.e. seating order) |                 |
| (Standard title/description/notes; other pie options [unverified]) |                                                       |                 |

### 2.20 Multiple pies / 2.21 Multiple donuts

As pie/donut plus: **Minimum grid column width** (controls pies per row; check mobile), sort uses first pie as benchmark, **Show inside values**, **Show value below each pie/donut** (sum / single slice), donuts also **Show value inside donut**; automatic grouping > 5 slices.

### 2.22 Dual-axis chart (Jul 2026)

| Setting                        | Values                                                                                                                                                                                                                                                                                                                                                                                      | Notes / default                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Display › Series placement     | drag & drop / arrows to left or right axis; swap sides (Alt = also swap chart types)                                                                                                                                                                                                                                                                                                        |                                            |
| Display › Chart type per side  | Line / Area / Column                                                                                                                                                                                                                                                                                                                                                                        | ≥ one side must be Line                    |
| Lines (per side, per series)   | color / base color; show outline (off); interpolation; width; dash (off); label; show in legend (on); show value labels (off) with format, placement first/last/all (default last), visible per line, outline labeled points (off), match label color (off); show line symbols (off) with type (8 shapes), placement (all), filled/hollow (filled), size, opacity; connect all points (off) |                                            |
| Columns                        | color / base color; space between columns 0–100 %; label; show in legend; stack columns (off); sort stacked smallest/largest first; 100 % stacked (off); value labels (off) with format, placement inside/outside, match column color (on), hide overlapping (off); show totals (stacked only)                                                                                              |                                            |
| Areas                          | color; interpolation; area opacity; label; in legend; stack areas (on); sort stacked; 100 % stacked (off); display line between areas (off) + line color                                                                                                                                                                                                                                    |                                            |
| Vertical axis › Tick alignment | Independent / Aligned                                                                                                                                                                                                                                                                                                                                                                       | Aligned = gridlines coincide across axes   |
| Vertical axis (per side)       | custom range; custom ticks; number format; prepend/append text ($, €); grid off/ticks/lines (lines); grid labels on/off                                                                                                                                                                                                                                                                     |                                            |
| Vertical axis (both)           | label position inside/outside (outside); label color match data / neutral (match); make scales proportional (off)                                                                                                                                                                                                                                                                           | Auto zero-baseline alignment               |
| Horizontal axis                | custom range; custom ticks; date format; grid off/ticks/lines                                                                                                                                                                                                                                                                                                                               |                                            |
| Legend › Axis titles           | on/off (off); match color to chart elements (on)                                                                                                                                                                                                                                                                                                                                            |                                            |
| Legend › Color legend          | on (default); layout Split / Stacked / Combined; show items as list; axis side labels "Left scale/Right scale" on/auto/off; highlight series on hover                                                                                                                                                                                                                                       |                                            |
| Appearance › Plot height       | fixed / based on width                                                                                                                                                                                                                                                                                                                                                                      |                                            |
| Tooltips                       | on; left/right/horizontal axis number formats; horizontal value in tooltip title vs. on axis                                                                                                                                                                                                                                                                                                | Table-style tooltip with reference symbols |
| Annotate                       | annotations assignable to left or right axis; range highlights & reference lines                                                                                                                                                                                                                                                                                                            |                                            |

### 2.23 Waterfall chart (Jul 2026)

| Setting                                                     | Values                                                                                | Notes / default                                                                                    |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Waterfall data › Select column                              | numeric column                                                                        |                                                                                                    |
| Waterfall data › Data format                                | Differences (default) / Running totals                                                |                                                                                                    |
| Horizontal axis › Grid                                      | none (default) / lines / ticks                                                        |                                                                                                    |
| Horizontal axis › Rotate labels                             | auto (default) / always / never                                                       |                                                                                                    |
| Vertical axis › Custom range / Custom ticks / Number format |                                                                                       | Cannot cut data                                                                                    |
| Vertical axis › Grid                                        | lines / ticks / off                                                                   |                                                                                                    |
| Vertical axis › Grid labels                                 | outside (default) / inside; left/right; hide                                          |                                                                                                    |
| Vertical axis › Zoom to differences                         | on/off                                                                                | Only when min-to-zero > min-to-max; removes zero baseline; totals shown as points or faded columns |
| Columns › Colors                                            | increases / decreases / (sub)totals                                                   | Default colour-blind-safe green/red                                                                |
| Columns › Connecting lines                                  | thin (default) / thick / off                                                          |                                                                                                    |
| Columns › Space between columns                             | 0–100 % (default 40 %)                                                                |                                                                                                    |
| Columns › Show column for start value                       | on (default); label as Total / Difference; custom label                               |                                                                                                    |
| Columns › Show column for end value                         | on (default); custom label                                                            |                                                                                                    |
| Columns › Show subtotals                                    | on/off (needs category column)                                                        | Auto-calculated                                                                                    |
| Labels › Show totals                                        | all columns / only (sub)totals; number format                                         |                                                                                                    |
| Labels › Show differences between values                    | on/off; absolute / % change; inside / outside; match column colors                    |                                                                                                    |
| Labels › Show color legend                                  | off (default); custom text; drag order; stack vertically                              |                                                                                                    |
| Labels › Prevent label overlapping                          | on (default)                                                                          |                                                                                                    |
| Tooltips                                                    | on (default) / off                                                                    |                                                                                                    |
| Sorting                                                     | default order / increases first / decreases first                                     | Per subtotal group                                                                                 |
| Appearance › Plot height                                    | fixed / based on width                                                                |                                                                                                    |
| Annotate                                                    | text annotations (font size, color, pointer lines), reference lines, range highlights |                                                                                                    |

---

## Section 3 — Cross-cutting features

### 3.1 Annotate step (all charts)

- **Title** (can be hidden via checkbox while kept as internal name), **Description**, **Notes** (footnote; supports simple HTML + inline CSS, e.g. `<b style="color:red;font-size:20px">`), **Data source** name + **Source URL**, **Byline**, **Alternative description** (alt text for screen readers). Multiple sources via HTML links in Notes. Links insertable in title/description/notes/tooltips.
- **Text annotations** (all chart types listed in §1 except pies/donuts [pie support unverified]): rich text (bold/italic/underline/strike, `<sub>/<sup>`, colour via HTML span or picker, font size, text outline, emoji, line breaks); position by drag or X/Y input; **row anchoring** for bar/dot/range/arrow charts (survives re-sort); 9-point **anchor grid** controlling growth direction & alignment; width as % of chart or auto; offset (px) for consistent spacing; **connector line** ("Draw line to annotation text": line type, width, end style incl. arrow heads, distance, line takes text colour, circle endpoint of fixed size); **mobile**: show on desktop / mobile toggles, "Show as key on mobile" (default on → numbered annotations listed below chart, order draggable); multi-panel repeat; multi-select formatting.
- **Range highlights & reference lines** (bar, column, line, area, scatter, dot, range, arrow, waterfall, dual-axis): vertical (all) and horizontal (non-row charts); place by drag or exact values; color & opacity; lines: width 1 px (default)/2/3, style solid (default)/dotted/dashed; ranges: solid fill or diagonal stripes (up/down, 3 presets, custom stripe width & gap px); ranges render behind everything, lines on top; assign to panel or "repeat in all panels"; convert range↔line; duplicate/delete.
- **Scatter-only**: label selection (auto/manual), highlight labelled symbols, custom lines/areas, full tooltip editor.

### 3.2 Number formatting

Dropdown presets: `1,000[.00]`, `0`, `0.0`, `0.00`, `0.000`, `0.[0]`, `0.[00]`, `0%`, `0.0%`, `0.[0]%`, `0.[00]%`, `10,000`, `1st`, `123k`, `123.4k`, `123.45k`. Custom (numeral.js-style) tokens: `0.0` fixed decimals · `0.[0]` optional decimals · `0,0` thousands grouping · `0;0` grouping from 10 000 · `0a` abbreviate (k/m/b) · `0%` · `(0)` negatives in parentheses · `+0` explicit plus · `|0|` drop minus · `$0` currency (localised by output locale) · `H:M` minutes→d:h:m · `0,0e+0` scientific. Combinable, e.g. `+$0.[00]a`. Prefix/suffix: dual-axis has explicit **Prepend/Append** fields; other charts add units via column header in step 2 or in the format string. Locale (60+ output locales) controls separators, month/weekday names, currency symbol and footer translations. Dates: axis "Date format"/"Tick format" dropdowns (auto-guessed frequency); tooltip date format separate.

### 3.3 Tooltips

- All charts: on/off, number format, date format (line/area/dual-axis/multiples); dual-axis renders a table-like tooltip; small multiples sync tooltips across panels.
- **Template editor (scatter plot, choropleth & symbol maps only)**: title + body fields; `{{ column }}` placeholders; arithmetic `+ - * / % ^`; math functions (SIN, SQRT, LOG …); `FORMAT(value, "0,0.[00]")`, `ROUND(x, n)`, `UPPER/LOWER/PROPER/TITLE`, `CONCAT`; ternary conditionals `{{ a > 20 ? 'x' : 'y' }}`; HTML allowed (`<b> <i> <u> <s> <big> <small> <hr> <br> <table> <tr> <td> <a> <img>` + ~30 more). Parser documented at github.com/datawrapper/datawrapper libs/chart-core/docs/parser.md.
- Line/area/bar tooltips are **not** templatable (formats only) — a notable limitation.

### 3.4 Color

- LCH colour picker (lightness, chroma, hue) + hex / CSS colour names; 8-digit hex for opacity; theme palette swatches; per-chart "Base color" → automatic shades; "Customize colors" with multi-select (Shift/Ctrl), reset, select/deselect all; drag-reorder colour-key entries, rename entries, merge equal-colour categories; **color by column** (bar charts: categorical column; scatter: category column; multiples columns: by category); colour-scale tool for maps/tables (stepped/continuous) not used in charts except scatter [unverified]. Built-in **colorblind check** (protanopia/deuteranopia/tritanopia warning). Colour key ("Show color key") toggle on nearly every chart, with position (pies: top/bottom/left/right), stacked/list layout, values in key (pies), Split/Stacked/Combined layouts + hover highlight (dual-axis).

### 3.5 Axes

Custom range (min/max; column/bar min pinned at ≤0), custom ticks (comma list), log scale (line, multiple lines, scatter; not with zeros), grid lines/ticks/off, grid labels inside/outside/auto/off and left/right, axis position top/bottom (scatter, dot/range/arrow tick position), date format, rotate category labels auto/always/never, sort/reverse categories, independent panel scales with range rounding, dual-axis tick alignment & proportional scales. No axis breaks, no axis titles except dual-axis "Axis titles" [unverified elsewhere], no secondary y-axis except the dual-axis chart type.

### 3.6 Overlays, confidence intervals, comparison columns

- **Overlays** (bar family since Jun 2021, column charts since Oct 2021, multiple columns 2025): _Value_ overlay = line/notch marker from one column; _Range_ overlay = band from two columns; title, color, opacity, pattern (range), in legend / label on first row. Use for CI/error bars, targets, previous-year markers.
- **Line-chart CIs**: area fill between lower/upper columns + width 0 px lines.
- **Comparison columns** (column chart, Feb 2025): muted context column behind main column; label options (values below columns, differences in grey, coloured labels).
- Line chart **area fills** between any two lines or a line and zero, with negative-difference colour.

### 3.7 Layout step

Design theme (free: Datawrapper, Datawrapper 2012, extended charset, high contrast, Pageflow; custom themes on paid plans incl. logo toggle) · Output locale (60+) · Footer: data download (CSV), image download (PNG; PDF/SVG on Business/Enterprise), embed link, "Created with Datawrapper" attribution (removable on paid plans), logo · Share buttons (target: embedding page URL / Datawrapper URL / custom URL) · **Automatic dark mode** on/off + "Use the same colors in dark mode" · Plot height / chart width per device (responsive) · no per-chart custom CSS (theme-level only, via support).

### 3.8 Dark mode

Since Jan 2022 for all visualisations & themes. Auto via `prefers-color-scheme`; contrast-preserving colour transformation; per-theme custom dark colours (background, text, gridlines, palette) via support; force with `?dark=true|false` (iframe) or `data-dark="true|false"` (script embed); `.hide-in-dark` / `.hide-in-light` CSS classes for mode-specific HTML in text fields.

### 3.9 Publish / export / embed

- Publish → versioned public URL (`datawrapper.dwcdn.net/ID/v/`), "visualization only" vs "for sharing" URLs; republish increments version.
- Embed: **script/web-component** `<datawrapper-visualization>` (recommended since Mar 2023; ~half render time, iframe fallback, PNG if no JS; attributes `data-dark`, `data-logo`), **responsive iframe**, **plain iframe**; oEmbed endpoint + WordPress plugin; custom embed code templates (Enterprise).
- Export: PNG (all plans; width, scale/zoom 1×–4×+, border px, header/footer on/off, transparent, plain), PDF & SVG (Pro/Business/Enterprise; unit px/inch/mm, CMYK or RGB, scale, border, plain); automatic image publishing (Pro+) with predefined formats (plain_s.png, plain.png, full.png, auto height); PowerPoint add-in; API export endpoint.
- Responsive: plot-height control (fixed px or % width) for line/area/scatter/column family; separate mobile settings (panels per row on mobile, show-on-mobile per panel/annotation, mobile annotation key, mobile label margin ignored); RTL support (multiples).

### 3.10 Accessibility

Alt description field (Annotate); auto-generated screen-reader description for line charts & scatter plots (type, element count, axis/grid label summary, colour legend, annotations); `aria-hidden` handling; colorblind check tool; high-contrast theme; data download for screen-reader users; keyboard navigation [unverified]; direct labelling & non-overlap algorithms.

### 3.11 Other cross-cutting

Flag icons from ISO codes (bar family, tables); links in text; undo/redo in editor (Apr 2026); live collaboration & workspaces (Sept 2025); API for chart creation & editing (metadata JSON mirrors all the above settings, e.g. `visualize.*` keys — see DatawRappr `dw_edit_chart`); Datawrapper MCP server exists (third-party).

---

## Section 4 — Notable recent feature releases (chart features only)

| Date                       | Release                                                                                                                                       | URL                                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 2026-07-23                 | **New: Dual-axis charts** (lines/columns/areas on two axes, tick alignment, split/stacked/combined legends, table tooltips)                   | https://www.datawrapper.de/blog/dual-axis-charts                                                      |
| 2026-07-23                 | **New: Waterfall charts** (differences/running totals, subtotals, zoom to differences, connectors)                                            | https://www.datawrapper.de/blog/waterfall-charts                                                      |
| 2026-07-23                 | New Pro & Business plans (affects PDF/SVG/image-publishing entitlements)                                                                      | https://www.datawrapper.de/blog/pro-and-business-plans                                                |
| 2026-04-16                 | New: Undo/redo in the editor                                                                                                                  | https://www.datawrapper.de/blog/undo-redo-in-datawrapper                                              |
| 2025-12-22                 | New website (chart-type pages restructured, "23 chart types")                                                                                 | https://www.datawrapper.de/blog/new-website-launch                                                    |
| 2025-09-05                 | New: Workspaces (collaboration)                                                                                                               | https://www.datawrapper.de/blog/new-workspaces                                                        |
| 2025-02-18                 | **New: Small multiple column charts** (panels, overlays, synced tooltips, independent scales)                                                 | https://www.datawrapper.de/blog/small-multiple-column-charts                                          |
| 2025-02-07                 | **New: Comparison columns** in column charts                                                                                                  | https://www.datawrapper.de/blog/comparison-columns                                                    |
| 2025-01-20                 | **New: Connect all points** in line charts (per-series; step interpolation, symbols for gaps)                                                 | https://www.datawrapper.de/blog/connect-all-points-in-line-charts                                     |
| 2024-11-01                 | **New: Annotations in bar, range, dot, arrow, split, grouped, bullet, stacked bar charts** (row-anchored; repeating highlights across panels) | https://www.datawrapper.de/blog/annotations-in-bar-charts                                             |
| 2024-09-18                 | **New: Automatic value labels in line charts** (first/last/all/peaks, per-line count, outline, colour)                                        | https://www.datawrapper.de/blog/automatically-label-values-in-line-charts                             |
| 2024-05-02                 | Easier line chart editing (per-line settings, multi-select, outlines, hollow symbols, per-line legend/labels/symbols)                         | https://www.datawrapper.de/blog/improved-line-chart-editing                                           |
| 2024-03-22                 | **New: Responsive plot-height control** (fixed vs width-relative) for line/area/scatter/column charts                                         | https://www.datawrapper.de/blog/responsive-height-control                                             |
| 2024-02-05                 | **New: Small multiple line charts** ("most requested chart type")                                                                             | https://www.datawrapper.de/blog/small-multiple-line-charts                                            |
| 2023-03-03                 | Web-component (script) embedding, `data-dark`/`data-logo` attributes                                                                          | https://www.datawrapper.de/blog/web-component-embedding                                               |
| 2022-01-26                 | **Dark mode** for all visualisations                                                                                                          | https://www.datawrapper.de/blog/dark-mode-for-embedded-visualizations                                 |
| 2021-06-02 (upd. Oct 2021) | Overlays: confidence intervals & value markers in bar (then column) charts                                                                    | https://www.datawrapper.de/blog/confidence-intervals-value-markers-bar-charts                         |
| 2020-11-02                 | Responsive text annotations rework (in-chart editing, arrows/circles, mobile key, range highlights with dash/opacity)                         | https://www.datawrapper.de/blog/better-more-responsive-annotations-in-datawrapper-data-visualizations |
| 2020-04-01                 | Unified bar-chart editing UI (bar, split, stacked, grouped, bullet)                                                                           | https://www.datawrapper.de/blog/new-interface-for-bar-charts                                          |
| 2016-12-22                 | Improved stacked columns (direct labels, connected areas, mobile spacing)                                                                     | https://www.datawrapper.de/blog/improved-stacked-column-charts                                        |

Blog also announced (not chart-specific, omitted): locator-map arrows (Jun 2026), marker editor (Dec 2025), passkeys (May 2026), permissions/guest roles (Mar 2026). Popularity note (Dec 2025 "Which chart types did our users create in 2025?"): tables #1, line charts #2 (line+area combined #1); column charts "received new features during 2025".

---

## Section 5 — Source URLs

Product pages

- https://www.datawrapper.de/charts
- https://www.datawrapper.de/charts/line-chart
- https://www.datawrapper.de/charts/bullet-bars (redirects to generic charts page)
- https://www.datawrapper.de/features
- https://www.datawrapper.de/blog/popular-chart-types-2025

Academy — per chart type

- https://www.datawrapper.de/academy/customizing-your-bar-chart
- https://www.datawrapper.de/academy/customizing-your-split-bar-chart
- https://www.datawrapper.de/academy/customizing-your-stacked-bar-chart
- https://www.datawrapper.de/academy/how-to-create-a-grouped-bar-chart
- https://www.datawrapper.de/academy/customizing-your-grouped-bar-chart
- https://www.datawrapper.de/academy/customizing-your-bullet-bar-chart
- https://www.datawrapper.de/academy/category/bar-charts
- https://academy.datawrapper.de/article/44-customizing-your-column-chart / https://www.datawrapper.de/academy/customizing-your-column-chart
- https://www.datawrapper.de/academy/customizing-your-grouped-column-chart
- https://www.datawrapper.de/academy/customizing-your-stacked-column-chart / https://academy.datawrapper.de/article/46-customizing-your-stacked-column-chart
- https://academy.datawrapper.de/article/404-customizing-your-multiple-columns-chart
- https://www.datawrapper.de/academy/customizing-your-line-chart
- https://www.datawrapper.de/academy/how-to-create-your-first-line-chart
- https://academy.datawrapper.de/article/321-patchy-data
- https://academy.datawrapper.de/article/385-customizing-your-small-multiple-line-chart
- https://www.datawrapper.de/academy/customizing-your-area-chart
- https://academy.datawrapper.de/article/66-customizing-your-scatter-plot
- https://academy.datawrapper.de/article/146-customizing-your-scatter-plot-annotate
- https://www.datawrapper.de/academy/scatterplots-add-custom-lines-and-areas
- https://www.datawrapper.de/academy/how-to-connect-scatterplot-dots-with-lines
- https://www.datawrapper.de/academy/customizing-your-dot-plot
- https://academy.datawrapper.de/article/126-customizing-your-range-plot
- https://www.datawrapper.de/academy/customizing-your-arrow-plot
- https://www.datawrapper.de/academy/customizing-your-pie-chart
- https://www.datawrapper.de/academy/customizing-your-donut-chart
- https://www.datawrapper.de/academy/customizing-your-election-donut
- https://academy.datawrapper.de/article/186-customizing-your-multiple-pies-chart
- https://www.datawrapper.de/academy/customizing-your-multiple-donuts-chart
- https://www.datawrapper.de/academy/customizing-your-dual-axis-chart
- https://www.datawrapper.de/academy/customizing-your-waterfall-chart
- https://www.datawrapper.de/academy/how-to-make-bar-line-chart-combinations-in-datawrapper

Academy — cross-cutting

- https://academy.datawrapper.de/article/336-annotate-tab
- https://www.datawrapper.de/academy/how-to-create-text-annotations
- https://www.datawrapper.de/academy/range-highlights-and-lines
- https://www.datawrapper.de/academy/custom-number-formats-that-you-can-display-in-datawrapper
- https://www.datawrapper.de/academy/i-want-to-change-how-my-data-appears-in-tooltips
- https://www.datawrapper.de/academy/how-to-pick-colors-in-datawrapper
- https://www.datawrapper.de/academy/how-to-add-overlays-to-bar-column-charts
- https://www.datawrapper.de/academy/confidence-intervals-error-bars-datawrapper-bar-charts
- https://www.datawrapper.de/academy/how-to-show-confidence-intervals-in-datawrapper-line-charts
- https://www.datawrapper.de/academy/layout-tab
- https://www.datawrapper.de/academy/dark-mode-in-embedded-datawrapper-visualizations
- https://academy.datawrapper.de/article/180-how-to-embed-charts
- https://www.datawrapper.de/academy/how-to-download-your-chart-as-a-png
- https://www.datawrapper.de/academy/how-to-set-up-automatic-image-publishing
- https://developer.datawrapper.de/docs/exporting-as-pdfsvg
- https://www.datawrapper.de/academy/how-we-make-sure-our-charts-maps-and-tables-are-accessible

Blog (feature releases) — see Section 4 table for URLs; index: https://www.datawrapper.de/blog/category/datawrapper-news
