/**
 * Iteration BUILDER model (A5) — the data layer behind the guided
 * `:::iterate` / `:::pivot` authoring dialog.
 *
 * The existing `IterationTemplateDialog` only edits the per-cell TEMPLATE. The
 * guided builder also collects the DATA (the value list(s) + bind name + the
 * pivot's second axis + layout) and writes a **fully-bound** directive whose
 * value lists live in its attributes — so the block renders a populated result
 * with the built-in {@link evaluateEmbedded} (no consumer data engine needed) and
 * the `⋯` re-edit can reopen it losslessly.
 *
 * Pure + React-free so it is unit-testable on its own:
 *   serialize  →  `:::iterate{as="item" layout="stacked" values="A, B, C"}\n…\n:::`
 *                 `:::pivot{layout="matrix" rows="Q1, Q2" cols="N, S"}\n…\n:::`
 *   parse      ←  the inverse (for the `⋯` reopen)
 *   evaluate   →  {@link evaluateEmbedded} turns the embedded lists into cells.
 *
 * Value lists are comma-separated in the attribute (values containing a literal
 * comma aren't supported — the dialog enters one value per line and joins them).
 */
import {
  defaultInterpolate,
  type InterpolateTemplate,
  type IterationCell,
  type IterationData,
  type IterationLayout,
  type IterationSpec,
} from "./iteration";

/** The dialog's working value — the collected data + template for one directive. */
export interface IterationBuilderValue {
  kind: "iterate" | "pivot";
  /** Loop-variable name (iterate). Default `"item"`. */
  as: string;
  layout: IterationLayout;
  /** iterate: the list of items. pivot: the ROW values. */
  values: string[];
  /** pivot: the COLUMN values. */
  cols?: string[];
  /** The per-cell markdown template (directive body). */
  template: string;
}

const DEFAULT_LAYOUT: Record<"iterate" | "pivot", IterationLayout> = {
  iterate: "stacked",
  pivot: "matrix",
};

/**
 * The layouts offered per kind (the guided builder's toggle group AND the
 * node-menu's "Change layout" submenu share this single list so they can't
 * drift). `iterate` has no `matrix` (it has only one axis); `pivot` leads with
 * `matrix` (its natural shape).
 */
export const ITERATION_LAYOUTS: Record<"iterate" | "pivot", IterationLayout[]> = {
  iterate: ["stacked", "grid", "bento"],
  pivot: ["matrix", "grid", "bento"],
};

/** Default per-cell template per kind (so a fresh block renders something). */
export const DEFAULT_TEMPLATE: Record<"iterate" | "pivot", string> = {
  iterate: "{{item.name}}",
  pivot: "{{row}} · {{col}}",
};

/** Split a comma-separated attribute into trimmed, non-empty values. */
export function splitList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

/** Parse a directive attribute string (`a="x" b="y"`) into a record. */
export function parseAttributes(attrString: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([\w-]+)\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrString))) {
    const key = m[1];
    if (key) out[key] = m[2] ?? "";
  }
  return out;
}

/** Serialize an attributes record back to `key="value"` (stable, escaped). */
function attrString(attrs: Record<string, string>): string {
  return Object.entries(attrs)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}="${String(v).replace(/"/g, "'")}"`)
    .join(" ");
}

/** Build the `{ attributes, template }` for a builder value (the write-back shape). */
export function directivePartsFromValue(value: IterationBuilderValue): {
  attributes: Record<string, string>;
  template: string;
} {
  const attributes: Record<string, string> =
    value.kind === "pivot"
      ? {
          layout: value.layout,
          rows: value.values.join(", "),
          cols: (value.cols ?? []).join(", "),
        }
      : {
          as: value.as || "item",
          layout: value.layout,
          values: value.values.join(", "),
        };
  return { attributes, template: value.template.trim() };
}

