"use client";

/**
 * DiffView — line-level unified diff renderer for an agent transcript (#102).
 *
 * An agent's primary output is a code change; the package had no way to show
 * one line-by-line. DiffView is the presentational surface for a `DiffLine[]`
 * someone else computed (parsed a unified diff, a git patch, an LLM tool
 * result) — it never diffs, fetches or parses a patch itself (D5).
 *
 * Package placement + the `ChangeReview` seam are BINDING decisions, not
 * choices this file makes on its own — see
 * `docs/decisions/2026-09-01-brainless-adoption-architecture.md` § 3:
 *   - DiffView ships here (`@elabs-ai/components-ai`), never in
 *     `@elabs-ai/components-ui`, because it reuses `highlightCode` (Shiki) and
 *     `ui` does not depend on Shiki.
 *   - `ChangeHunk` (`ui`) gains NO `lines` field and `DiffLine` never moves to
 *     `ui`. A consumer composes the two via `ChangeReview`'s existing
 *     injection seams — `renderHunk` or `ChangeHunk.after` (both `ReactNode`)
 *     — never a cross-package import in either direction. See the
 *     `ChangeReviewComposition` story.
 *
 * Reuses `highlightCode` from `./code-block` (Shiki) for intra-line syntax
 * colour, so a diff and a code block agree on tokenisation and theme — real
 * `add`/`del`/`context` lines are re-joined into one document before
 * highlighting so Shiki sees genuine surrounding context, then the result is
 * mapped back onto the original line indices. `hunk`/`meta` lines (diff
 * headers, not source) are excluded from that document.
 *
 * Colour is never the only channel (accessibility.md, WCAG 1.4.1): every
 * `add`/`del` row carries a screen-reader polarity word AND a `+`/`−` marker
 * glyph in its own column — the row tint (`bg-success/10` / `bg-destructive/10`,
 * the fill rung) is the third, redundant cue, never the only one.
 *
 * The `DiffLine` model and the polarity-prefix technique are adapted from
 * `theswerd/brainless` (MIT) — see `ATTRIBUTION.md`.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
} from "react";
import {
  Skeleton,
  diffLineAccessibleLabel,
  diffLineMarker,
  useDiffRows,
  useLocale,
  type DiffLine,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { cva } from "class-variance-authority";
import type { BundledLanguage, ThemedToken } from "shiki";
import { highlightCode } from "./code-block";
import { Shimmer } from "./shimmer";

// ─── Public types ───────────────────────────────────────────────────────────
//
// `DiffLineType` and `DiffLine` moved to `@elabs-ai/components-ui`
// (`lib/diff-line.ts`) — the terminal CLI look-alike family's own diff hunk
// (issue #117) reuses the same model, and `@elabs-ai/components-ai`/
// `@elabs-ai/components-terminal` are layer-2 DAG siblings that may not
// import each other (T0; see
// docs/decisions/2026-09-01-brainless-adoption-architecture.md § 4). Imported
// above; NOT re-exported from here — `@elabs-ai/components-ai` never
// re-exports from `@elabs-ai/components-ui` (its barrel stays own-module
// only). A consumer imports `DiffLine`/`DiffLineType` from
// `@elabs-ai/components-ui`.

export interface DiffViewProps extends Omit<ComponentProps<"div">, "children"> {
  /** The diff, as a flat, ordered line list. */
  lines: DiffLine[];
  /** File path shown in the header. */
  file?: string;
  /** One-line summary shown beside the file name. */
  summary?: string;
  /** Added / removed line counts shown in the header. */
  stats?: { additions: number; deletions: number };
  /** `inline` = unified single column; `split` = side-by-side. @default "inline" */
  variant?: "inline" | "split";
  /**
   * Full-screen reading surface: a scrollable region with a scroll-position
   * indicator, a key legend (↑/↓, Page Up/Down, Home/End), and a named
   * `role="region"`. Absorbs the upstream `CodexDiff` pager shape — this
   * prop, not a second component.
   */
  pager?: boolean;
  /** Shiki language id for intra-line syntax colour. Omit to render plain text. */
  language?: BundledLanguage;
  /** Collapse a run of consecutive `context` lines longer than this behind a "show more" control. */
  contextLines?: number;
  /** Hard cap on rendered lines. Extra lines are simply not rendered. */
  maxLines?: number;
  /** No renderable diff yet (loading-states.md) — layout-shaped skeleton rows at the real row height. */
  loading?: boolean;
  /** Lines are still arriving (loading-states.md) — render what exists; never an error surface. */
  isStreaming?: boolean;
}

