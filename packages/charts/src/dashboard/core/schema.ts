/**
 * schema.ts — the JSON Schema (draft 2020-12) for `DashboardSpec` v1 (RM-086, analysis §4
 * R4–R5), hand-written next to the types in `./spec` and kept in sync by `schema.test.ts`
 * (the goldens validate with `ajv`; the RM-070 error fixtures are rejected at the same
 * paths `validateDashboardSpec` reports). `pnpm gen` writes it to
 * `packages/charts/schemas/dashboard-spec.v1.schema.json`.
 *
 * JSON Schema can only check SHAPE: duplicate ids, unknown refs, fit-grid overlaps,
 * nested containers and `visibleWhen` grammar stay `validateDashboardSpec`'s job — run both.
 *
 * Pure data, framework-free.
 */

import type { ChartType } from "../../auto-chart/chart-spec";
import type { ChartValueFormat } from "../../charts/value-format";

/** A JSON Schema document, as plain JSON. */
export type JsonSchema = { readonly [key: string]: unknown };

/** The schema's `$id` — versioned; a v2 spec gets a new document, never an edit of this one. */
export const DASHBOARD_SPEC_SCHEMA_ID =
  "https://github.com/mreimitz/elabs-components/packages/charts/schemas/dashboard-spec.v1.schema.json";

/** Capabilities a built-in tile kind declares (mirrors `DashboardTileCapabilities`). */
export interface BuiltInTileKindCapabilities {
  emitsSelection?: boolean;
  consumesSelection?: boolean;
  consumesHover?: boolean;
  emitsHover?: boolean;
  resizable?: boolean;
  exportable?: boolean;
  expand?: boolean;
  frame?: boolean;
}

/** Sizes and capabilities of one built-in tile kind — the framework-free mirror of its `DashboardTileKind`. */
export interface BuiltInTileKindDefaults {
  kind: string;
  label: string;
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  capabilities: BuiltInTileKindCapabilities;
}

/**
 * The nine built-in TILE kinds (`container` is a `ContainerSpec`, not a tile), in asset-panel
 * order. Mirrors `builtInTiles` (`dashboard/tiles`); `schema.test.ts` fails when they drift.
 */
export const BUILT_IN_TILE_KIND_DEFAULTS: readonly BuiltInTileKindDefaults[] = [
  {
    kind: "chart",
    label: "Chart",
    defaultSize: { w: 8, h: 4 },
    minSize: { w: 4, h: 2 },
    capabilities: {
      frame: true,
      expand: true,
      resizable: true,
      exportable: true,
      consumesSelection: true,
      emitsSelection: true,
      consumesHover: true,
      emitsHover: true,
    },
  },
  {
    kind: "metric",
    label: "Metric",
    defaultSize: { w: 4, h: 2 },
    minSize: { w: 3, h: 2 },
    capabilities: { expand: true },
  },
  {
    kind: "text",
    label: "Text",
    defaultSize: { w: 6, h: 3 },
    minSize: { w: 2, h: 1 },
    capabilities: { expand: true },
  },
  {
    kind: "heading",
    label: "Heading",
    defaultSize: { w: 6, h: 1 },
    minSize: { w: 2, h: 1 },
    capabilities: { expand: false },
  },
  {
    kind: "divider",
    label: "Divider",
    defaultSize: { w: 4, h: 1 },
    minSize: { w: 1, h: 1 },
    capabilities: { expand: false },
  },
  {
    kind: "image",
    label: "Image",
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 2, h: 2 },
    capabilities: { expand: true },
  },
  {
    kind: "button",
    label: "Button",
    defaultSize: { w: 3, h: 1 },
    minSize: { w: 2, h: 1 },
    capabilities: { expand: false },
  },
  {
    kind: "variable",
    label: "Variable",
    defaultSize: { w: 4, h: 1 },
    minSize: { w: 2, h: 1 },
    capabilities: { expand: false },
  },
  {
    kind: "filter",
    label: "Filter",
    defaultSize: { w: 4, h: 6 },
    minSize: { w: 3, h: 3 },
    capabilities: { emitsSelection: true, consumesSelection: true, expand: true },
  },
];

