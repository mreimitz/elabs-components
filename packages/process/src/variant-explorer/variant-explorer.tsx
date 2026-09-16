"use client";

/**
 * VariantExplorer — the ranked list of activity sequences (RM-054, issue #203).
 *
 * One row per variant: its activity sequence as colour-keyed chips, how many cases follow
 * it, the share of all cases it covers, and its median end-to-end duration. Multi-select
 * with checkboxes, or let the coverage slider pick "the fewest paths that explain N % of
 * cases" in one move.
 *
 * ## It emits; it never filters
 *
 * `onSelect(ids, mode)` is the whole output. A playbook wires it to
 * `useProcessExplorer().applyIntent({ kind: "variant", ids })` so the map re-derives from
 * the chosen cases; the explorer itself never calls `filterLog`. The list NARROWS rather
 * than ghosts under a filter (decided 2026-09-05): `selectionStates.variants` carries
 * `selected` and only carries `excluded` when a host engine supplies it.
 *
 * ## Shared colours
 *
 * Chips are painted from the SAME `ActivityColorScale` instance `ProcessMap` receives as
 * `colorScale`, through the same `activityAccentStyle`, so an activity is one colour in
 * both views. Colour is never the only channel: every chip prints its label (or two-letter
 * code) and every row has a full accessible name.
 *
 * ## Scale
 *
 * Rows are virtualized with `@tanstack/react-virtual`, so 2 000 variants mount only the
 * rows in view plus a small overscan. Keyboard: the checkboxes form one roving tab stop;
 * Arrow Up/Down, Page Up/Down, Home and End move between rows, Space toggles the focused
 * row, Enter toggles it too (same as a click).
 */
import {
  forwardRef,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Button,
  Slider,
  StatePanel,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useLocale,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import type { ActivityColorScale } from "../core/activity-color-scale";
import type { Variant } from "../core/types";
import {
  formatDurationMs,
  type ProcessSelectionState,
  type ProcessSelectionStates,
} from "../process-map/map-model";
import type { FilterIntent } from "../use-process-explorer";
import {
  fillLabel,
  selectVariantsByCoverage,
  VARIANT_EXPLORER_COLUMNS,
  type VariantExplorerColumn,
} from "./variant-explorer-model";
import { VariantRow, type VariantRowText } from "./variant-row";

/** Row height in px — fixed, so the virtualizer never has to measure. Matches `h-10`. */
export const VARIANT_EXPLORER_ROW_HEIGHT = 40;

/** How a selection change applies: replace the whole selection, or flip these ids. */
export type VariantSelectMode = "replace" | "toggle";

/**
 * Every user-visible string. `{name}` placeholders are filled at render. Override any
 * subset through `labels` to localize.
 */
export interface VariantExplorerLabels {
  /** Accessible name of the list. */
  list: string;
  columnVariant: string;
  columnSequence: string;
  columnCases: string;
  columnCoverage: string;
  columnMedianDuration: string;
  columnState: string;
  /** `{rank}`, `{activities}`, `{cases}`, `{coverage}` (a whole percent number). */
  rowSummary: string;
  /** `{activities}` — the sequence joined with commas. */
  sequence: string;
  activitiesOne: string;
  activitiesOther: string;
  casesOne: string;
  casesOther: string;
  selected: string;
  excluded: string;
  coverageTarget: string;
  /** `{percent}`, `{count}`. */
  coverageTargetValue: string;
  filterToSelected: string;
  tableCaption: string;
  loading: string;
  empty: string;
  emptyBody: string;
}

/** The shipped English labels. */
export const VARIANT_EXPLORER_DEFAULT_LABELS: Readonly<VariantExplorerLabels> = Object.freeze({
  list: "Variants",
  columnVariant: "Variant",
  columnSequence: "Sequence",
  columnCases: "Cases",
  columnCoverage: "Coverage",
  columnMedianDuration: "Median duration",
  columnState: "State",
  rowSummary: "Variant {rank}, {activities}, {cases}, {coverage} percent coverage",
  sequence: "Sequence: {activities}",
  activitiesOne: "{count} activity",
  activitiesOther: "{count} activities",
  casesOne: "{count} case",
  casesOther: "{count} cases",
  selected: "selected",
  excluded: "excluded",
  coverageTarget: "Coverage target",
  coverageTargetValue: "{percent} of cases · {count} variants",
  filterToSelected: "Show only selected variants",
  tableCaption: "Variants — cases, coverage and median duration per activity sequence",
  loading: "Extracting variants…",
  empty: "No variants",
  emptyBody: "No cases match the current filters.",
});

/** Props for {@link VariantExplorer}. `onSelect` shadows the DOM handler, so it is omitted. */
export interface VariantExplorerProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
  /** Variants in `extractVariants` order (count descending). */
  variants: Variant[];
  /** The shared colour scale — hand `ProcessMap` the same instance. */
  colorScale: ActivityColorScale;
  /** Tri-state per variant id; an absent key means `"associated"`. */
  selectionStates?: ProcessSelectionStates;
  /** Fires with the ids to select and how to apply them. The explorer never filters. */
  onSelect: (variantIds: string[], mode: VariantSelectMode) => void;
  /** When given, a button emits `{ kind: "variant", ids }` for the selected variants. */
  onFilterIntent?: (intent: FilterIntent) => void;
  /** Numeric columns to show. @default ["cases", "coverage", "medianDuration"] */
  columns?: VariantExplorerColumn[];
  /**
   * Initial coverage target, `0..1`. When given, a slider selects the smallest prefix of
   * variants whose cumulative share reaches the target (mode `"replace"`).
   */
  coverageTarget?: number;
  /** "Variant DNA" strip: two-character codes instead of full activity labels. */
  abbreviate?: boolean;
  /** Render the accessible table twin instead of the list. @default false */
  tableView?: boolean;
  /** No variants yet. Renders the loading panel rather than an empty list. */
  loading?: boolean;
  /** Override any user-visible string. */
  labels?: Partial<VariantExplorerLabels>;
}