// ─── Row styling (one visual axis: line type → tint) ───────────────────────

/**
 * The row's fill-rung tint — the THIRD, redundant cue (accessibility.md /
 * styling-and-tokens.md). Never the only signal: every `add`/`del` row also
 * carries a marker glyph (shape) and an `sr-only` polarity word (name).
 */
export const diffRowVariants = cva(
  "grid grid-cols-[2.75rem_2.75rem_1.25rem_1fr] items-start gap-x-2 px-2 py-0.5",
  {
    variants: {
      type: {
        add: "bg-success/10",
        del: "bg-destructive/10",
        context: "",
        hunk: "bg-muted/40",
        meta: "",
      },
    },
    defaultVariants: { type: "context" },
  },
);

const GUTTER_CLASS = "select-none text-end text-meta text-muted-foreground tabular-nums";

// Marker GLYPHS (`diffLineMarker`) and screen-reader polarity LABELS
// (`diffLineAccessibleLabel`) are promoted to `@elabs-ai/components-ui`
// (`lib/diff-line.ts`) — imported above. The tint below stays here: it is
// presentational (Tailwind token classes), not part of the shared model.

const MARKER_TONE: Record<"add" | "del" | "context", string> = {
  add: "text-success-text",
  del: "text-destructive-text",
  context: "text-muted-foreground",
};

// ─── Theme scope (mirrors code-block.tsx's private helper — not a fork of it) ──

const getThemeScope = (el: Element | null): Element | null =>
  el?.closest("[data-theme]") ??
  (typeof document !== "undefined" ? document.documentElement : null);

// ─── Intra-line syntax highlighting ────────────────────────────────────────

type TokenizedResult = NonNullable<ReturnType<typeof highlightCode>>;

/**
 * Highlights only the lines that are real source (`add` / `del` / `context`)
 * as one combined document, so Shiki sees genuine surrounding context instead
 * of tokenizing each line in isolation, then maps the result back onto the
 * original line indices. `hunk` / `meta` lines are diff headers, not code, and
 * are excluded from the document entirely.
 */
function useDiffTokens(
  lines: DiffLine[],
  language: BundledLanguage | undefined,
  scopeEl: Element | null,
): Map<number, ThemedToken[]> | null {
  const codeIndices = useMemo(
    () =>
      lines
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => line.type !== "hunk" && line.type !== "meta")
        .map(({ index }) => index),
    [lines],
  );
  const combinedCode = useMemo(
    () => codeIndices.map((index) => lines[index]?.text ?? "").join("\n"),
    [codeIndices, lines],
  );

  const [result, setResult] = useState<TokenizedResult | null>(null);

  useEffect(() => {
    if (!language || combinedCode.length === 0) {
      setResult(null);
      return;
    }
    let cancelled = false;
    const cached = highlightCode(
      combinedCode,
      language,
      (r) => {
        if (!cancelled) setResult(r);
      },
      scopeEl,
    );
    if (cached) setResult(cached);
    return () => {
      cancelled = true;
    };
  }, [combinedCode, language, scopeEl]);

  return useMemo(() => {
    if (!language || !result) return null;
    const map = new Map<number, ThemedToken[]>();
    codeIndices.forEach((originalIndex, i) => {
      const tokenLine = result.tokens[i];
      if (tokenLine) map.set(originalIndex, tokenLine);
    });
    return map;
  }, [codeIndices, result, language]);
}