/** Every `ChartSpec.type` (compile-checked against `ChartType` below). */
const CHART_TYPES = [
  "line",
  "area",
  "bar",
  "pie",
  "scatter",
  "radar",
  "funnel",
  "candlestick",
  "heatmap",
  "calendar",
  "waterfall",
  "dumbbell",
  "unit",
  "treemap",
  "histogram",
  "box",
  "strip",
  "bump",
  "stream",
  "diverging-bar",
  // Dual-axis — RM-121
  "dual-axis",
] as const satisfies readonly ChartType[];
type MissingChartType = Exclude<ChartType, (typeof CHART_TYPES)[number]>;
const chartTypesComplete: MissingChartType extends never ? true : never = true;
void chartTypesComplete;

const VALUE_FORMATS = [
  "number",
  "compact",
  "currency",
  "percent",
] as const satisfies readonly ChartValueFormat[];

const str = (description: string) => ({ type: "string", description });
const bool = (description: string) => ({ type: "boolean", description });
const int = (description: string, minimum?: number) => ({
  type: "integer",
  description,
  ...(minimum === undefined ? {} : { minimum }),
});
const num = (description: string, minimum?: number) => ({
  type: "number",
  description,
  ...(minimum === undefined ? {} : { minimum }),
});
const variableValue = { type: ["string", "number", "boolean"] };
const selectionValues = { type: "array", items: { type: ["string", "number"] } };

/** JSON Schema for `ChartSpec` (`auto-chart/chart-spec.ts`) — the `chart` tile's content. */
export const CHART_SPEC_SCHEMA: JsonSchema = {
  type: "object",
  description: "The serializable chart specification emitted by an LLM tool-call (`AutoChart`).",
  required: ["data", "x", "series"],
  properties: {
    type: { enum: CHART_TYPES, description: "Chart type; inferred from the data when omitted." },
    data: { type: "array", items: { type: "object" }, description: "Row records." },
    x: str("Field used for the x axis / category."),
    xType: { enum: ["time", "category", "number"], description: "How the x field is read." },
    series: {
      type: "array",
      description: "Value fields, as keys or `{ key, label?, color? }`.",
      items: {
        oneOf: [
          { type: "string" },
          {
            type: "object",
            required: ["key"],
            properties: {
              key: { type: "string" },
              label: { type: "string" },
              color: { type: "string" },
            },
            additionalProperties: false,
          },
        ],
      },
    },
    y2: str("Field plotted on a secondary axis."),
    group: str("Field grouping records (strip/box/dumbbell)."),
    hierarchy: { type: "object", description: "Treemap root node." },
    palette: { enum: ["mono", "sequential", "categorical"], description: "Colour ramp." },
    kind: { enum: ["steps", "records", "ranking"], description: "Data shape hint." },
    emphasis: { enum: ["analytical", "editorial"], description: "Presentation register." },
    title: str("Chart title."),
    description: str("Accessible description."),
    stacked: bool("Stack the series."),
    orientation: { enum: ["vertical", "horizontal"], description: "Bar orientation." },
    donut: bool("Pie as donut."),
    legend: bool("Show the legend."),
    valueFormat: { enum: VALUE_FORMATS, description: "How values are formatted." },
    currency: str("ISO-4217 currency code for `valueFormat: currency`."),
    fields: {
      type: "object",
      properties: { category: { type: "string" }, series: { type: "string" } },
      additionalProperties: false,
    },
  },
};

/** Content schemas of the built-in kinds (loose: extra keys allowed, only required keys enforced). */
const CONTENT_SCHEMAS: Record<string, JsonSchema> = {
  chart: { $ref: "#/$defs/ChartSpec" },
  metric: {
    type: "object",
    required: ["label", "value"],
    properties: {
      label: { type: "string" },
      value: { type: ["number", "string"] },
      delta: { type: "string" },
      deltaDirection: { enum: ["up", "down", "neutral"] },
      positiveIsGood: { type: "boolean" },
      series: { type: "array", items: { type: "number" } },
    },
  },
  text: {
    type: "object",
    properties: {
      body: { type: "string" },
      markdown: { type: "string" },
      align: { enum: ["start", "center", "end"] },
    },
  },
  heading: {
    type: "object",
    required: ["text"],
    properties: { text: { type: "string" }, level: { enum: [1, 2, 3] } },
  },
  divider: { type: "object", properties: { orientation: { enum: ["horizontal", "vertical"] } } },
  image: {
    type: "object",
    required: ["src", "alt"],
    properties: {
      src: { type: "string" },
      alt: { type: "string" },
      fit: { enum: ["cover", "contain"] },
    },
  },
  button: {
    type: "object",
    required: ["label", "action"],
    properties: { label: { type: "string" }, action: { $ref: "#/$defs/Action" } },
  },
  variable: {
    type: "object",
    required: ["name", "control"],
    properties: {
      name: { type: "string" },
      control: { enum: ["select", "slider", "date"] },
      options: selectionValues,
      min: { type: "number" },
      max: { type: "number" },
      step: { type: "number" },
    },
  },
  filter: {
    type: "object",
    required: ["field"],
    properties: {
      field: { type: "string" },
      label: { type: "string" },
      mode: { enum: ["single", "multi"] },
      search: { type: "boolean" },
      showCounts: { type: "boolean" },
    },
  },
};

