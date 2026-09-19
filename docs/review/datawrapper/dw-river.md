# Datawrapper River "Our favorites" — field notes for brand-ui charts

Observed 2026-09-18 in the Claude browser pane (pane width 751 px). Detail pages open a modal with a live
embed at `https://app.datawrapper.de/preview/<id>?published=1`; that preview URL was loaded directly for
deep dives and responsive tests. Chart type was read from the `.dw-chart` class list (`vis-d3-lines`,
`vis-tables`, …) so it is exact. Tooltip text was read from the DOM (`.dw-tooltip` / `[class*=tooltip]`);
where that returned nothing the tooltip was read from a screenshot. `resize_window` viewport emulation
worked (380 / 600 / 900 px; the 900 px view is scaled down into the 751 px pane, so pixel measurements
at 900 come from `getBoundingClientRect`, not from the image). `zoom` (region crop) is NOT supported in
this pane, so small text was verified via `get_page_text`/JS rather than zoomed screenshots.
Anything I could not verify is marked **[unverified]**.

---

## 1) Catalogue of cards (pages 1–2, ~30 of ~96 cards)

Card anatomy (constant): title (bold, 1–2 lines, truncated with …) · byline "Author, Org · N days ago" ·
live thumbnail of the chart · footer with "reuse count" glyph + `Reuse` button. Cards are 3-up at 1000 px,
1-up in the 751 px pane. Reuse counts are the closest thing to "likes".

