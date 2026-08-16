"use client";

/**
 * CalcBlock — render a ```calc fence as a two-column "sheet" (#L1).
 *
 * The Soulver/Notes-Calculator model: expressions on the left, computed answers
 * on the right (`tabular-nums`), a running-total footer. The library RENDERS and
 * the consumer EVALUATES: the math engine is app/domain logic, so CalcBlock takes
 * an `evaluate(source) => CalcSheet` hook (mirroring `MarkdownPreview`'s
 * `resolveUrl`) and bundles no calculator. Per-line errors render inline; a bad
 * block never throws or blanks the document. The mermaid fence is the precedent.
 *
 * Title: a leading `# Heading` becomes the block title (header bar); with none,
 * the header shows the neutral `calc` code-label.
 *
 * Row presentation — a per-row `rule` divider (dotted / single / double) and a
 * semantic `tint` wash — comes from two sources, both pure presentation:
 *   1. the evaluator, as `rule`/`tint` fields on a `CalcLineResult` (app-driven); or
 *   2. a trailing author **marker** the WRITER types in the calc text, which
 *      CalcBlock strips before calling `evaluate` (so the math engine never sees
 *      it) — the same way it strips `# ` off a heading. Tints: `@primary`,
 *      `@success`, `@warning`, `@danger`, `@info`, `@muted`/`@note`. Rules:
 *      `@line`, `@line2`/`@double`, `@dotted`. Multiple markers per line compose
 *      (`subtotal = a + b @success @line`); an evaluator field wins over a marker.
 *      Disable parsing with `markers={false}`. Unknown trailing `@words` are left
 *      as literal text (never silently dropped).
 *
 * The footer total defaults to `sheet.total` but can be overridden via the
 * `total` / `totalLabel` props.
 *
 * Syntax highlighting uses the dedicated `--calc-*` tokens (#221) via `text-calc-*`;
 * color is never the only signal (var-def = weight, unresolved = dotted underline),
 * so roles stay distinct in the high-contrast theme.
 */
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { TriangleAlert } from "lucide-react";
import { forwardRef, useId, useMemo, type HTMLAttributes, type ReactNode } from "react";

import type {
  CalcLineResult,
  CalcRule,
  CalcTint,
  CalcToken,
  CalcTokenKind,
  CalcValue,
  EvaluateCalc,
} from "./types";
// Carry the `.brand-calc-tok--<role>` role colours, so the RENDERED block reads
// identically to the editor authoring surfaces (which import the same stylesheet).
import "./calc-editor.css";

export interface CalcBlockProps extends Omit<HTMLAttributes<HTMLElement>, "children" | "title"> {
  /** The ```calc fence body. */
  source: string;
  /** Consumer-supplied evaluator (sync). The library bundles no math engine. */
  evaluate: EvaluateCalc;
  /**
   * Block title shown in the header bar. By default a leading `# Heading` line in
   * `source` is lifted here; with neither prop nor heading the header shows the
   * neutral `calc` code-label. Pass `title` to override the displayed text.
   */
  title?: ReactNode;
  /** Show the running-total footer. Default true. */
  showTotal?: boolean;
  /**
   * Override the footer total. Defaults to `sheet.total`. Pass a `CalcValue`
   * (rendered tabular via its `.display`) or any ReactNode to replace the
   * computed total — e.g. a different aggregate the evaluator didn't surface.
   */
  total?: CalcValue | ReactNode;
  /** Footer label. Default `Total`. */
  totalLabel?: ReactNode;
  /**
   * Parse trailing author markers (`@success`, `@line`, …) out of each source
   * line — applying the row's tint/rule and stripping the marker from the
   * rendered text. Default `true`. Set `false` if your calc dialect uses a
   * trailing `@token` for something else.
   */
  markers?: boolean;
  /** Reserved for the editing variant (CalcWorkspace); preview is read-only. */
  readOnly?: boolean;
}

/** Author marker keyword → semantic tint (friendly words; `@danger` = destructive). */
const TINT_MARKERS: Record<string, CalcTint> = {
  primary: "primary",
  success: "success",
  warning: "warning",
  danger: "destructive",
  destructive: "destructive",
  info: "info",
  muted: "muted",
  note: "muted",
};

/** Author marker keyword → rule (divider) style. */
const RULE_MARKERS: Record<string, CalcRule> = {
  line: "single",
  rule: "single",
  line2: "double",
  double: "double",
  dotted: "dotted",
};

/** A line's parsed presentation, after author markers are stripped from the text. */
interface LineMarkers {
  text: string;
  tint?: CalcTint;
  rule?: CalcRule;
}

/**
 * Strip recognized trailing `@marker`s off a line (right-to-left), returning the
 * cleaned text plus the tint/rule they request. An unrecognized trailing `@word`
 * halts stripping and is kept as literal text — markers only ever bind at the end.
 */
