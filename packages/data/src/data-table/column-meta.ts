import type { CSSProperties } from "react";
import type { CellData, RowData, TableFeatures } from "@tanstack/react-table";
import type { ColorScaleDomain } from "@elabs-ai/components-ui";
import type { DataTableBreakpoint } from "./use-table-breakpoint";

/**
 * column-meta.ts — the typed `columnDef.meta` contract `DataTable` reads.
 *
 * `numeric` / `align` (#69) style a column; everything else is the editorial
 * presentation layer (RM-123): an in-cell visual, a number format, categorical
 * colouring, per-breakpoint visibility and column sizing. Every key is optional
 * and a column without them renders exactly as before.
 *
 * `data` never imports `@elabs-ai/components-charts` (one-way dependency
 * graph), so the number-format shape below is a STRUCTURAL twin of charts'
 * `ChartValueFormatSpec` (RM-109): a spec written for a chart type-checks here
 * unchanged, and formats the same way.
 */

/**
 * A number format — the same object shape as charts' `ChartValueFormatSpec`.
 *
 * - `style`: `"number"` (default), `"currency"`, or `"percent"` (fraction in,
 *   `%` out).
 * - `decimals`: maximum fraction digits. `optionalDecimals: false` makes it
 *   the minimum too.
 * - `abbreviate`: `true` always compact (`1.5K`), `false` never, `"auto"`
 *   (default) from 1,000 up. Percent is never compacted.
 * - `sign`: `"auto"` (minus only), `"always"` (`+`/`-`), `"parens"` (`(12)`).
 * - `prefix` / `suffix`: literal text around the number.
 * - `grouping: false` drops the thousands separator.
 * - `currency`: ISO 4217 code for `style: "currency"` (default `"USD"`).
 */
export interface DataTableValueFormatSpec {
  style?: "number" | "currency" | "percent";
  decimals?: number;
  optionalDecimals?: boolean;
  abbreviate?: boolean | "auto";
  sign?: "auto" | "always" | "parens";
  prefix?: string;
  suffix?: string;
  grouping?: boolean;
  currency?: string;
}

/** An in-cell bar: the value as a horizontal bar from zero. */
export interface DataTableBarVisual {
  kind: "bar";
  /** `"regular"` (default) sits beside the value; `"slim"` is a thin rule under it. */
  style?: "regular" | "slim";
  /** Paint the grey remainder of the range behind the bar. */
  track?: boolean;
  /**
   * The range a full-width bar spans. `"column"` (default): this column's own
   * min / max; `"table"`: shared by every bar column with `range: "table"`;
   * `[min, max]`: fixed. Zero is always inside the range.
   */
  range?: readonly [min: number, max: number] | "column" | "table";
  /** Row key whose category picks the bar colour (`--chart-1…12`). */
  colorBy?: string;
  /**
   * The `colorBy` key's title, or `false` to draw no key. Default `true`: a
   * category carried by hue alone is unreadable without one (WCAG 1.4.1), so
   * the key is opt-OUT — turn it off only when the table prints the category
   * in a column of its own.
   */
  legend?: string | boolean;
  /** Paint negative values in the negative token. Default `true`. */
  negative?: boolean;
}

/** An in-cell sparkline across several numeric row keys (one point per key). */
export interface DataTableSparklineVisual {
  kind: "sparkline";
  /** Row keys, in x order. */
  keys: readonly string[];
  /** Fill the area under the line. */
  fill?: boolean;
  /** `"ends"` prints the first and last values beside the line. Default `"none"`. */
  labels?: "ends" | "none";
  /** Drawing height in px. Default 24. */
  height?: number;
  /** `"cell"` (default): this row's own min / max; `"column"`: shared by every row. */
  range?: "cell" | "column";
}

/** In-cell mini columns across several numeric row keys. */
export interface DataTableColumnsVisual {
  kind: "columns";
  keys: readonly string[];
  /** Drawing height in px. Default 24. */
  height?: number;
  /** `"cell"` (default): this row's own max; `"column"`: shared by every row. */
  range?: "cell" | "column";
}

/**
 * A heatmap colour scale. Resolved by `colorScaleFor` (`@elabs-ai/components-ui`),
 * so the colours are `--chart-seq-*` / `--chart-div-*` ramp tokens.
 */