| #   | Card (id)                                                                | Type (from class / thumbnail)                       | Visible design devices                                                                                                                        |
| --- | ------------------------------------------------------------------------ | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Less work for ATMs, while payment terminals get busy (hio0J)             | `vis-multiple-columns` (2 stacked column panels)    | Title-as-finding; subtitle; one hue per panel (yellow vs green); in-chart text annotation; italic note; "Chart: … • Source: … • Get the data" |
| 2   | Summer time zones (EgJP5, CBC)                                           | Choropleth (Canada, categorical)                    | Categorical legend, muted pastel fills                                                                                                        |
| 3   | Germany is following the trend of fewer cash payments (biQ82)            | Line chart, several lines                           | Direct end labels, one highlight line vs greys **[from thumbnail]**                                                                           |
| 4   | 2024 Presidential Election Results, by County (2hjW5)                    | US county choropleth                                | Red/blue diverging                                                                                                                            |
| 5   | Analysis of the U.S. liquor industry during Prohibition (VKhwo)          | Timeline / range plot                               | Categorical colour key at top                                                                                                                 |
| 6   | Brasil é o 4º maior produtor de leite bovino (cw36h)                     | Horizontal bars                                     | Flags in row labels, one highlighted bar (Brazil) vs grey                                                                                     |
| 7   | A closer look at the history of some Berlin neighborhoods (CIcPd)        | Locator map with area highlights                    | Text labels on map                                                                                                                            |
| 8   | Transferstromen Belgische clubs (Yuxrf)                                  | Line chart, 2 lines                                 | Direct labels, dashed vs solid                                                                                                                |
| 9   | Where in the USA I've been (zZJf7)                                       | Tile grid map                                       | Emoji / symbols inside tiles, personal data                                                                                                   |
| 10  | Qué dicen y qué ocultan las cifras… México (vhogP)                       | Choropleth (Mexican states)                         | Diverging red/grey                                                                                                                            |
| 11  | Accuracast International Growth Index (PtAEZ)                            | Dot plot with sized circles (scatter)               | Green sized bubbles on ranked rows                                                                                                            |
| 12  | How Lake Ontario is split between Canada and the U.S. (Ahkwm, CBC, 12)   | `vis-locator-map`                                   | Two filled areas, inline value labels "Canada: 10,049 km²", inset map, scale bar                                                              |
| 13  | It's not all about power — size matters too (XOA9o, 10)                  | `vis-d3-bars` (range bars)                          | Grouped rows; light/dark blue ranges + average tick; value labels; note explains encoding                                                     |
| 14  | Структура домохозяйств… (lhjy0)                                          | Line chart                                          | Many lines, direct labels                                                                                                                     |
| 15  | Memory prices rise as demand soars (yea0R, 5)                            | `vis-multiple-lines` (4 small multiples, area fill) | Inline colour-coded chips in subtitle; big "+217%" figure per panel                                                                           |
| 16  | Цены на бензин… (UoCAt)                                                  | Table with bars                                     | Flag column, inline bar column                                                                                                                |
| 17  | Solo en 6 estados coinciden gobierno federal y estatal (gbNcm)           | Choropleth (Mexico, dark bg)                        | Categorical, dark theme                                                                                                                       |
| 18  | AI Alliances: Competing for Compute (ZsXPh, 4)                           | `vis-locator-map` (world)                           | 3-swatch custom legend, hatched fill for dual membership, long description, footnote                                                          |
| 19  | How happy is our planet? (xGHZa, 13)                                     | `vis-d3-maps-choropleth` (world)                    | Gradient legend w/ title, medal emoji annotation "🥇 Costa Rica" with curved arrow, rich HTML tooltip                                         |
| 20  | Growing GDP does not guarantee a better life (0fg8I, 12)                 | `vis-d3-scatter-plot` used as connected scatter     | Segment colouring (blue down / green up / pink COVID), "▼ Time follows the line", start/end year labels, axis titles inside plot              |
| 21  | El campo europeo sigue en manos de los mayores de 45 (8YTNo)             | Stacked bars                                        | Flags, sequential palette                                                                                                                     |
| 22  | Total solar eclipse 2026 (R0SRM)                                         | Locator map                                         | Path band, dark theme                                                                                                                         |
| 23  | Since 1970, pride events… (tbxzz)                                        | Timeline dot matrix                                 | Sequential purple                                                                                                                             |
| 24  | Distinción s/θ en Andalucía (8bm2d)                                      | Symbol map                                          | Red vs grey dots                                                                                                                              |
| 25  | Student loan repayment vs amount loaned by nationality (gOCpU, 10)       | `vis-d3-scatter-plot` (bubbles, log x)              | Two-colour categorical (blue EU / yellow other), dashed reference line, axis titles in plot, direct labels                                    |
| 26  | Number of all bikes sold in 2025… (t8R9d, 3)                             | `vis-d3-lines`                                      | Numbered ①–④ annotations, range highlight (Covid-19), end value labels, ±0 baseline                                                           |
| 27  | Cada vez nacen menos chicos en Argentina (kJpG5)                         | Population pyramid (bars)                           | Sequential yellow→blue by cohort                                                                                                              |
| 28  | This is where the shots actually go (V5Bwb, 36)                          | `vis-tables` (table cells as heatmap)               | Gradient legend few→many, no header row, italic method note                                                                                   |
| 29  | Border Status of Russia, Georgia and South Ossetia (8VHD9, 40)           | `vis-locator-map`                                   | Terrain basemap, hatched/filled areas, small-caps region labels, 4-item legend                                                                |
| 30  | My version of John Snow's Cholera Map (lzM1c, 14)                        | `vis-locator-map`                                   | Numbered pump markers, translucent radius circles, custom legend, callout texts                                                               |
| 31  | Where Europe needs cooling 🧊 (dwEtR, 28)                                | `vis-d3-maps-choropleth` (NUTS3)                    | Sequential green→blue, 6 text annotations with leader lines, "Cooling needed →" legend                                                        |
| 32  | Washi Pronunciation Guide (2CtWv)                                        | Table                                               | Text-only                                                                                                                                     |
| 33  | Does your city meet the 3-30-300 rule? (2Km0K)                           | Dot plot                                            | Three coloured dots per row                                                                                                                   |
| 34  | Trade and logistics sub-pillar (wSCHo)                                   | `vis-d3-bars-split`                                 | One highlighted row (dark) vs light blue, value labels inside bars, "independent scales" note                                                 |
| 35  | Killed in the Line of Duty (diFCo, p2, 16)                               | Area chart (inverted, red)                          | Big in-chart headline number                                                                                                                  |
| 36  | How to become a trillionaire (USKka, p2, 14)                             | Stacked area                                        | Many direct labels                                                                                                                            |
| 37  | Top occupations hiring… (DUKU7, p2, CBC)                                 | `vis-tables`                                        | Search box, pagination, green "+14%" text, bold numbers                                                                                       |
| 38  | Women live longer than men… (Efxsw, p2, 24)                              | `vis-d3-scatter-plot` (beeswarm)                    | 6-colour continent key, dashed "Global average" line, selective direct labels                                                                 |
| 39  | Number of days per year with no true night (79ioH, p2, 54 — most reused) | `vis-locator-map` (orthographic)                    | Highlighted words in title/description (yellow/dark chips), projection toggle link, dotted latitude circles                                   |
| 40  | Potential northern pipeline routes (a3UAO, CBC, 28)                      | Locator map                                         | Route lines with labels                                                                                                                       |