/** Renders pre-highlighted tokens; colour only (a diff row doesn't need bold/italic/underline). */
function TokenText({ tokens, fallback }: { tokens?: ThemedToken[]; fallback: string }) {
  if (!tokens) return <>{fallback}</>;
  return (
    <>
      {tokens.map((token, i) => (
        // oxlint-disable-next-line eslint(react/no-array-index-key) -- tokens for one line never reorder
        <span key={i} style={{ color: token.color }}>
          {token.content}
        </span>
      ))}
    </>
  );
}

// ─── Context-run collapsing ─────────────────────────────────────────────────
//
// The row-collapsing model (`DiffRow`, `collapseDiffRows`, `useDiffRows`,
// formerly this file's private `Row`/`useVisibleRows`) is promoted to
// `@elabs-ai/components-ui` (`lib/diff-rows.ts`) — imported above. It is pure
// (no Shiki, no DOM) and the terminal CLI look-alike family's own diff hunk
// (issue #117) reuses it unchanged; see
// docs/decisions/2026-09-01-brainless-adoption-architecture.md § 4.

function CollapsedRow({ hiddenCount, onExpand }: { hiddenCount: number; onExpand: () => void }) {
  const { t } = useLocale();
  return (
    <div
      data-slot="diff-view-collapsed"
      className="col-span-full grid grid-cols-[2.75rem_2.75rem_1.25rem_1fr]"
    >
      <button
        type="button"
        onClick={onExpand}
        className="col-start-4 w-fit rounded-sm px-1 text-info-text text-meta hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t("ai.diffView.showMore", { count: hiddenCount })}
      </button>
    </div>
  );
}

// ─── Full-width rows (hunk / meta) ──────────────────────────────────────────

function FullWidthRow({ line }: { line: DiffLine }) {
  return (
    <div
      data-slot="diff-view-row"
      data-diff-type={line.type}
      className={cn(
        diffRowVariants({ type: line.type as "hunk" | "meta" }),
        "col-span-full block font-mono text-meta text-muted-foreground",
        line.type === "hunk" && "italic",
      )}
    >
      {line.text || " "}
    </div>
  );
}

// ─── Inline rows ────────────────────────────────────────────────────────────

function InlineRow({
  line,
  index,
  tokens,
}: {
  line: DiffLine;
  index: number;
  tokens?: ThemedToken[];
}) {
  const { t } = useLocale();
  if (line.type === "hunk" || line.type === "meta") {
    return <FullWidthRow line={line} />;
  }
  const type = line.type;
  const polarityKey = diffLineAccessibleLabel(type);
  return (
    <div
      data-slot="diff-view-row"
      data-diff-type={type}
      data-diff-index={index}
      className={diffRowVariants({ type })}
    >
      <span data-slot="diff-view-gutter-old" className={GUTTER_CLASS} aria-hidden="true">
        {type !== "add" ? (line.oldNumber ?? "") : ""}
      </span>
      <span data-slot="diff-view-gutter-new" className={GUTTER_CLASS} aria-hidden="true">
        {type !== "del" ? (line.newNumber ?? "") : ""}
      </span>
      <span
        data-slot="diff-view-marker"
        aria-hidden="true"
        className={cn("select-none font-bold font-mono text-code", MARKER_TONE[type])}
      >
        {diffLineMarker(type)}
      </span>
      <span
        data-slot="diff-view-line-text"
        className="whitespace-pre-wrap break-all font-mono text-code"
      >
        {polarityKey && <span className="sr-only">{t(polarityKey)}</span>}
        <TokenText tokens={tokens} fallback={line.text || " "} />
      </span>
    </div>
  );
}

// ─── Split rows (two aligned columns: old-file view | new-file view) ───────