export interface DataTableHeatmapScale {
  /** `"stepped"` cuts countable classes; `"continuous"` snaps to the nearest ramp step. */
  type: "stepped" | "continuous";
  /** How many classes (stepped) or Jenks classes (continuous `jenks`). Default 5. */
  steps?: number;
  /**
   * `"linear"` (default) equal widths; `"quantile"` equal counts; `"jenks"`
   * natural breaks; `"custom"` the `breaks` you pass (always stepped).
   */
  method?: "linear" | "quantile" | "jenks" | "custom";
  /** `method: "custom"` only: the inner thresholds, ascending. */
  breaks?: readonly number[];
  /** `[min, max]`, or `[min, center, max]` to pin the ramp's middle colour. */
  domain?: ColorScaleDomain;
  /** Default `"diverging"` when `domain` has a centre, else `"sequential"`. */
  palette?: "sequential" | "diverging";
}

/** The cell's background is the value's ramp colour. */
export interface DataTableHeatmapVisual {
  kind: "heatmap";
  scale: DataTableHeatmapScale;
  /** Hide the printed value visually; screen readers, sorting and copy still read it. */
  hideValue?: boolean;
  /**
   * Print the scale's colour key above the table. `true` titles it with the
   * column header; a string is the title (use it when one heatmap spans several
   * columns — the key is printed once per shared scale).
   */
  legend?: boolean | string;
}

export type DataTableCellVisual =
  | DataTableBarVisual
  | DataTableSparklineVisual
  | DataTableColumnsVisual
  | DataTableHeatmapVisual;

/**
 * Categorical conditional formatting: the category in row key `key` picks a
 * `--chart-1…12` colour, painted as a background wash or as text ink, on this
 * column's cell or on the whole row.
 */
export interface DataTableColorBy {
  key: string;
  target: "background" | "text";
  /** Default `"cell"`. */
  scope?: "cell" | "row";
  /**
   * The colour key's title, or `false` to draw none. Default `true` — see
   * `DataTableBarVisual.legend`.
   */
  legend?: string | boolean;
}

/**
 * Show a column at a table breakpoint. `true` / `false` for every width, or
 * `{ base, narrow }`: `base` is the wide value, `narrow` applies below 450 px.
 */
export type DataTableShowAt = boolean | { base: boolean; narrow?: boolean };

/** `markdown: true` or options. Images are off unless `images: true`. */
export interface DataTableMarkdownOptions {
  images?: boolean;
}

/**
 * `DataTable`'s `columnDef.meta` contract, read by the header, body, card and
 * skeleton cell renderers. Set `numeric: true` on a column to get
 * `tabular-nums` + end-alignment on both the `<th>` and every `<td>`
 * (including the loading skeleton) for free.
 */
export interface DataTableColumnMeta {
  /**
   * The column's plain-text name, for every place that needs words rather
   * than the rendered header: sort-button and menu names, the column picker,
   * status text. Needed when `header` is a render function; a string `header`
   * is used as-is. Falls back to the column id.
   */
  label?: string;
  /** Numeric column: tabular figures + end alignment on header and cells. */
  numeric?: boolean;
  /**
   * Explicit alignment override for when `numeric` isn't the right cue (or
   * to align a non-numeric column). Independent of `numeric` — `numeric`
   * alone still drives `tabular-nums` even when `align` overrides the
   * alignment away from `"end"`.
   */
  align?: "start" | "center" | "end";
  /**
   * An in-cell visual (bar, sparkline, mini columns, heatmap). The cell keeps
   * its value as text — visually hidden only with `hideValue` — so sorting,
   * copy and screen readers still read the number. Replaces the column's
   * `cell` renderer.
   */
  visual?: DataTableCellVisual;
  /** Number format for the printed value (the charts `valueFormat` object shape). */
  format?: DataTableValueFormatSpec;
  /** Categorical colouring driven by another row key. */
  colorBy?: DataTableColorBy;
  /** Per-breakpoint visibility; render-only, never written to `columnVisibility`. */
  showAt?: DataTableShowAt;
  /** Column width as a percentage of the table width. */
  width?: number;
  /** Minimum column width in px. */
  minWidth?: number;
  /** Extra inline style on this column's header and body cells. */
  style?: CSSProperties;
  /** Render a string value as safe inline markdown (bold, italic, links, `sup`, `code`). */
  markdown?: boolean | DataTableMarkdownOptions;
}

