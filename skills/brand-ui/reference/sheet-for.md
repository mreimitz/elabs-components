# Sheet for (RM-086)

A `DashboardSpec` (`@elabs-ai/components-charts/dashboard`) is a JSON object an agent emits
the way it emits a `ChartSpec`. This reference is the procedure for emitting a good one:
decide the reader’s questions first, map each question to a tile, then let `autoLayout`
place the tiles instead of guessing `x/y/w/h`.

Tooling:

- `brand-ui dashboard-spec schema` prints the JSON Schema (draft 2020-12) — shape only.
- `brand-ui dashboard-spec validate <file>` runs the schema AND `validateDashboardSpec`
  (ids, refs, overlaps, `visibleWhen` grammar); exit 1 with the error list.
- `brand-ui dashboard-spec kinds` lists the nine built-in tile kinds with sizes.
- `brand-ui dashboard-spec layout <file> [--strategy by-kind|reading-order]` fills in
  every missing `layout` and prints the spec.

## Question → tile

| The reader asks             | Tile                                   | Size (24 columns)        |
| --------------------------- | -------------------------------------- | ------------------------ |
| “How are we doing?”         | 3–5 `metric` tiles, top row            | 4×2 each                 |
| “What is the trend?”        | `chart` line/area                      | 12×6 (12×4 reads wide)   |
| “How do the parts compare?” | `chart` bar (horizontal for rankings)  | 12×6                     |
| “Which records?”            | host `table` kind, full width, bottom  | 24×6                     |
| “Let me narrow it”          | `filter`/`variable` tiles, left column | 4 wide                   |
| “What am I looking at?”     | `heading` band, or a `text` note       | full width where it sits |

Pick the chart type by the data’s shape first (`chart-selection.md`,
`brand-ui chart-for "<data shape>"`), never by the question alone.

## Size rules

- At most **12 tiles** on a sheet; more is a second sheet (the surface warns in development).
- At most 6 charts per sheet, no repeated silhouette.
- Every kind has a `defaultSize` and a `minSize`; never emit a tile below its `minSize`.
- `fit` grids (default, 24×12) scale to the viewport and never overlap; set
  `extendable: true` when the content may need more rows. `flow` grids (fixed
  `rowHeight`) scroll and compact.
- Titles state the conclusion (“EMEA overtook APAC in Q3”), not the topic.

## Auto-layout rules

Emit tiles **without** `layout` and run `autoLayout` (or `brand-ui dashboard-spec layout`):

- `by-kind` (default): metrics fill the top rows at 4×2 (six across); filters and
  variables stack in a 4-wide left column under them; headings and text notes are
  full-width bands where they appear in reading order; charts go two across at 12×6
  (three across at 8×4 when there are more than four; 12×4 for line, area and horizontal
  bar); a kind whose default width spans the grid (a table) goes full width at the bottom.
  Everything else uses its kind’s default size. Sizes scale with `grid.columns`.
- `reading-order`: every tile in order at its default size, row by row.
- Tiles that already have a `layout` stay where they are; the rest route around them.
- An `extendable` fit grid gains rows until everything fits.

## Conditions and interactions

- `visibleWhen` shows a tile only when a condition holds, e.g.
  `variables.showDetail && selection.count('Region') > 0`. The same grammar drives the
  sheet’s `showCondition`.
- `emits.selection` names the fields a tile publishes; `consumes.selection: true` listens to
  every field. `interactions` routes it: `{ "from": "<tile id>", "to": "*", "effect":
"filter" }`; `highlight` keeps context instead of filtering; `{ "drill": { "sheetId",
"carry" } }` opens another sheet carrying the selected fields.
- Bookmarks store a selection and variable values the reader can return to.

## Example specs

Copy one, change the data, validate. Each validates with the schema and
`validateDashboardSpec`.

### 1. KPI overview (positions given)