function parseMarkers(line: string): LineMarkers {
  let text = line;
  let tint: CalcTint | undefined;
  let rule: CalcRule | undefined;
  for (;;) {
    const m = /\s+@([A-Za-z][A-Za-z0-9]*)\s*$/.exec(text);
    if (!m) break;
    const key = (m[1] ?? "").toLowerCase();
    if (key in TINT_MARKERS) {
      tint ??= TINT_MARKERS[key];
    } else if (key in RULE_MARKERS) {
      rule ??= RULE_MARKERS[key];
    } else {
      break; // unknown trailing @word — leave it (and everything before) as text
    }
    text = text.slice(0, m.index);
  }
  return { text, tint, rule };
}

/** Per-row rule (divider) presentation. `border-strong` is the sole same-surface cue. */
const RULE_CLASS: Record<CalcRule, string> = {
  dotted: "border-b border-dotted border-border-strong pb-1",
  single: "border-b border-border-strong pb-1",
  double: "border-b-4 border-double border-border-strong pb-1",
};

/** Per-row background tint — semantic status washes (theme-safe), `muted` neutral. */
const TINT_CLASS: Record<CalcTint, string> = {
  primary: "bg-primary/10",
  success: "bg-success/10",
  warning: "bg-warning/10",
  destructive: "bg-destructive/10",
  info: "bg-info/10",
  muted: "bg-muted",
};

/** Narrow a `total` override to a `CalcValue` (vs a plain ReactNode like a string). */
function isCalcValue(x: unknown): x is CalcValue {
  return typeof x === "object" && x !== null && !("$$typeof" in x) && "kind" in x && "display" in x;
}

/**
 * Token kind → highlight class. Color comes from the dedicated `--calc-*` syntax
 * tokens (#221) via the `text-calc-*` utilities; the `brand-calc-tok--<role>`
 * class carries a role-specific, color-independent cue (weight / style / underline)
 * in low-chroma themes (#226) — so in high-contrast, where every inline calc token
 * collapses to one ink, number / unit / currency / var-ref / line-ref / unknown
 * stay distinguishable. The SAME classes drive the editor decorations
 * (calc-editor.css), so both surfaces read identically.
 */
function tokenClass(kind: CalcTokenKind, resolved: boolean): string {
  let base: string;
  let role: string;
  switch (kind) {
    case "comment":
      base = "text-calc-comment italic";
      role = "brand-calc-tok--comment";
      break;
    case "operator":
      base = "text-calc-operator";
      role = "brand-calc-tok--operator";
      break;
    case "unit":
      base = "text-calc-unit";
      role = "brand-calc-tok--unit";
      break;
    case "currency":
      base = "text-calc-currency";
      role = "brand-calc-tok--currency";
      break;
    case "function":
      base = "text-calc-function";
      role = "brand-calc-tok--function";
      break;
    case "var-ref":
      base = "text-calc-variable";
      role = "brand-calc-tok--var-ref";
      break;
    case "line-ref":
      base = "text-calc-reference tabular-nums";
      role = "brand-calc-tok--line-ref";
      break;
    case "var-def":
      base = "text-calc-variable font-medium";
      role = "brand-calc-tok--var-def";
      break;
    case "unknown":
      base = "text-calc-warning";
      role = "brand-calc-tok--unknown";
      break;
    default: // number, constant
      base = "text-calc-number";
      role = "brand-calc-tok--number";
  }
  return cn(
    "brand-calc-tok",
    role,
    base,
    !resolved && "underline decoration-dotted decoration-1 underline-offset-2",
  );
}

/** Paint one source line: tokenized spans with plain text in the gaps. */
function renderSource(text: string, tokens: CalcToken[]): ReactNode {
  const out: ReactNode[] = [];
  let cursor = 0;
  for (const [i, t] of tokens.entries()) {
    if (t.start > cursor) {
      out.push(<span key={`gap-${String(i)}`}>{text.slice(cursor, t.start)}</span>);
    }
    out.push(
      <span key={`tok-${String(i)}`} className={tokenClass(t.kind, t.resolved)}>
        {text.slice(t.start, t.end)}
      </span>,
    );
    cursor = t.end;
  }
  if (cursor < text.length) out.push(<span key="tail">{text.slice(cursor)}</span>);
  if (out.length === 0) out.push(<span key="empty">{text || " "}</span>);
  return out;
}

/** The right-hand cell: a value, a calm error marker, or nothing. */
function ResultCell({ result }: { result: CalcLineResult }): ReactNode {
  if (result.error) {
    // Native `title` (not a Radix Tooltip) so CalcBlock is self-contained — it
    // renders inside MarkdownPreview / a story with no TooltipProvider ancestor.
    return (
      <span
        className="inline-flex shrink-0 text-calc-warning"
        title={result.error.message}
        aria-label={`Error: ${result.error.message}`}
      >
        <TriangleAlert className="size-3.5" aria-hidden="true" />
      </span>
    );
  }
  if (result.value) {
    return (
      <div className="brand-calc-tok--result shrink-0 tabular-nums text-calc-result">
        <span className="sr-only">equals </span>
        <span>{result.value.display}</span>
      </div>
    );
  }
  return null;
}