const layoutProperties = {
  x: num("Left column, 0-based.", 0),
  y: num("Top row, 0-based.", 0),
  w: num("Width in columns, ≥ 1.", 1),
  h: num("Height in rows, ≥ 1.", 1),
  minW: num("Smallest width a resize may reach.", 0),
  minH: num("Smallest height a resize may reach.", 0),
  maxW: num("Largest width a resize may reach.", 0),
  maxH: num("Largest height a resize may reach.", 0),
  aspect: num("Width ÷ height (in cells) a resize keeps, e.g. `2` for a 2:1 tile.", 0),
  z: num("Stacking order hint for overlapping chrome (never for overlapping tiles)."),
};

/** The JSON Schema (draft 2020-12) for `DashboardSpec` v1. */
export const DASHBOARD_SPEC_SCHEMA: JsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: DASHBOARD_SPEC_SCHEMA_ID,
  title: "DashboardSpec",
  description:
    "A dashboard sheet (R1): a versioned, JSON-serialisable object an agent can emit the way it emits a `ChartSpec`. Shape only — also run `validateDashboardSpec` (ids, refs, overlaps, expressions).",
  type: "object",
  required: ["version", "id", "grid", "tiles"],
  additionalProperties: false,
  "x-brand-ui-kind-defaults": Object.fromEntries(
    BUILT_IN_TILE_KIND_DEFAULTS.map(({ kind, defaultSize, minSize }) => [
      kind,
      { defaultSize, minSize },
    ]),
  ),
  properties: {
    version: { const: 1, description: "Spec version; always `1` for this build." },
    id: str("Stable sheet id."),
    title: str("Write the title as the conclusion of the sheet, not its topic."),
    description: str("One or two sentences on what the sheet answers and for whom."),
    grid: { $ref: "#/$defs/GridSpec" },
    tiles: {
      type: "array",
      items: { $ref: "#/$defs/TileSpec" },
      description: "The tiles, in reading order.",
    },
    containers: {
      type: "array",
      items: { $ref: "#/$defs/ContainerSpec" },
      description: "Container tiles (one level).",
    },
    library: {
      type: "array",
      items: { $ref: "#/$defs/LibraryTileSpec" },
      description: "Reusable tile definitions.",
    },
    filters: {
      type: "array",
      items: { $ref: "#/$defs/FilterSpec" },
      description: "Author-defined filter fields.",
    },
    variables: {
      type: "array",
      items: { $ref: "#/$defs/VariableSpec" },
      description: "Author-defined variables.",
    },
    interactions: {
      type: "array",
      items: { $ref: "#/$defs/InteractionSpec" },
      description: "Cross-tile interactions.",
    },
    bookmarks: {
      type: "array",
      items: { $ref: "#/$defs/BookmarkSpec" },
      description: "Saved states.",
    },
    view: {
      type: "object",
      description: "View-level settings.",
      properties: {
        mode: { enum: ["view", "edit"], description: "Mode the sheet opens in. Default `view`." },
        presentation: {
          type: "object",
          description: "Presentation mode: advance every `cycleMs`.",
          properties: { cycleMs: { type: "number", minimum: 0 } },
        },
        refreshMs: num("Host refresh interval hint in ms.", 0),
      },
    },
    theme: {
      type: "object",
      description:
        "Theme the sheet asks for (ADR 0031/0036). The host's `ThemeProvider` still decides.",
      properties: {
        family: str("Theme family slug, e.g. `qlik`."),
        mode: { enum: ["light", "dark"], description: "Light or dark scheme within the family." },
        overrides: {
          type: "object",
          additionalProperties: { type: "string" },
          description: "Token overrides, `--token-name` → value.",
        },
      },
    },
    layouts: {
      type: "object",
      description:
        "Hand-tuned per-breakpoint layouts (R9); absent ones fall back to `stackForNarrow`.",
      properties: {
        md: { type: "array", items: { $ref: "#/$defs/TileLayout" } },
        sm: { type: "array", items: { $ref: "#/$defs/TileLayout" } },
      },
      additionalProperties: false,
    },
    actions: {
      type: "array",
      items: { $ref: "#/$defs/Action" },
      description:
        "Actions run, in order, when the sheet opens — the `button` tile's action vocabulary.",
    },
    showCondition: str(
      "Show the sheet only when this condition holds (the `visibleWhen` grammar).",
    ),
  },
  $defs: {
    ChartSpec: CHART_SPEC_SCHEMA,
    GridSpec: {
      type: "object",
      description:
        "The grid a sheet lays its tiles on — Qlik's `fit` model and Grafana's `flow` model in one union (R3).",
      properties: {
        mode: {
          enum: ["fit", "flow"],
          description:
            "`fit` (scale to the viewport, Qlik) or `flow` (fixed row height, compacts, Grafana). Default `fit`.",
        },
        columns: int("Number of columns. Default 24.", 1),
        rows: int("`fit` only: number of rows the viewport is divided into. Default 12.", 1),
        rowHeight: num("`flow` only: height of one row in px. Default 30.", 1),
        gap: num("Gap between cells in px. Default 8.", 0),
        density: {
          enum: ["narrow", "medium", "wide", "custom"],
          description:
            "Preset resolving to `columns × rows`: `wide` 24×12, `medium` 48×24, `narrow` 72×36.",
        },
        extendable: bool(
          "`fit` only: allow adding rows (in 50 % steps of the original `rows`) when the sheet is full.",
        ),
        extensions: int(
          "How many times `extendRows` has grown this grid. Written by the engine, not authors.",
          0,
        ),
      },
    },
    TileLayoutInCells: {
      type: "object",
      description: "Where one tile sits on the grid, in cell units (never pixels).",
      required: ["x", "y", "w", "h"],
      properties: layoutProperties,
    },
    TileLayout: {
      type: "object",
      required: ["id", "x", "y", "w", "h"],
      properties: { id: str("The tile's id — matches `TileSpec.id`."), ...layoutProperties },
    },
    TileSpec: {
      type: "object",
      description:
        "One tile on the sheet (R2). `content` is typed by `kind` (a `ChartSpec` for `chart`).",
      required: ["kind", "layout", "content"],
      properties: {
        id: str(
          "Unique across tiles, containers and library entries. `normalizeDashboardSpec` assigns `tile-<n>` when missing.",
        ),
        kind: str(
          "Which tile renderer draws this (`chart`, `metric`, `text`, …). Unknown kinds warn; the renderer decides.",
        ),
        layout: { $ref: "#/$defs/TileLayoutInCells" },
        ref: str(
          "A `LibraryTileSpec.id` this tile instantiates (R25); its `content` is taken from the library.",
        ),
        title: str(
          "Write the title as the conclusion (“EMEA overtook APAC in Q3”), not the topic (“Revenue by region”).",
        ),
        subtitle: str("One line of context under the title: the unit, the period, the population."),
        footnote: str("Caveats and definitions the reader needs to trust the number."),
        source: str("Where the data comes from, as the reader would name it."),
        content: { description: "Kind-specific payload, e.g. a `ChartSpec`." },
        visibleWhen: str("Show the tile only when this condition holds (R31)."),
        consumes: {
          type: "object",
          description: "What shared state this tile listens to.",
          properties: {
            selection: { oneOf: [{ const: true }, { type: "array", items: { type: "string" } }] },
            hover: { type: "boolean" },
            variables: { type: "array", items: { type: "string" } },
          },
        },
        emits: {
          type: "object",
          description: "What shared state this tile publishes.",
          properties: {
            selection: { type: "array", items: { type: "string" } },
            hover: { type: "boolean" },
          },
        },
        container: {
          type: "object",
          description: "The container this tile lives in, and the tab/slot within it.",
          required: ["id"],
          properties: { id: { type: "string" }, slot: { type: "string" } },
        },
      },
      allOf: Object.entries(CONTENT_SCHEMAS).map(([kind, content]) => ({
        if: { properties: { kind: { const: kind } }, required: ["kind"] },
        then: { properties: { content } },
      })),
    },
    ContainerSpec: {
      type: "object",
      description:
        "A container tile hosting other tiles (R11). One level only: a container never holds a container.",
      required: ["id", "kind", "layout", "children"],
      properties: {
        id: str("Unique across tiles, containers and library entries."),
        kind: {
          enum: ["tabs", "stack"],
          description: "`tabs` shows one child at a time; `stack` shows them one under another.",
        },
        layout: { $ref: "#/$defs/TileLayoutInCells" },
        title: str("Write the title as the conclusion, as for a tile."),
        children: {
          type: "array",
          items: { type: "string" },
          description: "Child tile ids, in display order.",
        },
      },
    },
    LibraryTileSpec: {
      type: "object",
      description: "A reusable tile definition tiles point at through `ref` (R25).",
      required: ["id", "kind", "label"],
      properties: {
        id: str("Unique across tiles, containers and library entries."),
        kind: str("Tile kind, as for `TileSpec.kind`."),
        label: str("Name the asset panel shows."),
        title: str("Default title for tiles instantiated from this entry."),
        content: { description: "Kind-specific payload shared by every instance." },
      },
    },
    FilterSpec: {
      type: "object",
      description: "An author-defined filter field shown in the selection bar.",
      required: ["id", "field"],
      properties: {
        id: str("Unique among filters."),
        field: str("The data field the filter selects on."),
        label: str("Label the reader sees; defaults to `field`."),
        kind: {
          enum: ["single", "multi", "range"],
          description: "Pick one value, many values, or a range.",
        },
        default: { ...selectionValues, description: "Values selected when the sheet opens." },
      },
    },
    VariableSpec: {
      type: "object",
      description:
        "A named, author-defined input (a toggle, a threshold, a period) expressions can read.",
      required: ["name", "type", "default"],
      properties: {
        name: str("Unique among variables; read in expressions as `variables.<name>`."),
        type: {
          enum: ["string", "number", "boolean", "date"],
          description: "Value type. `date` values are ISO-8601 strings.",
        },
        default: { ...variableValue, description: "Value when the sheet opens." },
        label: str("Label the reader sees; defaults to `name`."),
        options: {
          type: "array",
          items: variableValue,
          description: "Allowed values, when the variable is a choice.",
        },
      },
    },
    InteractionSpec: {
      type: "object",
      description: "How a selection or hover in one tile affects others.",
      required: ["from", "to"],
      properties: {
        from: str("Source tile id."),
        to: str("Target tile id, or `*` for every tile."),
        effect: {
          description:
            "Filter, highlight, nothing, or drill to another sheet carrying some fields.",
          oneOf: [
            { enum: ["filter", "highlight", "none"] },
            {
              type: "object",
              required: ["drill"],
              properties: {
                drill: {
                  type: "object",
                  required: ["sheetId"],
                  properties: {
                    sheetId: { type: "string" },
                    carry: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          ],
        },
      },
    },
    BookmarkSpec: {
      type: "object",
      description: "A saved selection + variable state the reader can return to.",
      required: ["id", "label", "selection"],
      properties: {
        id: str("Unique among bookmarks."),
        label: str("Write the label as what the reader will see (“Q3 EMEA churn spike”)."),
        selection: {
          type: "object",
          additionalProperties: selectionValues,
          description: "Selected values per field.",
        },
        variables: {
          type: "object",
          additionalProperties: variableValue,
          description: "Variable values to restore.",
        },
        sheetId: str("Sheet the bookmark opens, when it belongs to a multi-sheet workbook."),
      },
    },
    Action: {
      description: "A sheet/button action.",
      oneOf: [
        {
          type: "object",
          required: ["type", "sheetId"],
          properties: { type: { const: "navigate" }, sheetId: { type: "string" } },
        },
        {
          type: "object",
          required: ["type", "id"],
          properties: { type: { const: "applyBookmark" }, id: { type: "string" } },
        },
        { type: "object", required: ["type"], properties: { type: { const: "clearSelections" } } },
        {
          type: "object",
          required: ["type", "name", "value"],
          properties: {
            type: { const: "setVariable" },
            name: { type: "string" },
            value: variableValue,
          },
        },
        {
          type: "object",
          required: ["type", "id"],
          properties: { type: { const: "host" }, id: { type: "string" } },
        },
      ],
    },
  },
};
