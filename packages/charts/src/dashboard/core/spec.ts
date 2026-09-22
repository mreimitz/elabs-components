/**
 * spec.ts — the serializable `DashboardSpec` (analysis §5.1, R1–R3, R9, R11, R25, R31).
 *
 * Pure data types, no functions, no React: the same promise `auto-chart/chart-spec.ts`
 * makes. The shape is what an LLM tool-call emits, what a host persists and what the
 * JSON Schema (RM-086) is generated from — so every field is plain JSON (no `Date`, no
 * `Map`, no functions). `validateDashboardSpec` (`./validate`) is the runtime companion.
 */

/** The only spec version this build reads. Bump it with a migration, never silently. */
export type DashboardSpecVersion = 1;

/**
 * The grid a sheet lays its tiles on — Qlik's model and Grafana's model in one union (R3).
 *
 * - `fit`: `columns × rows` cells scale to fill the container; nothing compacts; a move
 *   that would overlap is pushed (when there is room) or rejected. `extendable` adds rows
 *   in 50 % steps and the sheet scrolls.
 * - `flow`: `columns` wide, each row `rowHeight` px tall, tiles fall upward after every
 *   change (vertical compaction) and the page scrolls.
 */
export interface GridSpec {
  /** `fit` (scale to the viewport, Qlik) or `flow` (fixed row height, compacts, Grafana). Default `fit`. */
  mode: "fit" | "flow";
  /** Number of columns. Default 24. */
  columns: number;
  /** `fit` only: number of rows the viewport is divided into. Default 12. */
  rows?: number;
  /** `flow` only: height of one row in px. Default 30. */
  rowHeight?: number;
  /** Gap between cells in px. Default 8 — the renderer resolves it to `--spacing`. */
  gap?: number;
  /** Preset resolving to `columns × rows`: `wide` 24×12, `medium` 48×24, `narrow` 72×36. */
  density?: "narrow" | "medium" | "wide" | "custom";
  /** `fit` only: allow adding rows (in 50 % steps of the original `rows`) when the sheet is full. */
  extendable?: boolean;
  /**
   * How many times `extendRows` has grown this grid. Tracked so each step adds 50 % of
   * the ORIGINAL rows, not of the already-extended count. Written by the engine, not authors.
   */
  extensions?: number;
}

/** Where one tile sits on the grid, in cell units (never pixels). */
export interface TileLayout {
  /** The tile's id — matches `TileSpec.id`. */
  id: string;
  /** Left column, 0-based. */
  x: number;
  /** Top row, 0-based. */
  y: number;
  /** Width in columns, ≥ 1. */
  w: number;
  /** Height in rows, ≥ 1. */
  h: number;
  /** Smallest width a resize may reach. */
  minW?: number;
  /** Smallest height a resize may reach. */
  minH?: number;
  /** Largest width a resize may reach. */
  maxW?: number;
  /** Largest height a resize may reach. */
  maxH?: number;
  /** Width ÷ height (in cells) a resize keeps, e.g. `2` for a 2:1 tile. */
  aspect?: number;
  /** Stacking order hint for overlapping chrome (never for overlapping tiles). */
  z?: number;
  /**
   * A locked tile: the edit layer never moves or resizes it, a push never relocates it, and a
   * move that would overlap it is rejected. Authors lock a header row or a filter rail.
   */
  static?: boolean;
}

/**
 * One tile on the sheet (R2). `content` is opaque to the surface and typed by `kind`
 * (a `ChartSpec` for `chart`).
 */