export const CalcBlock = forwardRef<HTMLDivElement, CalcBlockProps>(function CalcBlock(
  {
    source,
    evaluate,
    title,
    showTotal = true,
    total,
    totalLabel = "Total",
    markers = true,
    readOnly: _readOnly,
    className,
    ...props
  },
  ref,
) {
  // Author markers are stripped BEFORE evaluation: the math engine sees clean
  // lines, and because markers are trailing, token columns stay aligned with the
  // rendered (cleaned) text. `lines`/`evalSource` are the marker-free versions.
  const { lines, evalSource, hints } = useMemo(() => {
    const raw = source.split("\n");
    if (!markers) return { lines: raw, evalSource: source, hints: [] as LineMarkers[] };
    const parsed = raw.map(parseMarkers);
    return {
      lines: parsed.map((p) => p.text),
      evalSource: parsed.map((p) => p.text).join("\n"),
      hints: parsed,
    };
  }, [source, markers]);

  const sheet = useMemo(() => evaluate(evalSource), [evaluate, evalSource]);
  const empty = evalSource.trim() === "";
  const titleId = useId();

  // A leading `# Heading` is the block title (lifted to the header bar) and is not
  // repeated in the body. Later `#` lines stay as in-body section headings.
  const { titleLine, derivedTitle } = useMemo(() => {
    const idx = lines.findIndex((l) => l.trim() !== "");
    const first = (lines[idx] ?? "").trim();
    return /^#+\s+/.test(first)
      ? { titleLine: idx + 1, derivedTitle: first.replace(/^#+\s*/, "") }
      : { titleLine: 0, derivedTitle: undefined as string | undefined };
  }, [lines]);

  const hasTitle = title != null || derivedTitle != null;
  const resolvedTitle = title ?? derivedTitle ?? "calc";

  const resolvedTotal = total ?? sheet.total;
  const totalDisplay = isCalcValue(resolvedTotal) ? resolvedTotal.display : resolvedTotal;

  const rows: ReactNode[] = [];
  for (const result of sheet.results) {
    if (result.line === titleLine) continue; // lifted to the header bar
    const text = lines[result.line - 1] ?? "";
    const key = `row-${String(result.line)}`;
    if (text.trim() === "") {
      rows.push(<div key={key} className="h-1.5" aria-hidden="true" />);
      continue;
    }
    if (text.trim().startsWith("#")) {
      rows.push(
        <div key={key} className="pt-1 font-semibold text-foreground first:pt-0">
          {text.replace(/^#+\s*/, "")}
        </div>,
      );
      continue;
    }
    // An evaluator-set field wins over an author marker; otherwise the marker applies.
    const hint = hints[result.line - 1];
    const rule = result.rule ?? hint?.rule;
    const tint = result.tint ?? hint?.tint;
    rows.push(
      <div
        key={key}
        data-rule={rule}
        data-tint={tint}
        className={cn(
          "flex items-baseline justify-between gap-x-6",
          rule && RULE_CLASS[rule],
          tint != null && cn("-mx-2 rounded-sm px-2", TINT_CLASS[tint]),
        )}
      >
        <div className="min-w-0 whitespace-pre-wrap break-words text-foreground">
          {renderSource(text, result.tokens)}
        </div>
        <ResultCell result={result} />
      </div>,
    );
  }

  return (
    <div
      ref={ref}
      data-testid="calc-block"
      role="group"
      aria-labelledby={titleId}
      className={cn("my-4 overflow-hidden rounded-md border border-border bg-card", className)}
      {...props}
    >
      <div className="border-b border-border px-4 py-1.5">
        <span
          id={titleId}
          className={cn(
            "text-meta",
            hasTitle
              ? "font-medium text-foreground"
              : "font-mono uppercase tracking-wide text-muted-foreground",
          )}
        >
          {resolvedTitle}
        </span>
      </div>

      {empty ? (
        <p className="px-4 py-6 text-body text-muted-foreground">Empty calc block.</p>
      ) : (
        <div className="flex flex-col gap-y-1 px-4 py-3 font-mono text-code leading-relaxed">
          {rows}
        </div>
      )}

      {showTotal && resolvedTotal != null && !empty ? (
        <div className="flex items-center justify-between border-t border-border px-4 py-2">
          <span className="text-meta font-medium uppercase tracking-wide text-muted-foreground">
            {totalLabel}
          </span>
          <span className="font-mono text-code font-medium tabular-nums text-foreground">
            {totalDisplay}
          </span>
        </div>
      ) : null}
    </div>
  );
});