function stateOf(states: ProcessSelectionStates | undefined, id: string): ProcessSelectionState {
  return states?.variants?.[id] ?? "associated";
}

/**
 * The variant explorer.
 *
 * @example
 * ```tsx
 * const scale = useMemo(() => activityColorScale(fullGraph), [fullGraph]);
 * <VariantExplorer
 *   variants={explorer.variants}
 *   colorScale={scale}
 *   selectionStates={explorer.selectionStates}
 *   onSelect={(ids) => explorer.applyIntent({ kind: "variant", ids })}
 * />
 * ```
 */
export const VariantExplorer = forwardRef<HTMLDivElement, VariantExplorerProps>(
  function VariantExplorer(
    {
      variants,
      colorScale,
      selectionStates,
      onSelect,
      onFilterIntent,
      columns = VARIANT_EXPLORER_COLUMNS as VariantExplorerColumn[],
      coverageTarget,
      abbreviate = false,
      tableView = false,
      loading = false,
      labels: labelOverrides,
      className,
      ...props
    },
    ref,
  ) {
    const { locale, formatNumber } = useLocale();
    const labels = useMemo<VariantExplorerLabels>(
      () => ({ ...VARIANT_EXPLORER_DEFAULT_LABELS, ...labelOverrides }),
      [labelOverrides],
    );
    const pluralRules = useMemo(() => new Intl.PluralRules(locale), [locale]);
    const plural = useCallback(
      (count: number, one: string, other: string) =>
        fillLabel(pluralRules.select(count) === "one" ? one : other, {
          count: formatNumber(count),
        }),
      [pluralRules, formatNumber],
    );
    const formatShare = useCallback(
      (share: number) => formatNumber(share, { style: "percent", maximumFractionDigits: 1 }),
      [formatNumber],
    );

    const selectedIds = useMemo(
      () => variants.filter((v) => stateOf(selectionStates, v.id) === "selected").map((v) => v.id),
      [variants, selectionStates],
    );

    const toggle = useCallback((id: string) => onSelect([id], "toggle"), [onSelect]);

    const rowText = useCallback(
      (variant: Variant, rank: number, state: ProcessSelectionState): VariantRowText => {
        const activityNames = variant.sequence.map((id) => colorScale.labelFor(id));
        let summary = fillLabel(labels.rowSummary, {
          rank,
          activities: plural(variant.sequence.length, labels.activitiesOne, labels.activitiesOther),
          cases: plural(variant.count, labels.casesOne, labels.casesOther),
          coverage: formatNumber(Math.round(variant.share * 100)),
        });
        if (state === "selected") summary = `${summary}, ${labels.selected}`;
        if (state === "excluded") summary = `${summary}, ${labels.excluded}`;
        return {
          summary,
          sequence: fillLabel(labels.sequence, { activities: activityNames.join(", ") }),
          cases: formatNumber(variant.count),
          coverage: formatShare(variant.share),
          medianDuration: formatDurationMs(variant.duration.median),
        };
      },
      [colorScale, labels, plural, formatNumber, formatShare],
    );

    // ── Coverage target ────────────────────────────────────────────────────
    const sliderLabelId = useId();
    const [targetPercent, setTargetPercent] = useState(() =>
      Math.round(Math.min(1, Math.max(0, coverageTarget ?? 0)) * 100),
    );
    const targetCount = useMemo(
      () => selectVariantsByCoverage(variants, targetPercent / 100).length,
      [variants, targetPercent],
    );

    // ── Virtualized list + roving focus ────────────────────────────────────
    const scrollRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const virtualizer = useVirtualizer({
      count: variants.length,
      getScrollElement: () => scrollRef.current,
      estimateSize: () => VARIANT_EXPLORER_ROW_HEIGHT,
      overscan: 6,
    });
    const [activeIndex, setActiveIndex] = useState(0);
    const virtualRows = virtualizer.getVirtualItems();
    // The roving tab stop is the last focused row — but only while that row is mounted. Once
    // the reader scrolls it out of the window (wheel, scrollbar), the stop moves to the first
    // row in view, so Tab can always reach the list and never lands on an unmounted row.
    const clampedActive = Math.min(activeIndex, Math.max(0, variants.length - 1));
    const tabIndex = virtualRows.some((item) => item.index === clampedActive)
      ? clampedActive
      : (virtualizer.range?.startIndex ?? virtualRows[0]?.index ?? clampedActive);
    const pendingFocus = useRef<number | null>(null);

    // A row scrolled into view by the keyboard mounts on a LATER render than the key press,
    // so focus is handed over whenever the pending row finally exists. No deps on purpose:
    // it has to look after every render until the row is there.
    useLayoutEffect(() => {
      const index = pendingFocus.current;
      if (index === null) return;
      const checkbox = listRef.current?.querySelector<HTMLElement>(
        `[data-index="${index}"] [data-slot="checkbox"]`,
      );
      if (checkbox) {
        pendingFocus.current = null;
        checkbox.focus();
      }
    });

    const handleKeyDown = useCallback(
      (event: KeyboardEvent<HTMLDivElement>) => {
        if (variants.length === 0) return;
        const last = variants.length - 1;
        const page = Math.max(
          1,
          Math.floor((scrollRef.current?.clientHeight ?? 0) / VARIANT_EXPLORER_ROW_HEIGHT),
        );
        let next: number | null = null;
        switch (event.key) {
          case "ArrowDown":
            next = Math.min(last, tabIndex + 1);
            break;
          case "ArrowUp":
            next = Math.max(0, tabIndex - 1);
            break;
          case "PageDown":
            next = Math.min(last, tabIndex + page);
            break;
          case "PageUp":
            next = Math.max(0, tabIndex - page);
            break;
          case "Home":
            next = 0;
            break;
          case "End":
            next = last;
            break;
          case "Enter": {
            event.preventDefault();
            const variant = variants[tabIndex];
            if (variant) toggle(variant.id);
            return;
          }
          default:
            return;
        }
        event.preventDefault();
        setActiveIndex(next);
        pendingFocus.current = next;
        virtualizer.scrollToIndex(next, { align: "auto" });
      },
      [variants, tabIndex, toggle, virtualizer],
    );

    if (loading) {
      return (
        <div
          ref={ref}
          data-slot="variant-explorer"
          data-state="loading"
          className={cn("relative flex h-96 flex-col", className)}
          {...props}
        >
          <StatePanel kind="loading" title={labels.loading} />
        </div>
      );
    }

    if (variants.length === 0) {
      return (
        <div
          ref={ref}
          data-slot="variant-explorer"
          data-state="empty"
          className={cn("relative flex h-96 flex-col", className)}
          {...props}
        >
          <StatePanel kind="empty" title={labels.empty} description={labels.emptyBody} />
        </div>
      );
    }

    const toolbar =
      coverageTarget !== undefined || onFilterIntent ? (
        <div data-slot="variant-explorer-toolbar" className="flex flex-wrap items-center gap-3">
          {coverageTarget !== undefined ? (
            <div
              data-slot="variant-explorer-coverage-target"
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              <span id={sliderLabelId} className="shrink-0 text-meta text-muted-foreground">
                {labels.coverageTarget}
              </span>
              <Slider
                aria-labelledby={sliderLabelId}
                aria-valuetext={fillLabel(labels.coverageTargetValue, {
                  percent: formatShare(targetPercent / 100),
                  count: formatNumber(targetCount),
                })}
                className="min-w-24 max-w-64 flex-1"
                min={0}
                max={100}
                step={1}
                value={[targetPercent]}
                onValueChange={(value) => setTargetPercent(value[0] ?? 0)}
                onValueCommit={(value) =>
                  onSelect(selectVariantsByCoverage(variants, (value[0] ?? 0) / 100), "replace")
                }
              />
              <span className="shrink-0 text-meta tabular-nums">
                {fillLabel(labels.coverageTargetValue, {
                  percent: formatShare(targetPercent / 100),
                  count: formatNumber(targetCount),
                })}
              </span>
            </div>
          ) : null}
          {onFilterIntent ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ms-auto"
              disabled={selectedIds.length === 0}
              onClick={() => onFilterIntent({ kind: "variant", ids: selectedIds })}
            >
              {labels.filterToSelected}
            </Button>
          ) : null}
        </div>
      ) : null;

    if (tableView) {
      return (
        <div
          ref={ref}
          data-slot="variant-explorer"
          data-view="table"
          className={cn("flex flex-col gap-3", className)}
          {...props}
        >
          {toolbar}
          <Table data-slot="variant-explorer-table">
            <TableCaption>{labels.tableCaption}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{labels.columnVariant}</TableHead>
                <TableHead scope="col">{labels.columnSequence}</TableHead>
                {columns.includes("cases") ? (
                  <TableHead scope="col">{labels.columnCases}</TableHead>
                ) : null}
                {columns.includes("coverage") ? (
                  <TableHead scope="col">{labels.columnCoverage}</TableHead>
                ) : null}
                {columns.includes("medianDuration") ? (
                  <TableHead scope="col">{labels.columnMedianDuration}</TableHead>
                ) : null}
                <TableHead scope="col">{labels.columnState}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variants.map((variant, index) => {
                const state = stateOf(selectionStates, variant.id);
                const text = rowText(variant, index + 1, state);
                return (
                  <TableRow
                    key={variant.id}
                    data-selection={state}
                    data-state={state === "selected" ? "selected" : undefined}
                  >
                    <TableCell className="tabular-nums">{index + 1}</TableCell>
                    <TableCell>
                      {variant.sequence.map((id) => colorScale.labelFor(id)).join(" → ")}
                    </TableCell>
                    {columns.includes("cases") ? (
                      <TableCell className="tabular-nums">{text.cases}</TableCell>
                    ) : null}
                    {columns.includes("coverage") ? (
                      <TableCell className="tabular-nums">{text.coverage}</TableCell>
                    ) : null}
                    {columns.includes("medianDuration") ? (
                      <TableCell className="tabular-nums">{text.medianDuration}</TableCell>
                    ) : null}
                    <TableCell>
                      {state === "selected"
                        ? labels.selected
                        : state === "excluded"
                          ? labels.excluded
                          : ""}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        data-slot="variant-explorer"
        data-view="list"
        className={cn("flex h-96 min-h-0 flex-col gap-3", className)}
        {...props}
      >
        {toolbar}
        <div
          aria-hidden="true"
          data-slot="variant-explorer-header"
          className="flex h-8 shrink-0 items-center gap-3 border-b border-border-strong px-3 text-meta text-muted-foreground"
        >
          <span className="w-4 shrink-0" />
          <span className="w-8 shrink-0">#</span>
          <span className="min-w-0 flex-1">{labels.columnSequence}</span>
          {columns.includes("cases") ? (
            <span className="w-16 shrink-0 text-end">{labels.columnCases}</span>
          ) : null}
          {columns.includes("coverage") ? (
            <span className="w-32 shrink-0">{labels.columnCoverage}</span>
          ) : null}
          {columns.includes("medianDuration") ? (
            <span className="w-20 shrink-0 truncate text-end">{labels.columnMedianDuration}</span>
          ) : null}
        </div>
        <div
          ref={scrollRef}
          data-slot="variant-explorer-viewport"
          className="relative min-h-0 flex-1 overflow-auto"
          onKeyDown={handleKeyDown}
        >
          <div
            ref={listRef}
            role="list"
            aria-label={labels.list}
            data-slot="variant-explorer-list"
            className="relative w-full"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualRows.map((item) => {
              const variant = variants[item.index] as Variant;
              const state = stateOf(selectionStates, variant.id);
              return (
                <VariantRow
                  key={variant.id}
                  aria-setsize={variants.length}
                  aria-posinset={item.index + 1}
                  className="absolute inset-x-0 top-0"
                  style={{ transform: `translateY(${item.start}px)` }}
                  variant={variant}
                  rank={item.index + 1}
                  index={item.index}
                  selectionState={state}
                  colorScale={colorScale}
                  abbreviate={abbreviate}
                  columns={columns}
                  text={rowText(variant, item.index + 1, state)}
                  tabbable={item.index === tabIndex}
                  onToggle={toggle}
                  onFocusRow={setActiveIndex}
                />
              );
            })}
          </div>
        </div>
      </div>
    );
  },
);