export interface TileSpec<TContent = unknown> {
  /** Unique across tiles, containers and library entries. `normalizeDashboardSpec` assigns `tile-<n>` when missing. */
  id: string;
  /** Which tile renderer draws this (`chart`, `kpi`, `text`, …). Unknown kinds warn; the renderer decides. */
  kind: string;
  /** Position and size in cells. */
  layout: Omit<TileLayout, "id">;
  /** A `LibraryTileSpec.id` this tile instantiates (R25); its `content` is taken from the library. */
  ref?: string;
  /** Write the title as the conclusion ("EMEA overtook APAC in Q3"), not the topic ("Revenue by region"). */
  title?: string;
  /** One line of context under the title: the unit, the period, the population. */
  subtitle?: string;
  /** Caveats and definitions the reader needs to trust the number. */
  footnote?: string;
  /** Where the data comes from, as the reader would name it. */
  source?: string;
  /** Kind-specific payload, e.g. a `ChartSpec`. */
  content: TContent;
  /** Show the tile only when this condition holds (R31), e.g. `variables.showDetail && selection.count('Region') > 0`. */
  visibleWhen?: string;
  /** What shared state this tile listens to. */
  consumes?: { selection?: string[] | true; hover?: boolean; variables?: string[] };
  /** What shared state this tile publishes. */
  emits?: { selection?: string[]; hover?: boolean };
  /** The container this tile lives in, and the tab/slot within it. */
  container?: { id: string; slot?: string };
}

/** A container tile hosting other tiles (R11). One level only: a container never holds a container. */
export interface ContainerSpec {
  /** Unique across tiles, containers and library entries. */
  id: string;
  /** `tabs` shows one child at a time; `stack` shows them one under another. */
  kind: "tabs" | "stack";
  /** Position and size in cells on the sheet grid. */
  layout: Omit<TileLayout, "id">;
  /** Write the title as the conclusion, as for a tile. */
  title?: string;
  /** Child tile ids, in display order. */
  children: string[];
}

/** A reusable tile definition tiles point at through `ref` (R25). */
export interface LibraryTileSpec<TContent = unknown> {
  /** Unique across tiles, containers and library entries. */
  id: string;
  /** Tile kind, as for `TileSpec.kind`. */
  kind: string;
  /** Name the asset panel shows. */
  label: string;
  /** Default title for tiles instantiated from this entry. */
  title?: string;
  /** Kind-specific payload shared by every instance. */
  content: TContent;
}

/** An author-defined filter field shown in the selection bar. */
export interface FilterSpec {
  /** Unique among filters. */
  id: string;
  /** The data field the filter selects on. */
  field: string;
  /** Label the reader sees; defaults to `field`. */
  label?: string;
  /** Pick one value, many values, or a range. */
  kind?: "single" | "multi" | "range";
  /** Values selected when the sheet opens. */
  default?: Array<string | number>;
}

/** A value a variable may hold. Dates are ISO-8601 strings so the spec stays JSON. */
export type VariableValue = string | number | boolean;

/** A named, author-defined input (a toggle, a threshold, a period) expressions can read. */
export interface VariableSpec {
  /** Unique among variables; read in expressions as `variables.<name>`. */
  name: string;
  /** Value type. `date` values are ISO-8601 strings. */
  type: "string" | "number" | "boolean" | "date";
  /** Value when the sheet opens. */
  default: VariableValue;
  /** Label the reader sees; defaults to `name`. */
  label?: string;
  /** Allowed values, when the variable is a choice. */
  options?: VariableValue[];
}

/** How a selection or hover in one tile affects others. */
export interface InteractionSpec {
  /** Source tile id. */
  from: string;
  /** Target tile id, or `*` for every tile. */
  to: string | "*";
  /** Filter, highlight, nothing, or drill to another sheet carrying some fields. */
  effect: "filter" | "highlight" | "none" | { drill: { sheetId: string; carry?: string[] } };
}

/** A saved selection + variable state the reader can return to. */
export interface BookmarkSpec {
  /** Unique among bookmarks. */
  id: string;
  /** Write the label as what the reader will see ("Q3 EMEA churn spike"). */
  label: string;
  /** Selected values per field. */
  selection: Record<string, Array<string | number>>;
  /** Variable values to restore. */
  variables?: Record<string, VariableValue>;
  /** Sheet the bookmark opens, when it belongs to a multi-sheet workbook. */
  sheetId?: string;
}

/** Theme the sheet asks for (ADR 0031/0036). The host's `ThemeProvider` still decides. */
export interface DashboardTheme {
  /** Theme family slug, e.g. `qlik`. */
  family?: string;
  /** Light or dark scheme within the family. */
  mode?: "light" | "dark";
  /** Token overrides, `--token-name` → value. */
  overrides?: Record<string, string>;
}