Types seen across both pages: lines ≈ 12, bars/columns ≈ 8, choropleth ≈ 9, locator ≈ 9, scatter/dot ≈ 7,
tables ≈ 5, area ≈ 3, other (pyramid, tile grid, timeline) ≈ 4. Maps are strongly over-represented
versus a typical BI dashboard.

---

## 2) Deep dives

### 2.1 This is where the shots actually go (V5Bwb) — Julian Freyberg

- **Type:** `vis-tables`. A 12 × 24 table with header row hidden; every cell colour-coded (heatmap) and
  the values themselves hidden — the table component is abused as a pixel grid.
- **Annotations:** none in-chart. The story is carried by the title, the bold phrase in the description
  ("from the **shooter's perspective**") and a long italic method note under the grid.
- **Labels/legend:** compact gradient bar top-left with only "few" / "many" end labels (no numbers).
- **Colour:** single sequential YlOrRd→purple ramp (light yellow → dark purple).
- **Axes:** none. No ticks, no gridlines.
- **Tooltip:** none (hover does nothing). **[verified: DOM tooltip query returned nothing]**
- **Text block:** title → description → legend → grid → italic notes → "Table: Julian Freyberg • Source: StatsBomb Open Data • Get the data".
- **Unusual:** a heatmap built from the table component; cells resize fluidly with width.

### 2.2 Where Europe needs cooling 🧊 (dwEtR) — David Wendler

- **Type:** `vis-d3-maps-choropleth`, NUTS-3 regions, non-data countries in light grey, sea white.
- **Annotations:** 6 text labels placed on the map ("Sweden", "London", "Alps", "France", "Spain",
  "Greece", "Harghita mountains / Romania"), each with a thin black leader line to a point; label has
  bold name + lighter sub-line. Emoji in title.
- **Legend:** bottom-left, titled "Cooling needed →", 11 discrete swatches, NO numbers at all — the
  arrow plus the title carries the meaning. On hover the swatch matching the hovered value is
  highlighted (arrow marker in the legend).
- **Colour:** sequential pale green → teal → dark blue (single ramp).
- **Tooltip:** card with bold region name, country beneath, then big number "84" and caption
  "Cooling degree day index 2025" in two columns. Tooltip is placed beside the cursor inside the map.
- **Controls:** +/− zoom buttons bottom-right.
- **Text block:** "Map: David Wendler • Source: Joint Research Centre's AGRI4CAST • Get the data • Embed • Download image".

### 2.3 Number of all bikes sold in 2025 matched low 2017 levels… (t8R9d) — Lisa Charlotte Muth