function SplitSide({
  show,
  number,
  markerType,
  polarityKey,
  text,
  tokens,
}: {
  show: boolean;
  number?: number;
  markerType: "add" | "del" | "context";
  polarityKey?: ReturnType<typeof diffLineAccessibleLabel>;
  text: string;
  tokens?: ThemedToken[];
}) {
  const { t } = useLocale();
  if (!show) {
    return (
      <span aria-hidden="true" className="block">
        {" "}
      </span>
    );
  }
  return (
    <div className="grid grid-cols-[2.75rem_1.25rem_1fr] items-start gap-x-2">
      <span className={GUTTER_CLASS} aria-hidden="true">
        {number ?? ""}
      </span>
      <span
        aria-hidden="true"
        className={cn("select-none font-bold font-mono text-code", MARKER_TONE[markerType])}
      >
        {diffLineMarker(markerType)}
      </span>
      <span className="whitespace-pre-wrap break-all font-mono text-code">
        {polarityKey && <span className="sr-only">{t(polarityKey)}</span>}
        <TokenText tokens={tokens} fallback={text || " "} />
      </span>
    </div>
  );
}

function SplitRow({
  line,
  index,
  tokens,
}: {
  line: DiffLine;
  index: number;
  tokens?: ThemedToken[];
}) {
  if (line.type === "hunk" || line.type === "meta") {
    return <FullWidthRow line={line} />;
  }
  const type = line.type;
  const showOld = type !== "add";
  const showNew = type !== "del";
  return (
    <div data-slot="diff-view-row" data-diff-type={type} data-diff-index={index} className="flex">
      <div className={cn("flex-1 px-2 py-0.5", showOld && diffRowVariants({ type }))}>
        <SplitSide
          show={showOld}
          number={line.oldNumber}
          markerType={type === "del" ? "del" : "context"}
          polarityKey={diffLineAccessibleLabel(type)}
          text={line.text}
          tokens={tokens}
        />
      </div>
      <div
        className={cn(
          "flex-1 border-s border-s-border-strong px-2 py-0.5",
          showNew && diffRowVariants({ type }),
        )}
      >
        <SplitSide
          show={showNew}
          number={line.newNumber}
          markerType={type === "add" ? "add" : "context"}
          polarityKey={diffLineAccessibleLabel(type)}
          text={line.text}
          tokens={tokens}
        />
      </div>
    </div>
  );
}

// ─── Skeleton (loading-states.md) ───────────────────────────────────────────

