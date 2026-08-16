"use client";

/**
 * IterationBlock — a `:::iterate` / `:::pivot` repeater.
 *
 * Renders a per-cell markdown TEMPLATE once per data row (iterate) or per
 * row×column cross-tab cell (pivot). Both domain concerns stay in the consumer
 * (the calc/citation precedent — *the library renders, the app computes*):
 *   - `evaluate(spec) => IterationData` resolves the data source (the app's DB /
 *     query / binding lives there);
 *   - `interpolate(template, context) => string` fills the template (the app's
 *     templating engine; a minimal `{{path}}` default is provided).
 * The library owns only layout + rendering. `render` turns a resolved cell's
 * markdown into a node (a nested `MarkdownPreview` when wired through the preview).
 *
 * `grid` / `matrix` reuse the shared `@qlik-coe-emea/qlabs-components-ui` `Table` primitive (the same base
 * `@qlik-coe-emea/qlabs-components-data`'s DataTable builds on — `@qlik-coe-emea/qlabs-components-editor` can't import the sibling
 * `@qlik-coe-emea/qlabs-components-data`, so we compose the shared primitive rather than fork it). `bento`
 * lays the cells out as varied-size `@qlik-coe-emea/qlabs-components-ui` `BentoGrid` tiles.
 */
import {
  BentoGrid,
  BentoGridItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type BentoGridSize,
} from "@qlik-coe-emea/qlabs-components-ui";
import { cn } from "@qlik-coe-emea/qlabs-components-ui/lib/cn";
import { Repeat2 } from "lucide-react";
import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

export type IterationLayout = "stacked" | "grid" | "matrix" | "bento";

/** The parsed `:::iterate` / `:::pivot` specification handed to `evaluate`. */
export interface IterationSpec {
  /** `iterate` (1D repeat) or `pivot` (2D cross-tab). */
  kind: "iterate" | "pivot";
  /** How the cells are laid out. */
  layout: IterationLayout;
  /** The per-cell markdown template (the directive body). */
  template: string;
  /** Loop-variable name exposed to `interpolate` (default `"item"`). */
  as: string;
  /** Opaque data-source reference; resolved by the consumer's `evaluate`. */
  source?: string;
  /** Pivot row / column dimension field names (`pivot`). */
  rows?: string;
  cols?: string;
  /** Explicit grid column count (`grid`). */
  columns?: number;
  /** All raw directive attributes (escape hatch for `evaluate`). */
  attributes: Record<string, string>;
}

/** One resolved cell. */
export interface IterationCell {
  /** Interpolation context (the row record / pivot-cell scope). */
  context: Record<string, unknown>;
  /** Stable key (defaults to the index). */
  key?: string;
  /** `matrix`: the row / column header this cell sits at. */
  row?: string;
  col?: string;
  /** `bento`: tile size preset. Defaults to a deterministic per-index rhythm. */
  size?: BentoGridSize;
  /** Pre-rendered markdown — skips `interpolate` when the app already templated. */
  markdown?: string;
}

/** What the consumer's `evaluate` returns. */
export interface IterationData {
  /** Cells in render order. */
  cells: IterationCell[];
  /** `matrix`: ordered row + column header labels. */
  rowHeaders?: string[];
  colHeaders?: string[];
  /** `grid`: column header labels (also sets the column count). */
  columns?: string[];
}

/** Consumer hook: resolve a spec to its data, or `null` when unavailable. */
export type EvaluateIteration = (spec: IterationSpec) => IterationData | null;

/** Consumer hook: fill a template with a cell context. */
export type InterpolateTemplate = (template: string, context: Record<string, unknown>) => string;

/* ------------------------------------------------------------------ */
/* Default templating (minimal; the app should bring its own engine)    */
/* ------------------------------------------------------------------ */

const TOKEN_RE = /\{\{\s*([\w.$]+)\s*\}\}/g;

/**
 * Minimal `{{ path.to.value }}` substitution over the cell context (dot paths).
 * Safe (no eval). An UNRESOLVED token is left **literal** — so a nested
 * `:::iterate`'s tokens survive the outer pass and resolve in the inner one (use
 * the `as` loop variable in nested templates to avoid scope collisions). Replace
 * it with your own engine (Mustache/Handlebars/…) via the `interpolate` prop.
 */
export function defaultInterpolate(template: string, context: Record<string, unknown>): string {
  return template.replace(TOKEN_RE, (match, path: string) => {
    const value = path.split(".").reduce<unknown>((obj, key) => {
      if (obj && typeof obj === "object") return (obj as Record<string, unknown>)[key];
      return undefined;
    }, context);
    return value == null ? match : String(value);
  });
}

/** Build the interpolation scope for a cell (fields + `as`-nested + row/col/index). */
function cellScope(
  spec: IterationSpec,
  cell: IterationCell,
  index: number,
): Record<string, unknown> {
  return {
    ...cell.context,
    [spec.as]: cell.context,
    index,
    row: cell.row,
    col: cell.col,
  };
}