- **Type:** `vis-d3-lines`, 4 indexed lines (2017 = ±0), curved interpolation, small dots on every point.
- **Annotations:** four numbered text annotations ①–④ that read as a sentence in reading order
  ("E-bike sales have been up >180% since 2017…" → "…driving up the revenue…" → "That's true even
  though total bike sales haven't changed much…" → "…because sales of regular bikes have fallen").
  Each annotation is coloured like its line, with key words in bold. A grey vertical range highlight
  2020–2022 labelled "Covid-19" in italics at the bottom. Peak value labels "+214%", "+171%", "+34%"
  sit directly on the series.
- **Labelling:** no legend at all; colour of annotation text = colour of line. End labels are the
  numbers, not names.
- **Colour:** 4 distinct hues (raspberry, navy, orange, coral), no grey lines.
- **Axes:** y ticks "−100 / −50 / ±0 / +100 / +200%" — unit only on the last tick; thin light
  gridlines; darker baseline at ±0; x ticks every year.
- **Tooltip:** hovering a line dims all other lines to ~15% opacity and shows an inline label at the
  hovered point: series name in bold ("Sales value bikes and e-bikes"), year, value ("+171%"). Not a box.
- **Text block:** "Chart: Lisa Charlotte Muth • Source: ZIV • Get the data".
- **Height:** fixed 712 px at 751 and 900 px width (`vis-height-fixed`).

### 2.4 It's not all about power — size matters too (XOA9o) — Gregor Aisch

- **Type:** `vis-d3-bars` (range bars, three groups "Small cars / Medium to large cars / SUVs").
- **Encoding:** light-blue bar = middle 90 %, dark-blue = middle 50 %, black tick = average, value label
  "1,134 kg" right of the tick. Explained by an italic note "Dark blue: middle 50% of cars. Light blue:
  middle 90%." — no legend.
- **Annotation:** one small label "Average weight" above the first tick.
- **Axes:** x ticks 1K / 1.5K / 2K / 2.5K at the bottom, very faint vertical gridlines; category labels
  left-aligned, group headers bold.
- **Tooltip:** none detected. **[DOM returned undefined]**
- **Text block:** note + "Chart: Gregor Aisch • Source: European Environment Agency (EEA), new car registrations…".

### 2.5 Memory prices rise as demand soars (yea0R) — Elliot Bentley

- **Type:** `vis-multiple-lines` — 2 × 2 small multiples, each an area-filled line.
- **Labelling:** subtitle contains two inline "chips" ("short-term RAM" on blue, "long-term storage" on
  dark grey) which double as the legend; panel titles are coloured the same way (blue / black). No legend
  block anywhere.
- **Annotation:** a big bold "+217% / +372% / +94% / +189%" inside each panel bottom-right; last point
  has a dot. One panel has a hidden-in-text annotation "Memory for long-term storage… has also gotten more
  expensive." (present in DOM, not visible at 751 — **[unverified where it shows]**).
- **Axes:** y axis on the right, independent scale per panel, currency only on the top tick ("$180");
  x ticks just "2025", "2026".
- **Tooltip:** synchronized crosshair across all four panels: the date "July 24, 2025" is shown once,
  and each panel shows its own value ("$64.1", "$128.2", "$58", "$57.6") at the intersection.
- **Text block:** "Chart: Elliot Bentley • Source: Pangoly • Get the data".

### 2.6 AI Alliances: Competing for Compute (ZsXPh) — CEPA

- **Type:** `vis-locator-map` (world, custom theme "cepa").
- **Colour:** 3 categorical fills: slate blue (Pax Silica), pale blue (observers), red (WAICO);
  Kazakhstan hatched = both. Non-members white; basemap labels suppressed.
- **Legend:** custom 3-row/3-column HTML legend under the map with square swatches.
- **Text:** 4-line description paragraph; footnote with asterisk; "Map: … • Source: … • Embed • Download image";
  social share icons top-right (theme feature).
- **Tooltip:** none tested **[unverified]**.

### 2.7 How happy is our planet? (xGHZa) — Antonio Sarcevic

- **Type:** `vis-d3-maps-choropleth` world map.
- **Colour:** diverging pink (low) → white → green (high) continuous gradient, no-data grey.
- **Legend:** titled gradient bar "Happy Planet Index score", only min/max labelled (34.2 / 68.3).
  Hovering a country places a ▲ marker + value ("36.2") on the gradient.
- **Annotation:** "🥇 Costa Rica" text with a curved arrow to the country.
- **Description:** bold phrase inside the description; italic instruction line "Zoom in and hover…".
- **Tooltip:** custom HTML card: "Chad (#131)" then a 2-column table (HPI Score 36.2 / 100; Life
  Expectancy 🔴 55.4 years; Life satisfaction 🔴 4.4 / 10; Ecological Footprint 🟢 1.17 gha) — emoji as
  traffic lights. Rank in the title.
- **Text block:** italic "Data is for 2025." + "Map: … • Source: Happy Planet Index • Get the data • Created with Datawrapper".

### 2.8 Student loan repayment vs amount loaned by nationality (gOCpU) — Neil O'Brien

- **Type:** `vis-d3-scatter-plot` with bubble size (amount) and log x axis (10M … 1.5B).
- **Colour:** two categories — dark blue EU nations vs pale yellow others, explained only in the note.
- **Reference line:** dashed horizontal line at the UK rate (explained in the note, not labelled on chart).
- **Labels:** every bubble directly labelled (≈30), placed automatically around the marks.
- **Axes:** axis titles rendered INSIDE the plot ("Repayment Rate" top-left, "Amount Loaned"
  bottom-right); "%" only on the top y tick ("80%"); light dotted gridlines.
- **Tooltip:** "Poland / Amount loaned: £312803000 / Repayment rate: 58%" (raw unformatted number — a flaw).
- **Text block:** italic note + "Chart: Neil O'Brien • Source: FOI296, FOI297 • Get the data • Created with Datawrapper".

### 2.9 How Lake Ontario is split between Canada and the U.S. (Ahkwm) — CBC

- **Type:** `vis-locator-map`; light grey basemap; two translucent area fills (red Canada / blue US) with dashed outline.
- **Labels:** values written directly on the areas ("**Canada:** 10,049 km²"), city dots with labels,
  big letter-spaced country labels "CANADA / UNITED STATES", inset locator (Ontario) bottom-right, scale bar.
- **Colour:** red/blue national colours + grey basemap.
- **Text block:** only "Source: United States Geological Survey (Graeme Bruce/CBC)" — no description.

### 2.10 Border Status of Russia, Georgia and South Ossetia (8VHD9) — most reused (40)

- **Type:** `vis-locator-map` on a terrain/hillshade basemap.
- **Encoding:** Georgia 1991 borders = orange outline + cream fill; South Ossetia = hatched orange;
  North Ossetia = solid purple; Abkhazia = grey hatch. Region names in letter-spaced small caps;
  capitals with square markers, cities with dots. Scale bar + north arrow.
- **Legend:** 4-item swatch legend under the map (wraps to two rows at 751 px).
- **Text:** no description, no source line except "Created with Datawrapper".

### 2.11 My version of John Snow's Cholera Map (lzM1c)

- **Type:** `vis-locator-map`, greyscale street basemap.
- **Encoding:** 8 numbered black circle markers (pumps) + translucent red circles whose radius = distance
  containing the nearest 50 deaths; opacity decreases with radius. Three callout texts ("50 people living
  within **39 meters** of Pump No.1 died").
- **Legend:** custom two-item legend row above the map (numbered marker sample + red square).
- **Text:** long description paragraph; "Map: … Source: … digitised by Robin Wilson • Created with Datawrapper".

### 2.12 Top occupations hiring due to industry activity in 2026-2035 (DUKU7) — CBC table

- **Type:** `vis-tables`, 22 rows paginated 11 per page, search box top-left, "Page 1 of 2" pager top-right.
- **Design:** zebra rows; first column left-aligned; numeric columns right-aligned, bold; a vertical rule
  separates text from numbers; positive percentages in green ("+14%"); column headers small grey, wrapped.
- **A11y:** hidden caption "Table with 3 columns and 22 rows of data. Currently displaying rows 1 to 11.
  (column headers with buttons are sortable)".

### 2.13 Less work for ATMs, while payment terminals get busy (hio0J)

- **Type:** `vis-multiple-columns`, two stacked panels with independent y scales.
- **Colour:** one hue per panel (amber, dark green); panel titles coloured to match.
- **Annotations:** green in-chart text "…while each payment terminal did over three times the amount of
  transactions." placed in the empty upper-left of panel 2; a first-panel annotation exists in the DOM
  ("In 2024, each ATM performed only a fifth…") but is not visible at 751 px **[unverified where it shows]**.
- **Axes:** x ticks "2005, '10, '15, '20, '24" (abbreviated years), y ticks with K suffix on every tick.
- **Tooltip:** crosshair across both panels; hovered column darkens; the value replaces the panel title
  ("91.2K", "7K") and the hovered year ("2008") is added to the x axis in bold.

### 2.14 Women live longer than men. By how much varies by country. (Efxsw)

- **Type:** `vis-d3-scatter-plot` used as two beeswarms (Men / Women).
- **Colour:** 6 continent colours; legend row of dots at the top.
- **Reference:** dashed vertical line with text "Global average: 73.8 years".
- **Labels:** selective — only extremes and a few notable countries are labelled.
- **Tooltip:** full sentences: "Monaco — The life expectancy for men in Monaco is 84.56 years. For women…
  men are on average expected to live 4.07 years shorter than women."

### 2.15 Growing GDP does not guarantee a better life (0fg8I)

- Connected scatter built from `vis-d3-scatter-plot`: segments coloured by direction (blue = satisfaction
  down, green = up, pink = COVID), start/end years labelled bold, "▼ Time follows the line" hint,
  axis titles inside the plot, only 3 y ticks.

### 2.16 Number of days per year with no true night (79ioH) — most reused on page 2 (54)

- `vis-locator-map` in orthographic projection with a raster overlay; title and description contain
  highlighted words (dark chip "true night", yellow chip "Brighter colors") acting as an inline legend;
  a link-style "🗺️ Switch to Mercator projection" toggle; city labels with values ("Tromsø 174 days");
  dotted latitude circles labelled along the curve.

---

## 3) Responsive observations (viewport emulation via `resize_window`)

| Example                             | 380 px                                                                                                                                                                                                                                             | 600 px                                                 | 751 / 900 px                                                     | What changed                                                                                         |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Line chart — bikes (t8R9d)          | x ticks thinned to 2018/2020/2022/2024; series dots removed; annotations re-wrapped into narrow columns but all four kept; an EXTRA peak label "+186%" appears (mobile-only label); plot becomes taller relative to width                          | all 9 year ticks; annotations wider; dots visible      | fixed height 712 px at both 751 and 900; identical layout, wider | Tick thinning; per-breakpoint annotation visibility; height fixed above ~600, taller aspect on phone |
| Column chart — ATMs (hio0J)         | y ticks thinned to 0/60K/120K; both text annotations DROPPED; panels shorter; x ticks kept                                                                                                                                                         | —                                                      | full                                                             | Annotations hidden on mobile; tick thinning                                                          |
| Bar chart — car weights (XOA9o)     | category labels stay left, bars compress, all value labels kept, "Average weight" wraps to 2 lines, x ticks still 4                                                                                                                                | —                                                      | full                                                             | Nothing removed; bar charts scale gracefully                                                         |
| Small multiples — memory (yea0R)    | 2×2 grid → 1 column, each panel full width, same per-panel y axis on right                                                                                                                                                                         | —                                                      | 2×2                                                              | Grid reflow                                                                                          |
| Choropleth — Europe cooling (dwEtR) | map keeps aspect, shrinks; all 6 annotations + leader lines kept; legend swatch bar full width; zoom buttons kept                                                                                                                                  | same, description wraps to 2 lines; tooltip still fits | full                                                             | Nothing hidden; aspect preserved                                                                     |
| Choropleth — happy planet (xGHZa)   | gradient legend stretches to full width; medal annotation kept; map small                                                                                                                                                                          | —                                                      | full                                                             | Legend stretches                                                                                     |
| Locator — Lake Ontario (Ahkwm)      | aspect preserved → map only ~150 px tall; "Hamilton" label dropped; scale bar recomputed to 50 km; inset overlaps data                                                                                                                             | —                                                      | full                                                             | Labels culled; small maps become hard to read (weak point)                                           |
| Locator — AI alliances (ZsXPh)      | legend 3 columns → 3 stacked rows; description paragraph very long                                                                                                                                                                                 | —                                                      | 3-col legend                                                     | Legend reflow                                                                                        |
| Scatter — student loans (gOCpU)     | x ticks 10M/100M/1B only; ~10 direct labels dropped by collision detection (Bulgaria, Spain, Slovakia, Ireland, Latvia, India…); bubbles rescaled                                                                                                  | —                                                      | all labels                                                       | Label culling + tick thinning                                                                        |
| Beeswarm — life expectancy (Efxsw)  | text annotation "Global average: 73.8 years" becomes a numbered marker ① on the line with a **numbered key "① Global average: 73.8 years" under the chart**; legend wraps to 2 rows; "Chad" label clipped at left edge; Monaco label clipped right | —                                                      | annotation inline                                                | Annotation → numbered key on mobile                                                                  |
| Table — CBC occupations (DUKU7)     | no columns hidden; text column wraps to 2–3 lines; numeric columns keep width; search + pager stay; column headers wrap                                                                                                                            | same, less wrapping                                    | full                                                             | Tables wrap, never hide columns                                                                      |
| Heatmap table — shots (V5Bwb)       | cells shrink proportionally (square-ish), legend bar constant width, notes wrap                                                                                                                                                                    | —                                                      | full                                                             | Fluid cells                                                                                          |

General: every chart is `vis-height-fixed` — the height is authored per chart (and can differ for
mobile), it does not scale with width above ~600 px. Title, description and footer are plain HTML and
simply wrap. Font sizes do not change between breakpoints.

---

## 4) Cross-cutting patterns — what the best examples all do

1. **Title states the finding**, not the metric ("Women live longer than men. By how much varies by
   country.", "Number of all bikes sold… matched low 2017 levels, but revenue doubled…"). The metric
   definition goes to the subtitle/description ("Life expectancy per country, as of 2024").
2. **Description is a real paragraph** with bold/highlighted key phrases; some embed inline colour chips
   ("short-term RAM") that replace the legend.
3. **Annotations do the explaining**: numbered ①–④ text blocks in reading order, range highlights
   (Covid-19), dashed reference lines (global average, UK rate), callouts with leader lines on maps,
   big in-chart headline numbers ("+217%"). Annotation text is coloured like the series it talks about.
4. **Direct labelling over legends**: end/point labels, values on bars/areas ("Canada: 10,049 km²"),
   axis titles inside the plot area, labels culled automatically at narrow widths. Legends appear only
   for categorical colour (continents, alliances) and are simple dot/swatch rows.
5. **Restrained colour**: one hue per panel, or one highlight vs grey (split bars, Brazil bar), or a
   single sequential ramp. Grey for context (non-data regions, other lines on hover).
6. **Quiet axes**: thin light gridlines, no axis lines except a darker zero baseline, unit suffix on the
   first/last tick only ("80%", "$180", "+200%"), abbreviated years ('10, '15), 3–5 y ticks.
7. **Hover = focus, not just a box**: hovered line stays, others fade; hovered column darkens and the
   value replaces the panel title; crosshair syncs across small multiples; the legend gradient shows a
   marker for the hovered value. Tooltip content is templated (rank, sentences, mini tables, emoji).
8. **Consistent footer**: italic notes/method line → "Chart|Map|Table: Author • Source: Name (linked) •
   Get the data • Embed • Download image". Always present; byline distinguishes chart/map/table.
9. **Fixed, authored height**; content reflows inside it. Small multiples collapse to one column.
10. **Custom HTML where it matters**: emoji, flags, hatch patterns, inline chips, projection toggle links,
    social buttons from the organisation theme.

---

## 5) Ideas for `@elabs-ai/components-charts` (derived from the above)

- **ChartFrame text block**: `title` (finding), `description` (rich inline — allow `<b>` and a
  `<Chip color>` inline legend element), `notes` (italic), `byline` ("Chart: …"), `source` with link,
  optional "Get the data" / download actions. Render byline prefix by kind (Chart / Map / Table).
- **Annotation primitives for AutoChart/ChartSpec**: `text` (x/y anchored, series-coloured, with
  optional number badge), `rangeHighlight` (x1–x2 grey band with italic label), `referenceLine`
  (dashed, labelled), `valueLabel` at peaks/ends, `leaderLine` callouts on maps.
- **Responsive annotation policy**: per-annotation `showAt: ['desktop','mobile']`, plus automatic
  fallback: at < 480 px convert text annotations into numbered markers with a numbered key under the
  chart (Efxsw behaviour); allow mobile-only extra labels (bikes "+186%").
- **Tick thinning + unit-once rule**: at narrow widths reduce to ~3 y ticks and every-other x tick;
  render the unit on the last/first tick only; abbreviated years; darker zero baseline.
- **Direct-label engine with collision culling** (scatter/line end labels), prioritised by an explicit
  `labelPriority` so the important ones survive at 380 px.
- **Hover model**: `focusSeries` (dim others to ~15 %), value-in-title mode for column panels,
  synchronized crosshair for small multiples, templated tooltip (`{rank}`, sentences, key/value table).
- **Small multiples** component (MetricGrid-like) with independent y scales, right-side y axis, shared
  hover, big "delta" figure inside each panel, and 1-column reflow at < 480 px.
- **Colour tokens**: one `highlight` + `muted` grey pair per chart, series-coloured annotation text,
  sequential/diverging ramps with unlabelled ends ("few → many") as an option.
- **Range bar** mark (light 90 % / dark 50 % / tick average) and split-bars (per-column scale) presets.
- **Table (data package)**: heatmap cell mode with hidden header, wrap-not-hide columns, right-aligned
  bold numerics, signed-percent colouring, search + pagination, hidden a11y caption.
- **Maps**: choropleth with unlabelled swatch legend + hover marker; locator map layers (hatched fills,
  inset, scale bar); avoid the Lake Ontario failure by allowing a taller mobile aspect ratio.
- **Fixed-height contract**: `height` and `mobileHeight` props on ChartFrame; reflow inside instead of
  scaling with width.