function SkeletonRow() {
  return (
    <div data-slot="diff-view-row" className={diffRowVariants({ type: "context" })}>
      <Skeleton className="ms-auto h-3 w-6" />
      <Skeleton className="ms-auto h-3 w-6" />
      <span />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

// ─── Header ─────────────────────────────────────────────────────────────────

function DiffViewHeader({
  file,
  summary,
  stats,
}: {
  file?: string;
  summary?: string;
  stats?: { additions: number; deletions: number };
}) {
  const { t } = useLocale();
  return (
    <div
      data-slot="diff-view-header"
      className="flex items-center justify-between gap-3 border-b bg-muted/80 px-3 py-2 text-meta text-muted-foreground"
    >
      <div className="flex min-w-0 items-center gap-2">
        {file && (
          <span className="truncate font-mono text-code" data-slot="diff-view-file">
            {file}
          </span>
        )}
        {summary && <span className="truncate">{summary}</span>}
      </div>
      {stats && (
        <div data-slot="diff-view-stats" className="flex shrink-0 items-center gap-2 tabular-nums">
          <span className="sr-only">
            {t("ai.diffView.statsSummary", {
              additions: stats.additions,
              deletions: stats.deletions,
            })}
          </span>
          <span aria-hidden="true" className="font-mono text-success-text">
            +{stats.additions}
          </span>
          <span aria-hidden="true" className="font-mono text-destructive-text">
            {"−"}
            {stats.deletions}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Pager (absorbs the upstream CodexDiff shape) ──────────────────────────

function DiffViewPager({
  children,
  regionLabel,
}: {
  children: React.ReactNode;
  regionLabel: string;
}) {
  const { t } = useLocale();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [percent, setPercent] = useState(0);

  const updatePercent = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setPercent(max <= 0 ? 100 : Math.round((el.scrollTop / max) * 100));
  }, []);

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    switch (event.key) {
      case "ArrowDown":
        el.scrollBy({ top: 24 });
        break;
      case "ArrowUp":
        el.scrollBy({ top: -24 });
        break;
      case "PageDown":
        el.scrollBy({ top: el.clientHeight });
        break;
      case "PageUp":
        el.scrollBy({ top: -el.clientHeight });
        break;
      case "Home":
        el.scrollTo({ top: 0 });
        break;
      case "End":
        el.scrollTo({ top: el.scrollHeight });
        break;
      default:
        return;
    }
    event.preventDefault();
  }, []);

  return (
    <div
      data-slot="diff-view-pager"
      role="region"
      aria-label={regionLabel}
      className="flex flex-col"
    >
      <div
        ref={scrollRef}
        tabIndex={0}
        onScroll={updatePercent}
        onKeyDown={onKeyDown}
        className="max-h-[32rem] overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        {children}
      </div>
      <div
        data-slot="diff-view-pager-footer"
        className="flex items-center justify-between border-t bg-muted/50 px-3 py-1.5 text-meta text-muted-foreground"
      >
        <span>{t("ai.diffView.pagerLegend")}</span>
        <span aria-hidden="true" className="tabular-nums">
          {percent}%
        </span>
      </div>
    </div>
  );
}

// ─── Root ───────────────────────────────────────────────────────────────────

export const DiffView = forwardRef<HTMLDivElement, DiffViewProps>(function DiffView(
  {
    lines,
    file,
    summary,
    stats,
    variant = "inline",
    pager = false,
    language,
    contextLines,
    maxLines,
    loading = false,
    isStreaming = false,
    className,
    ...props
  },
  ref,
) {
  const { t } = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scopeEl, setScopeEl] = useState<Element | null>(null);

  useEffect(() => {
    setScopeEl(getThemeScope(containerRef.current));
  }, []);

  const clippedLines = useMemo(
    () => (maxLines ? lines.slice(0, maxLines) : lines),
    [lines, maxLines],
  );
  const tokens = useDiffTokens(clippedLines, language, scopeEl);
  const { rows, expand } = useDiffRows(clippedLines, contextLines);

  const RowComponent = variant === "split" ? SplitRow : InlineRow;

  const regionLabel = file
    ? `${t("ai.diffView.regionLabel")}: ${file}`
    : t("ai.diffView.regionLabel");

  const body = loading ? (
    <div data-slot="diff-view-body">
      <span role="status" aria-live="polite" className="sr-only">
        {t("ai.diffView.loading")}
      </span>
      {Array.from({
        length: clippedLines.length > 0 ? Math.min(clippedLines.length, 12) : 6,
      }).map((_, i) => (
        // oxlint-disable-next-line eslint(react/no-array-index-key) -- fixed-count placeholder rows
        <SkeletonRow key={i} />
      ))}
    </div>
  ) : (
    <div data-slot="diff-view-body">
      {rows.map((row) =>
        row.kind === "collapsed" ? (
          <CollapsedRow
            key={`collapsed-${row.runStart}`}
            hiddenCount={row.hiddenCount}
            onExpand={() => expand(row.runStart)}
          />
        ) : (
          <RowComponent
            key={row.index}
            line={row.line}
            index={row.index}
            tokens={tokens?.get(row.index)}
          />
        ),
      )}
    </div>
  );

  return (
    <div
      ref={(node) => {
        containerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      data-slot="diff-view"
      className={cn("overflow-hidden rounded-md border bg-background text-foreground", className)}
      {...props}
    >
      {(file || summary || stats) && <DiffViewHeader file={file} summary={summary} stats={stats} />}
      {pager ? <DiffViewPager regionLabel={regionLabel}>{body}</DiffViewPager> : body}
      {isStreaming && (
        <div
          className="flex items-center gap-2 border-t bg-muted/80 px-3 py-1.5 text-caption text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <Shimmer>{t("ai.codeBlock.generating")}</Shimmer>
        </div>
      )}
    </div>
  );
});