```json dashboard-spec
{
  "version": 1,
  "id": "revenue-overview",
  "title": "Revenue grew 12 % while margin held",
  "grid": { "mode": "fit", "columns": 24, "rows": 12 },
  "tiles": [
    {
      "id": "revenue",
      "kind": "metric",
      "layout": { "x": 0, "y": 0, "w": 4, "h": 2 },
      "content": { "label": "Revenue", "value": 1200000, "delta": "+12 %", "deltaDirection": "up" }
    },
    {
      "id": "margin",
      "kind": "metric",
      "layout": { "x": 4, "y": 0, "w": 4, "h": 2 },
      "content": { "label": "Margin", "value": "31 %" }
    },
    {
      "id": "deals",
      "kind": "metric",
      "layout": { "x": 8, "y": 0, "w": 4, "h": 2 },
      "content": { "label": "Deals", "value": 412 }
    },
    {
      "id": "trend",
      "kind": "chart",
      "title": "Revenue climbed every quarter",
      "layout": { "x": 0, "y": 2, "w": 12, "h": 6 },
      "content": {
        "type": "line",
        "data": [
          { "quarter": "Q1", "revenue": 10 },
          { "quarter": "Q2", "revenue": 14 }
        ],
        "x": "quarter",
        "series": ["revenue"]
      }
    },
    {
      "id": "regions",
      "kind": "chart",
      "title": "EMEA leads",
      "layout": { "x": 12, "y": 2, "w": 12, "h": 6 },
      "emits": { "selection": ["region"] },
      "content": {
        "type": "bar",
        "orientation": "horizontal",
        "data": [
          { "region": "EMEA", "revenue": 9 },
          { "region": "APAC", "revenue": 7 }
        ],
        "x": "region",
        "series": ["revenue"]
      }
    }
  ],
  "interactions": [{ "from": "regions", "to": "*", "effect": "filter" }]
}
```

### 2. Filterable explorer (positionless — run `layout` first)

```json dashboard-spec
{
  "version": 1,
  "id": "pipeline-explorer",
  "title": "Pipeline slowed in the proposal stage",
  "grid": { "mode": "fit", "columns": 24, "rows": 12, "extendable": true },
  "filters": [{ "id": "region-filter", "field": "region", "kind": "multi" }],
  "variables": [{ "name": "showDetail", "type": "boolean", "default": false }],
  "tiles": [
    {
      "id": "region",
      "kind": "filter",
      "layout": { "x": 0, "y": 0, "w": 4, "h": 6 },
      "content": { "field": "region" }
    },
    {
      "id": "stages",
      "kind": "chart",
      "title": "Proposal is the bottleneck",
      "layout": { "x": 4, "y": 0, "w": 10, "h": 6 },
      "consumes": { "selection": true },
      "content": {
        "type": "funnel",
        "data": [
          { "stage": "Lead", "count": 120 },
          { "stage": "Proposal", "count": 40 }
        ],
        "x": "stage",
        "series": ["count"]
      }
    },
    {
      "id": "note",
      "kind": "text",
      "layout": { "x": 14, "y": 0, "w": 10, "h": 3 },
      "visibleWhen": "variables.showDetail",
      "content": { "body": "Counts are open opportunities." }
    }
  ]
}
```

### 3. Operations wall (flow grid, heading bands)

```json dashboard-spec
{
  "version": 1,
  "id": "ops-wall",
  "title": "Latency is back under target",
  "grid": { "mode": "flow", "columns": 24, "rowHeight": 30 },
  "tiles": [
    {
      "id": "services",
      "kind": "heading",
      "layout": { "x": 0, "y": 0, "w": 24, "h": 1 },
      "content": { "text": "Services", "level": 2 }
    },
    {
      "id": "latency",
      "kind": "chart",
      "title": "p95 latency fell below 200 ms",
      "layout": { "x": 0, "y": 1, "w": 12, "h": 4 },
      "content": {
        "type": "area",
        "data": [
          { "t": "09:00", "ms": 240 },
          { "t": "10:00", "ms": 180 }
        ],
        "x": "t",
        "xType": "category",
        "series": ["ms"]
      }
    },
    {
      "id": "errors",
      "kind": "chart",
      "title": "Errors flat",
      "layout": { "x": 12, "y": 1, "w": 12, "h": 4 },
      "content": {
        "type": "line",
        "data": [
          { "t": "09:00", "errors": 3 },
          { "t": "10:00", "errors": 3 }
        ],
        "x": "t",
        "series": ["errors"]
      }
    }
  ]
}
```