/**
 * The longest run of leading colons (≥3 — a nested CONTAINER-directive fence such
 * as `:::card` / `:::callout` / a nested `:::iterate`) on any line of the template.
 * `remark-directive` closes a container at the nearest fence of EQUAL length, so an
 * outer fence the same length as a nested one is terminated early (the body is
 * truncated and everything after the nested block is dropped). Returns 0 when the
 * template has no nested container directive.
 */
function maxColonRun(template: string): number {
  let max = 0;
  // Up to 3 leading spaces are allowed before a directive fence (CommonMark).
  const re = /^ {0,3}(:{3,})/;
  for (const line of template.split(/\r?\n/)) {
    const m = re.exec(line);
    if (m && m[1]!.length > max) max = m[1]!.length;
  }
  return max;
}

/**
 * Pick the OUTER directive fence: at least 3 colons, and always STRICTLY longer
 * than any nested container fence in the template — so a nested `:::card`'s closing
 * `:::` can't terminate the outer `:::iterate` early. A template with no nested
 * container directive keeps the canonical `:::` (backward compatible).
 */
export function outerDirectiveFence(template: string): string {
  return ":".repeat(Math.max(3, maxColonRun(template) + 1));
}

/** Serialize a builder value to a fully-bound `:::iterate` / `:::pivot` directive. */
export function serializeIterationDirective(value: IterationBuilderValue): string {
  const { attributes, template } = directivePartsFromValue(value);
  const fence = outerDirectiveFence(template);
  return `${fence}${value.kind}{${attrString(attributes)}}\n${template}\n${fence}`;
}

/** Build a builder value from a directive's kind + attributes + body template. */
export function builderValueFromParts(
  kind: "iterate" | "pivot",
  attributes: Record<string, string>,
  template: string,
): IterationBuilderValue {
  const layout = (attributes.layout as IterationLayout) || DEFAULT_LAYOUT[kind];
  if (kind === "pivot") {
    return {
      kind,
      as: attributes.as?.trim() || "item",
      layout,
      values: splitList(attributes.rows),
      cols: splitList(attributes.cols),
      template: template.trim() || DEFAULT_TEMPLATE.pivot,
    };
  }
  return {
    kind,
    as: attributes.as?.trim() || "item",
    layout,
    values: splitList(attributes.values),
    template: template.trim() || DEFAULT_TEMPLATE.iterate,
  };
}

/**
 * Parse a full `:::iterate` / `:::pivot` directive string into a builder value.
 *
 * The fence length is variable (`:{3,}`) and the close is matched by BACKREFERENCE
 * (`\1`) to the same length as the open, so a directive whose body contains a
 * nested `:::card` (3 colons) is opened/closed with `::::` (4) and the inner fence
 * is not mistaken for the outer close. The non-greedy body anchored to end-of-input
 * keeps the canonical 3-colon form round-tripping unchanged.
 */
export function parseIterationDirective(markdown: string): IterationBuilderValue | null {
  const m = markdown.match(/^(:{3,})(iterate|pivot)\{([^}]*)\}\n?([\s\S]*?)\n?\1\s*$/);
  if (!m) return null;
  return builderValueFromParts(
    m[2] as "iterate" | "pivot",
    parseAttributes(m[3] ?? ""),
    m[4] ?? "",
  );
}

/** An empty builder value for a fresh insert. */
export function emptyBuilderValue(kind: "iterate" | "pivot"): IterationBuilderValue {
  return {
    kind,
    as: "item",
    layout: DEFAULT_LAYOUT[kind],
    values: [],
    cols: kind === "pivot" ? [] : undefined,
    template: DEFAULT_TEMPLATE[kind],
  };
}

/**
 * Built-in iteration evaluator: resolve the value list(s) embedded in the
 * directive attributes into cells — so a block authored with the guided builder
 * renders a populated result with no consumer data engine. iterate reads
 * `values=`; pivot reads `rows=` × `cols=`. Assignable to `EvaluateIteration`
 * (it never returns null — it degrades to an empty cell list).
 */