/** View-level settings. */
export interface DashboardView {
  /** Mode the sheet opens in. Default `view`. */
  mode?: "view" | "edit";
  /** Presentation mode: advance every `cycleMs`. */
  presentation?: { cycleMs?: number };
  /** Host refresh interval hint in ms. */
  refreshMs?: number;
}

/**
 * A dashboard sheet (R1): a versioned, JSON-serialisable object an agent can emit the way
 * it emits a `ChartSpec`.
 */
export interface DashboardSpec {
  /** Spec version; always `1` for this build. */
  version: DashboardSpecVersion;
  /** Stable sheet id. */
  id: string;
  /** Write the title as the conclusion of the sheet, not its topic. */
  title?: string;
  /** One or two sentences on what the sheet answers and for whom. */
  description?: string;
  /** The grid tiles are laid on. */
  grid: GridSpec;
  /** The tiles, in reading order. */
  tiles: TileSpec[];
  /** Container tiles (one level). */
  containers?: ContainerSpec[];
  /** Reusable tile definitions. */
  library?: LibraryTileSpec[];
  /** Author-defined filter fields. */
  filters?: FilterSpec[];
  /** Author-defined variables. */
  variables?: VariableSpec[];
  /** Cross-tile interactions. */
  interactions?: InteractionSpec[];
  /** Saved states. */
  bookmarks?: BookmarkSpec[];
  /** View-level settings. */
  view?: DashboardView;
  /** Requested theme. */
  theme?: DashboardTheme;
  /** Hand-tuned per-breakpoint layouts (R9); absent ones fall back to `stackForNarrow`. */
  layouts?: Partial<Record<"md" | "sm", TileLayout[]>>;
  // sheet actions/showCondition — RM-080
  /** Actions run, in order, when the sheet opens — the `button` tile's action vocabulary. */
  actions?: Array<
    | { type: "navigate"; sheetId: string }
    | { type: "applyBookmark"; id: string }
    | { type: "clearSelections" }
    | { type: "setVariable"; name: string; value: VariableValue }
    | { type: "host"; id: string }
  >;
  /** Show the sheet only when this condition holds (the `visibleWhen` grammar). */
  showCondition?: string;
}

/** Codes a spec problem is reported under. */
export type DashboardSpecErrorCode =
  | "missing"
  | "type"
  | "range"
  | "duplicate-id"
  | "unknown-ref"
  | "overlap"
  | "nested-container"
  | "version"
  | "expression";

/** One problem found in a spec, addressed by a JSON-path-like `path` (`tiles[3].layout.w`). */
export interface DashboardSpecError {
  path: string;
  code: DashboardSpecErrorCode;
  message: string;
}

/** A non-fatal note from `normalizeDashboardSpec` (unknown kind, repaired overlap, clamped layout). */
export interface DashboardSpecWarning {
  path: string;
  code: "unknown-kind" | "overlap-repaired" | "clamped" | "id-assigned";
  message: string;
}

// workbook — RM-087
/**
 * A multi-sheet container (analysis §2.0, §7): the tenant's 16-sheet app with a sheet
 * navigator. `shared` is merged into every sheet's OWN spec at mount (`useWorkbook`) — a
 * sheet's own `variables`/`bookmarks`/`library` entry wins a name/id clash, so a sheet can
 * still override one shared item. Serializable, same promise as `DashboardSpec`.
 */
export interface WorkbookSpec {
  /** Spec version; always `1` for this build. */
  version: DashboardSpecVersion;
  /** Stable workbook id. */
  id: string;
  /** Write the title as the conclusion, as for a sheet. */
  title?: string;
  /** The sheets, in nav order. */
  sheets: DashboardSpec[];
  /** State merged into every sheet at mount; a sheet's own entry wins a clash. */
  shared?: {
    variables?: VariableSpec[];
    bookmarks?: BookmarkSpec[];
    library?: LibraryTileSpec[];
  };
}