function safeEvaluate(evaluate: EvaluateIteration, spec: IterationSpec): IterationData | null {
  try {
    return evaluate(spec);
  } catch {
    // A throwing hook degrades to the empty state — it never crashes the page.
    return null;
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Deterministic bento tile-size rhythm by index — a 2×2 feature tile to open each
 * six-cell cycle and a 2×1 wide tile mid-cycle, the rest 1×1. `grid-auto-flow:
 * dense` packs them and col-spans clamp to the available tracks on narrow widths.
 * A cell can override this via {@link IterationCell.size}.
 */
function bentoSize(index: number): BentoGridSize {
  const m = index % 6;
  if (m === 0) return "lg";
  if (m === 3) return "md";
  return "sm";
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export interface IterationBlockProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** The parsed iteration spec (from the directive, or hand-built). */
  spec: IterationSpec;
  /** Resolve the spec to data (consumer data source). */
  evaluate: EvaluateIteration;
  /** Fill a template with a cell context. Default: `{{path}}` substitution. */
  interpolate?: InterpolateTemplate;
  /** Render a resolved cell's markdown → node (e.g. a nested `MarkdownPreview`). */
  render: (markdown: string) => ReactNode;
  /** Override `spec.layout`. */
  layout?: IterationLayout;
  /** Empty-state message when there are no cells. */
  emptyLabel?: string;
}

export const IterationBlock = forwardRef<HTMLDivElement, IterationBlockProps>(
  function IterationBlock(
    {
      spec,
      evaluate,
      interpolate = defaultInterpolate,
      render,
      layout,
      emptyLabel,
      className,
      ...props
    },
    ref,
  ) {
    const data = safeEvaluate(evaluate, spec);
    const cells = data?.cells ?? [];
    const resolvedLayout = layout ?? spec.layout;

    const renderCell = (cell: IterationCell, index: number): ReactNode => {
      const md = cell.markdown ?? interpolate(spec.template, cellScope(spec, cell, index));
      return render(md);
    };

    const label = spec.kind === "pivot" ? "Pivot" : "Iteration";

    if (cells.length === 0) {
      return (
        <div
          ref={ref}
          role="group"
          aria-label={label}
          data-iteration={spec.kind}
          className={cn("my-4 flex items-center gap-2 text-meta text-muted-foreground", className)}
          {...props}
        >
          <Repeat2 className="size-4 shrink-0" aria-hidden="true" />
          <span>
            {emptyLabel ?? `Nothing to ${spec.kind === "pivot" ? "pivot" : "iterate"} yet.`}
          </span>
        </div>
      );
    }

    // matrix needs both header axes; fall back to grid when they're absent.
    const isMatrix =
      resolvedLayout === "matrix" && !!data?.rowHeaders?.length && !!data?.colHeaders?.length;

    let body: ReactNode;
    if (resolvedLayout === "stacked") {
      body = (
        <ol className="space-y-6">
          {cells.map((cell, i) => (
            <li key={cell.key ?? i} className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              {renderCell(cell, i)}
            </li>
          ))}
        </ol>
      );
    } else if (resolvedLayout === "bento") {
      body = (
        <BentoGrid>
          {cells.map((cell, i) => (
            <BentoGridItem key={cell.key ?? i} size={cell.size ?? bentoSize(i)}>
              <div className="h-full overflow-auto p-4 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                {renderCell(cell, i)}
              </div>
            </BentoGridItem>
          ))}
        </BentoGrid>
      );
    } else if (isMatrix) {
      const rowHeaders = data!.rowHeaders!;
      const colHeaders = data!.colHeaders!;
      const at = new Map<string, { cell: IterationCell; index: number }>();
      cells.forEach((cell, i) => {
        if (cell.row != null && cell.col != null)
          at.set(JSON.stringify([cell.row, cell.col]), { cell, index: i });
      });
      body = (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead aria-hidden="true" />
              {colHeaders.map((c) => (
                <TableHead key={c} scope="col">
                  {c}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rowHeaders.map((r) => (
              <TableRow key={r}>
                <TableHead scope="row" className="font-medium text-foreground">
                  {r}
                </TableHead>
                {colHeaders.map((c) => {
                  const hit = at.get(JSON.stringify([r, c]));
                  return (
                    <TableCell key={c} className="align-top">
                      {hit ? renderCell(hit.cell, hit.index) : null}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    } else {
      // grid (and matrix fallback): cells laid row-major into N columns.
      const headers = data?.columns;
      const colCount = (headers?.length ?? spec.columns ?? Math.min(cells.length, 3)) || 1;
      const rows = chunk(cells, colCount);
      body = (
        <Table>
          {headers ? (
            <TableHeader>
              <TableRow>
                {headers.map((h) => (
                  <TableHead key={h} scope="col">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
          ) : null}
          <TableBody>
            {rows.map((row, r) => (
              <TableRow key={r}>
                {row.map((cell, c) => (
                  <TableCell key={cell.key ?? c} className="align-top">
                    {renderCell(cell, r * colCount + c)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }

    return (
      <div
        ref={ref}
        role="group"
        aria-label={label}
        data-iteration={spec.kind}
        data-iteration-layout={resolvedLayout}
        className={cn("my-4", className)}
        {...props}
      >
        {body}
      </div>
    );
  },
);