export function evaluateEmbedded(spec: IterationSpec): IterationData {
  if (spec.kind === "pivot") {
    const rows = splitList(spec.rows ?? spec.attributes.rows);
    const cols = splitList(spec.cols ?? spec.attributes.cols);
    if (rows.length === 0 || cols.length === 0) return { cells: [] };
    const cells = rows.flatMap((row) =>
      cols.map((col) => ({ context: { row, col }, row, col, key: `${row}|${col}` })),
    );
    return { cells, rowHeaders: rows, colHeaders: cols };
  }
  const values = splitList(spec.attributes.values ?? spec.source);
  if (values.length === 0) return { cells: [] };
  return {
    cells: values.map((value, i) => ({ context: { value, name: value }, key: `${i}:${value}` })),
  };
}

/**
 * Swap a pivot's ROW and COLUMN value lists (the node-menu "Transpose" action).
 * A no-op for `iterate` (it has no second axis) — the menu item hides itself in
 * that case, but the function stays total (never throws) so a stale/misrouted
 * call is harmless. `transposeIterationValue(transposeIterationValue(v)) === v`
 * for any pivot value (a lossless round-trip).
 */
export function transposeIterationValue(value: IterationBuilderValue): IterationBuilderValue {
  if (value.kind !== "pivot") return value;
  return { ...value, values: value.cols ?? [], cols: value.values };
}

/** Build the interpolation scope for one resolved cell (mirrors `IterationBlock`'s). */
function cellScope(as: string, cell: IterationCell, index: number): Record<string, unknown> {
  return { ...cell.context, [as]: cell.context, index, row: cell.row, col: cell.col };
}

/** Escape a cell's markdown for use inside a GFM table cell (single logical line). */
function escapeTableCell(markdown: string): string {
  return markdown
    .replace(/\|/g, "\\|")
    .replace(/\r?\n+/g, " ")
    .trim();
}

/**
 * Render a builder value's RESOLVED cells as plain, static markdown — the
 * "Convert to static" node-menu action. Reuses {@link evaluateEmbedded} (the same
 * resolver the live preview renders through), so the output matches what the
 * block currently shows, with no ProseMirror/dialog dependency:
 *   - `matrix` (with both header axes present) → a GFM table.
 *   - anything else (`stacked` / `grid` / `bento`) → cells joined as sequential
 *     markdown blocks, separated by a blank line.
 * An empty result set (no values entered yet) returns an empty string.
 */
export function staticMarkdownFromValue(
  value: IterationBuilderValue,
  interpolate: InterpolateTemplate = defaultInterpolate,
): string {
  const { attributes } = directivePartsFromValue(value);
  const spec: IterationSpec = {
    kind: value.kind,
    layout: value.layout,
    template: value.template,
    as: value.as,
    attributes,
  };
  const data = evaluateEmbedded(spec);
  if (data.cells.length === 0) return "";

  const cellMarkdown = (cell: IterationCell, index: number): string =>
    interpolate(value.template, cellScope(value.as, cell, index)).trim();

  if (value.layout === "matrix" && data.rowHeaders?.length && data.colHeaders?.length) {
    const rowHeaders = data.rowHeaders;
    const colHeaders = data.colHeaders;
    const at = new Map<string, string>();
    data.cells.forEach((cell, i) => {
      if (cell.row != null && cell.col != null) {
        at.set(`${cell.row}|${cell.col}`, cellMarkdown(cell, i));
      }
    });
    const headerRow = ["", ...colHeaders.map(escapeTableCell)];
    const dividerRow = headerRow.map(() => "---");
    const bodyRows = rowHeaders.map((row) => [
      escapeTableCell(row),
      ...colHeaders.map((col) => escapeTableCell(at.get(`${row}|${col}`) ?? "")),
    ]);
    return [headerRow, dividerRow, ...bodyRows].map((r) => `| ${r.join(" | ")} |`).join("\n");
  }

  return data.cells.map((cell, i) => cellMarkdown(cell, i)).join("\n\n");
}