declare module "@tanstack/react-table" {
  // `TFeatures`/`TData`/`TValue` must stay in the signature to match the interface being
  // augmented, even though `DataTableColumnMeta` (deliberately) doesn't use
  // them; the empty extends-body is how TanStack's own module-augmentation
  // pattern for `ColumnMeta` is documented.
  /* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-object-type */
  interface ColumnMeta<
    TFeatures extends TableFeatures,
    TData extends RowData,
    TValue extends CellData = CellData,
  > extends DataTableColumnMeta {}
  /* eslint-enable @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-object-type */
}

/** Charts' compaction threshold (`COMPACT_THRESHOLD`), mirrored. */
const COMPACT_THRESHOLD = 1000;

/**
 * The printed text for a cell value. Numbers go through `format` (or the
 * locale's plain number format); anything else is stringified; nullish is `""`.
 */
export function formatCellValue(
  value: unknown,
  format: DataTableValueFormatSpec | undefined,
  formatNumber: (n: number, opts?: Intl.NumberFormatOptions) => string,
): string {
  if (value === null || value === undefined) return "";
  if (typeof value !== "number") return String(value);
  if (!Number.isFinite(value)) return "";
  if (!format) return formatNumber(value);
  const style = format.style ?? "number";
  const options: Intl.NumberFormatOptions = {};
  if (style === "currency") {
    options.style = "currency";
    options.currency = format.currency ?? "USD";
  } else if (style === "percent") {
    options.style = "percent";
  }
  const abbreviate =
    style !== "percent" &&
    (format.abbreviate === true ||
      (format.abbreviate !== false && Math.abs(value) >= COMPACT_THRESHOLD));
  if (abbreviate) {
    options.notation = "compact";
    options.compactDisplay = "short";
  }
  const exact = style === "number" && format.abbreviate === false;
  const digits = format.decimals ?? (exact ? undefined : 1);
  if (digits !== undefined) {
    options.maximumFractionDigits = digits;
    if (format.optionalDecimals === false) options.minimumFractionDigits = digits;
  }
  if (format.grouping === false) options.useGrouping = false;
  const parens = format.sign === "parens";
  if (format.sign === "always") options.signDisplay = "always";
  if (parens) options.signDisplay = "never";
  const body = formatNumber(value, options);
  const signed = parens && value < 0 ? `(${body})` : body;
  return `${format.prefix ?? ""}${signed}${format.suffix ?? ""}`;
}

/** Whether a column is shown at `breakpoint` (no `showAt` → always). */
export function resolveShowAt(
  showAt: DataTableShowAt | undefined,
  breakpoint: DataTableBreakpoint,
): boolean {
  if (showAt === undefined) return true;
  if (typeof showAt === "boolean") return showAt;
  return breakpoint === "narrow" ? (showAt.narrow ?? showAt.base) : showAt.base;
}

/** The inline style for `meta.width` (%), `meta.minWidth` (px) and `meta.style`. */
export function columnSizeStyle(meta: DataTableColumnMeta | undefined): CSSProperties | undefined {
  if (!meta || (meta.width === undefined && meta.minWidth === undefined && !meta.style)) {
    return undefined;
  }
  return {
    ...(meta.width !== undefined ? { width: `${Math.max(0, meta.width)}%` } : null),
    ...(meta.minWidth !== undefined ? { minWidth: Math.max(0, meta.minWidth) } : null),
    ...meta.style,
  };
}

/**
 * A column's plain-text name: `meta.label`, else a string `header`, else the
 * column id — never an id when the author gave words.
 */
export function columnLabel(column: {
  id: string;
  columnDef: { header?: unknown; meta?: DataTableColumnMeta };
}): string {
  const meta = column.columnDef.meta;
  if (meta?.label) return meta.label;
  const header = column.columnDef.header;
  return typeof header === "string" && header.trim() !== "" ? header : column.id;
}
