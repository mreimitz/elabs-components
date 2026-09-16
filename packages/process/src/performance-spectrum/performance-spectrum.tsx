"use client";

/**
 * PerformanceSpectrum — segments × time, one line per case (RM-060, issue #209, §4 R15).
 *
 * ProM's performance spectrum: a fixed, chosen sequence of segments (`from → to` pairs)
 * stacked as rows, all sharing one absolute-time x-axis. In `mode="lines"` every
 * occurrence is a line from `(start, row top)` to `(end, row bottom)`, so a steep line is
 * fast, a slanted one slow, parallel lines are FIFO, crossing lines overtake, and a
 * bundle converging on one instant is a batch. `mode="aggregated"` trades the lines for
 * one bar per `binSize` bucket (height = cases entering, fill = median quartile).
 *
 * ## Composition, not re-authoring
 *
 * Marks paint on `@elabs-ai/components-charts`'s `CanvasLayer` (RM-046) — never SVG — one
 * layer per row, which is also what makes the keyboard contract fall out: each row's
 * layer owns ONE tab stop, so `Tab` moves row by row, the arrow keys walk that row's
 * occurrences in time order, and `Enter` activates the focused occurrence's case. Hover
 * hit-testing uses the charts `createSpatialGrid`; the tooltip is `ChartTooltipContent`;
 * the colour key is `Legend`; the ramp is `resolvePalette("sequential")`, the one
 * `HeatmapChart` uses.
 *
 * ## Colour is never the only channel
 *
 * A line's quartile colour is REDUNDANT with its geometry: the horizontal run of a line
 * is its duration. Every occurrence and bar also speaks its quartile in words through the
 * layer's cursor, each row carries a parallel summary (count, cases, median, p90), and
 * `tableView` renders the same numbers as a table. The sequential ramp is
 * lightness-monotonic, so the quartiles also separate in greyscale.
 *
 * ## It emits; it never filters
 *
 * Dragging across the time axis (or Shift+Arrow then Enter on it) calls
 * `onFilterIntent({ kind: "cases", ids })` once, with every case that has an occurrence
 * overlapping the range. The spectrum itself never narrows its data (§5.3).
 */
import {
  forwardRef,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  CanvasLayer,
  canvasTokenColor,
  CHART_HAIRLINE_WIDTH,
  ChartTooltipContent,
  createSpatialGrid,
  Legend,
  LegendItemComponent,
  LegendLabel,
  LegendMarker,
  resolvePalette,
  type CanvasLayerRect,
  type SpatialGrid,
} from "@elabs-ai/components-charts";
import {
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
import { discoverGraph } from "../core/discover-graph";
import { asNormalizedLog } from "../core/event-log";
import { extractVariants } from "../core/extract-variants";
import type { FilterSpec } from "../core/filter-log";
import {
  segmentOrderByFrequency,
  segmentOrderForVariant,
  segmentsFor,
  type SegmentDefinition,
} from "../core/segments";
import type { EventLog } from "../core/types";
import { formatDurationMs, type ProcessSelection } from "../process-map/map-model";
import { fillLabel } from "../variant-explorer/variant-explorer-model";
import {
  aggregateSegmentBins,
  buildSpectrumRows,
  casesInRange,
  spectrumDomain,
  spectrumTicks,
  type SpectrumBin,
  type SpectrumLine,
  type SpectrumRow,
} from "./aggregate-segments";
import {
  PERFORMANCE_SPECTRUM_DEFAULT_LABELS,
  PerformanceSpectrumProvider,
  usePerformanceSpectrum,
  type PerformanceSpectrumContextValue,
  type PerformanceSpectrumLabels,
} from "./performance-spectrum-context";

/** One day in ms — the aggregated mode's default bucket. */
export const PERFORMANCE_SPECTRUM_DEFAULT_BIN_SIZE = 86_400_000;
/** Default row height in CSS px when `height` is not given. */
export const PERFORMANCE_SPECTRUM_ROW_HEIGHT = 56;
/** Default number of segment rows. */
export const PERFORMANCE_SPECTRUM_SEGMENT_LIMIT = 12;

/** Which segments a spectrum shows, in row order. */
export type PerformanceSpectrumOrder = SegmentDefinition[] | "frequency" | { variantId: string };

/** The one intent the spectrum emits — a `/core` `FilterSpec`, straight into `filterLog`. */
export type PerformanceSpectrumFilterIntent = Extract<FilterSpec, { kind: "cases" }>;

/** Props for {@link PerformanceSpectrum}. */
export interface PerformanceSpectrumProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  log: EventLog;
  /** Row order: explicit segments, the busiest transitions, or one variant's path. @default "frequency" */
  order?: PerformanceSpectrumOrder;
  /** At most this many rows, whichever `order` is used. @default 12 */
  segmentLimit?: number;
  /** One line per occurrence, or one bar per time bucket. @default "lines" */
  mode?: "lines" | "aggregated";
  /** Bucket width in ms, aggregated mode only. @default 86_400_000 (1 day) */
  binSize?: number;
  /** Rows whose segment is (or touches) the selected transition/activity are marked. */
  selection?: ProcessSelection | null;
  /** When given, the time axis becomes a brush that emits `{ kind: "cases", ids }`. */
  onFilterIntent?: (intent: PerformanceSpectrumFilterIntent) => void;
  /** Click or `Enter` on an occurrence (lines) or on a bar's first case (aggregated). */
  onCaseSelect?: (caseId: string, occurrence: SpectrumLine) => void;
  /** Total plot height in CSS px, split evenly across rows (min 24 px a row). */
  height?: number;
  /** Render the accessible table twin instead of the chart. @default false */
  tableView?: boolean;
  /** Data not ready yet — renders the loading panel. */
  loading?: boolean;
  /** Override any user-visible string. */
  labels?: Partial<PerformanceSpectrumLabels>;
}

/** `var(--chart-seq-3)` → `--chart-seq-3`, the name `canvasTokenColor` resolves. */
function tokenName(reference: string): string {
  return /var\((--[\w-]+)\)/.exec(reference)?.[1] ?? reference;
}

/** A canvas-safe ink when a token cannot be resolved — a CSS system colour, never a literal. */
const INK_FALLBACK = "CanvasText";

/** Hover sample spacing along a line, in CSS px; kept under the grid's hit radius. */
const LINE_SAMPLE_PX = 6;
const LINE_SAMPLE_MAX = 64;
const HIT_RADIUS = 8;

function isRowSelected(row: SpectrumRow, selection: ProcessSelection | null | undefined): boolean {
  if (!selection) return false;
  if (selection.kind === "transition") return selection.id === row.key;
  return row.definition.from === selection.id || row.definition.to === selection.id;
}

interface SpectrumRowProps {
  row: SpectrumRow;
  bins: SpectrumBin[] | null;
  maxBinCount: number;
  selected: boolean;
}

/** One segment row — a `CanvasLayer` painting either lines or bars. */
function PerformanceSpectrumRow({ row, bins, maxBinCount, selected }: SpectrumRowProps) {
  const ctx = usePerformanceSpectrum();
  const { labels, domain, ticks, rowHeight, quartileColors, formatInstant, formatDuration } = ctx;
  const [d0, d1] = domain;
  const span = d1 - d0;
  const widthRef = useRef(0);
  const gridRef = useRef<{ width: number; grid: SpatialGrid<SpectrumLine> } | null>(null);

  const xOf = useCallback((t: number, width: number) => ((t - d0) / span) * width, [d0, span]);

  const binIndex = useMemo(() => {
    const map = new Map<number, SpectrumBin>();
    if (!bins) return map;
    for (const bin of bins) map.set(Math.round((bin.start - d0) / ctx.binSize), bin);
    return map;
  }, [bins, d0, ctx.binSize]);

  const barGeometry = useCallback(
    (bin: SpectrumBin, width: number): CanvasLayerRect => {
      const x = xOf(bin.start, width);
      const w = Math.max(1, xOf(bin.end, width) - x - 1);
      const h = Math.max(1, (bin.count / Math.max(1, maxBinCount)) * (rowHeight - 4));
      return { x, y: rowHeight - h, width: w, height: h };
    },
    [maxBinCount, rowHeight, xOf],
  );

  const draw = (c: CanvasRenderingContext2D, scales: { width: number; height: number }) => {
    const { width, height } = scales;
    widthRef.current = width;
    const el = c.canvas;

    c.strokeStyle = canvasTokenColor("--chart-grid", el, INK_FALLBACK);
    c.lineWidth = CHART_HAIRLINE_WIDTH;
    c.beginPath();
    for (const tick of ticks) {
      const x = Math.round(xOf(tick, width)) + 0.5;
      c.moveTo(x, 0);
      c.lineTo(x, height);
    }
    c.stroke();

    const inks = quartileColors.map((ref) => canvasTokenColor(tokenName(ref), el, INK_FALLBACK));

    if (bins) {
      for (const bin of bins) {
        const rect = barGeometry(bin, width);
        c.fillStyle = inks[bin.quartile - 1] as string;
        c.fillRect(rect.x, rect.y, rect.width, rect.height);
      }
      return;
    }

    c.lineWidth = 1;
    // Fastest first, slowest last: the slow lines — the ones worth finding — sit on top.
    for (let q = 1; q <= 4; q += 1) {
      c.strokeStyle = inks[q - 1] as string;
      c.beginPath();
      for (const line of row.lines) {
        if (line.quartile !== q) continue;
        c.moveTo(xOf(line.start, width), 1);
        c.lineTo(xOf(line.end, width), height - 1);
      }
      c.stroke();
    }
  };

  const lineGrid = (width: number): SpatialGrid<SpectrumLine> => {
    const cached = gridRef.current;
    if (cached && cached.width === width) return cached.grid;
    const grid = createSpatialGrid<SpectrumLine>(HIT_RADIUS);
    for (const line of row.lines) {
      const x0 = xOf(line.start, width);
      const x1 = xOf(line.end, width);
      const steps = Math.min(
        LINE_SAMPLE_MAX,
        Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), rowHeight) / LINE_SAMPLE_PX)),
      );
      for (let k = 0; k <= steps; k += 1) {
        const f = k / steps;
        grid.insert(x0 + (x1 - x0) * f, rowHeight * f, line);
      }
    }
    gridRef.current = { width, grid };
    return grid;
  };

  const hitTest = (x: number, y: number): SpectrumLine | SpectrumBin | null => {
    const width = widthRef.current;
    if (width <= 0) return null;
    if (bins) {
      const t = d0 + (x / width) * span;
      return binIndex.get(Math.floor((t - d0) / ctx.binSize)) ?? null;
    }
    return lineGrid(width).query(x, y, HIT_RADIUS);
  };

  const isBin = (datum: SpectrumLine | SpectrumBin): datum is SpectrumBin => "count" in datum;

  const focusRect = (datum: SpectrumLine | SpectrumBin): CanvasLayerRect => {
    const width = widthRef.current;
    if (isBin(datum)) {
      const rect = barGeometry(datum, width);
      return {
        x: rect.x - 2,
        y: Math.max(1, rect.y - 2),
        width: rect.width + 4,
        height: rect.height + 1,
      };
    }
    const x0 = xOf(datum.start, width);
    const x1 = xOf(datum.end, width);
    return { x: Math.min(x0, x1) - 3, y: 1, width: Math.abs(x1 - x0) + 6, height: rowHeight - 2 };
  };

  const labelFor = (datum: SpectrumLine | SpectrumBin): string =>
    isBin(datum)
      ? fillLabel(labels.bin, {
          start: formatInstant(datum.start),
          end: formatInstant(datum.end),
          count: datum.count,
          median: formatDuration(datum.medianDuration),
          quartile: ctx.quartileName(datum.quartile),
        })
      : fillLabel(labels.occurrence, {
          caseId: datum.caseId,
          start: formatInstant(datum.start),
          end: formatInstant(datum.end),
          duration: formatDuration(datum.duration),
          quartile: ctx.quartileName(datum.quartile),
        });

  const segmentLabel =
    row.definition.label ??
    fillLabel(labels.segment, { from: row.definition.from, to: row.definition.to });

  const renderTooltip = (datum: SpectrumLine | SpectrumBin) => {
    const color = quartileColors[datum.quartile - 1] as string;
    const quartile = ctx.quartileName(datum.quartile);
    return isBin(datum) ? (
      <ChartTooltipContent
        title={segmentLabel}
        rows={[
          { color, label: labels.tooltipStart, value: formatInstant(datum.start) },
          { color, label: labels.tooltipEnd, value: formatInstant(datum.end) },
          { color, label: labels.tooltipCount, value: String(datum.count) },
          { color, label: labels.tooltipMedian, value: formatDuration(datum.medianDuration) },
          { color, label: labels.tooltipQuartile, value: quartile },
        ]}
      />
    ) : (
      <ChartTooltipContent
        title={datum.caseId}
        rows={[
          { color, label: labels.tooltipSegment, value: segmentLabel },
          { color, label: labels.tooltipStart, value: formatInstant(datum.start) },
          { color, label: labels.tooltipEnd, value: formatInstant(datum.end) },
          { color, label: labels.tooltipDuration, value: formatDuration(datum.duration) },
          { color, label: labels.tooltipQuartile, value: quartile },
        ]}
      />
    );
  };

  const activate = (datum: SpectrumLine | SpectrumBin) => {
    if (!ctx.onCaseSelect) return;
    if (isBin(datum)) {
      const first = row.lines.find((l) => l.start >= datum.start && l.start < datum.end);
      if (first) ctx.onCaseSelect(first.caseId, first);
      return;
    }
    ctx.onCaseSelect(datum.caseId, datum);
  };

  const points: Array<SpectrumLine | SpectrumBin> = bins ?? row.lines;
  const first = row.lines[0];
  const last = row.lines[row.lines.length - 1];
  const drawSignature = [
    row.key,
    row.lines.length,
    first?.start,
    last?.end,
    bins ? `bins:${bins.length}:${ctx.binSize}:${maxBinCount}` : "lines",
    d0,
    d1,
    ticks.length,
    rowHeight,
  ].join("|");

  return (
    <div
      data-slot="performance-spectrum-row"
      data-selected={selected ? "" : undefined}
      className="border-t border-border-strong"
    >
      <CanvasLayer<SpectrumLine | SpectrumBin>
        accessibleLabel={selected ? `${segmentLabel}, ${labels.selected}` : segmentLabel}
        accessibleDescription={fillLabel(labels.rowSummary, {
          count: row.lines.length,
          cases: row.caseCount,
          median: formatDuration(row.medianDuration),
          p90: formatDuration(row.p90Duration),
        })}
        draw={draw}
        drawSignature={drawSignature}
        focusRect={focusRect}
        height={rowHeight}
        hitTest={hitTest}
        labelFor={labelFor}
        onDatapointActivate={activate}
        points={points}
        renderTooltip={renderTooltip}
        style={{ height: rowHeight }}
      />
    </div>
  );
}

/**
 * The performance spectrum.
 *
 * @example
 * ```tsx
 * <PerformanceSpectrum
 *   log={explorer.filteredLog}
 *   order="frequency"
 *   onFilterIntent={(intent) => setCaseFilter(intent)}
 * />
 * ```
 */
export const PerformanceSpectrum = forwardRef<HTMLDivElement, PerformanceSpectrumProps>(
  function PerformanceSpectrum(
    {
      log,
      order = "frequency",
      segmentLimit = PERFORMANCE_SPECTRUM_SEGMENT_LIMIT,
      mode = "lines",
      binSize = PERFORMANCE_SPECTRUM_DEFAULT_BIN_SIZE,
      selection,
      onFilterIntent,
      onCaseSelect,
      height,
      tableView = false,
      loading = false,
      labels: labelOverrides,
      className,
      ...props
    },
    ref,
  ) {
    const { formatDate } = useLocale();
    const labels = useMemo<PerformanceSpectrumLabels>(
      () => ({ ...PERFORMANCE_SPECTRUM_DEFAULT_LABELS, ...labelOverrides }),
      [labelOverrides],
    );

    const normalized = useMemo(() => asNormalizedLog(log), [log]);

    // `order` is often an inline literal (`{ variantId }`), so key the derivation on its
    // CONTENT rather than its identity — re-extracting variants on every render is the
    // most expensive thing this component could do by accident.
    const orderKey = JSON.stringify(order);
    const resolvedOrder = useMemo<SegmentDefinition[]>(() => {
      const limit = Math.max(0, Math.floor(segmentLimit));
      const parsed = JSON.parse(orderKey) as PerformanceSpectrumOrder;
      if (parsed === "frequency") return segmentOrderByFrequency(discoverGraph(normalized), limit);
      if (Array.isArray(parsed)) return parsed.slice(0, limit);
      const variant = extractVariants(normalized).find((v) => v.id === parsed.variantId);
      return variant ? segmentOrderForVariant(variant).slice(0, limit) : [];
    }, [normalized, orderKey, segmentLimit]);

    const rows = useMemo(
      () => buildSpectrumRows(resolvedOrder, segmentsFor(normalized, resolvedOrder)),
      [normalized, resolvedOrder],
    );
    const domain = useMemo(() => spectrumDomain(rows), [rows]);
    const ticks = useMemo(() => spectrumTicks(domain), [domain]);
    const occurrenceCount = rows.reduce((n, row) => n + row.lines.length, 0);

    const binsByRow = useMemo(
      () =>
        mode === "aggregated"
          ? rows.map((row) => aggregateSegmentBins(row, binSize, domain[0]))
          : null,
      [binSize, domain, mode, rows],
    );
    const maxBinCount = useMemo(
      () =>
        binsByRow
          ? binsByRow.reduce((m, bins) => bins.reduce((mm, b) => Math.max(mm, b.count), m), 0)
          : 0,
      [binsByRow],
    );

    const rowHeight =
      height !== undefined && rows.length > 0
        ? Math.max(24, Math.floor(height / rows.length))
        : PERFORMANCE_SPECTRUM_ROW_HEIGHT;

    const spanMs = domain[1] - domain[0];
    const formatInstant = useCallback(
      (ms: number) => formatDate(ms, { dateStyle: "medium", timeStyle: "short" }),
      [formatDate],
    );
    const formatTick = useCallback(
      (ms: number) =>
        spanMs > 2 * 86_400_000
          ? formatDate(ms, { month: "short", day: "numeric" })
          : formatDate(ms, { hour: "2-digit", minute: "2-digit" }),
      [formatDate, spanMs],
    );
    const quartileName = useCallback(
      (q: number) => {
        const base = fillLabel(labels.quartile, { n: q });
        if (q === 1) return `${base} (${labels.quartileFastest})`;
        if (q === 4) return `${base} (${labels.quartileSlowest})`;
        return base;
      },
      [labels],
    );

    const quartileColors = useMemo(() => resolvePalette("sequential", 4), []);

    const contextValue = useMemo<PerformanceSpectrumContextValue>(
      () => ({
        labels,
        mode,
        binSize: Number.isFinite(binSize) && binSize > 0 ? binSize : 1,
        domain,
        ticks,
        rowHeight,
        quartileColors,
        formatInstant,
        formatDuration: formatDurationMs,
        quartileName,
        onCaseSelect,
      }),
      [
        binSize,
        domain,
        formatInstant,
        labels,
        mode,
        onCaseSelect,
        quartileColors,
        quartileName,
        rowHeight,
        ticks,
      ],
    );

    // ── Brush ──────────────────────────────────────────────────────────────────
    const trackRef = useRef<HTMLDivElement | null>(null);
    const hintId = useId();
    const [brush, setBrush] = useState<{ from: number; to: number } | null>(null);
    const [caret, setCaret] = useState<number | null>(null);
    const [trackFocused, setTrackFocused] = useState(false);
    const anchorRef = useRef<number | null>(null);
    const dragRef = useRef<{ pointerId: number; startX: number } | null>(null);

    const timeAt = (clientX: number): number | null => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0 || !Number.isFinite(clientX)) return null;
      const f = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return domain[0] + f * spanMs;
    };

    const commit = (range: { from: number; to: number } | null) => {
      if (!onFilterIntent || !range) return;
      const lo = Math.min(range.from, range.to);
      const hi = Math.max(range.from, range.to);
      if (hi <= lo) return;
      onFilterIntent({ kind: "cases", ids: casesInRange(rows, lo, hi) });
    };

    const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
      const t = timeAt(event.clientX);
      if (t === null) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      dragRef.current = { pointerId: event.pointerId, startX: event.clientX };
      anchorRef.current = t;
      setBrush({ from: t, to: t });
    };
    const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
      if (dragRef.current?.pointerId !== event.pointerId || anchorRef.current === null) return;
      const t = timeAt(event.clientX);
      if (t !== null) setBrush({ from: anchorRef.current, to: t });
    };
    const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (drag?.pointerId !== event.pointerId || anchorRef.current === null) return;
      dragRef.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      const t = timeAt(event.clientX);
      // A click (under 3 px of travel) clears rather than filtering to an instant.
      if (t === null || Math.abs(event.clientX - drag.startX) < 3) {
        setBrush(null);
        anchorRef.current = null;
        return;
      }
      const range = { from: anchorRef.current, to: t };
      setBrush(range);
      anchorRef.current = null;
      commit(range);
    };

    const onTrackKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      const step = spanMs / 48;
      const current = caret ?? domain[0];
      let next: number | null = null;
      switch (event.key) {
        case "ArrowRight":
          next = current + step;
          break;
        case "ArrowLeft":
          next = current - step;
          break;
        case "PageUp":
          next = current + step * 6;
          break;
        case "PageDown":
          next = current - step * 6;
          break;
        case "Home":
          next = domain[0];
          break;
        case "End":
          next = domain[1];
          break;
        case "Enter":
          event.preventDefault();
          commit(brush);
          return;
        case "Escape":
          event.preventDefault();
          setBrush(null);
          anchorRef.current = null;
          return;
        default:
          return;
      }
      event.preventDefault();
      const clamped = Math.min(domain[1], Math.max(domain[0], next));
      if (event.shiftKey) {
        if (anchorRef.current === null) anchorRef.current = current;
        setBrush({ from: anchorRef.current, to: clamped });
      } else {
        anchorRef.current = null;
      }
      setCaret(clamped);
    };

    const pct = (t: number) => `${((t - domain[0]) / spanMs) * 100}%`;
    const brushText =
      brush && brush.from !== brush.to
        ? fillLabel(labels.brushRange, {
            start: formatInstant(Math.min(brush.from, brush.to)),
            end: formatInstant(Math.max(brush.from, brush.to)),
            count: casesInRange(rows, brush.from, brush.to).length,
          })
        : "";

    // ── States ─────────────────────────────────────────────────────────────────
    if (loading) {
      return (
        <div
          ref={ref}
          data-slot="performance-spectrum"
          data-state="loading"
          className={cn("relative flex h-72 flex-col", className)}
          {...props}
        >
          <StatePanel kind="loading" title={labels.loading} />
        </div>
      );
    }

    if (occurrenceCount === 0) {
      return (
        <div
          ref={ref}
          data-slot="performance-spectrum"
          data-state="empty"
          className={cn("relative flex h-72 flex-col", className)}
          {...props}
        >
          <StatePanel kind="empty" title={labels.empty} description={labels.emptyBody} />
        </div>
      );
    }

    const segmentLabel = (row: SpectrumRow) =>
      row.definition.label ??
      fillLabel(labels.segment, { from: row.definition.from, to: row.definition.to });

    if (tableView) {
      return (
        <div
          ref={ref}
          data-slot="performance-spectrum"
          data-view="table"
          className={cn("flex flex-col gap-3", className)}
          {...props}
        >
          <Table data-slot="performance-spectrum-table">
            <TableCaption>{labels.tableCaption}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{labels.columnSegment}</TableHead>
                <TableHead scope="col">{labels.columnCases}</TableHead>
                <TableHead scope="col">{labels.columnMedian}</TableHead>
                <TableHead scope="col">{labels.columnP90}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const selected = isRowSelected(row, selection);
                return (
                  <TableRow key={row.key} data-state={selected ? "selected" : undefined}>
                    <TableCell>
                      {segmentLabel(row)}
                      {selected ? <span className="sr-only">, {labels.selected}</span> : null}
                    </TableCell>
                    <TableCell className="tabular-nums">{row.caseCount}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatDurationMs(row.medianDuration)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatDurationMs(row.p90Duration)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      );
    }

    const legendItems = quartileColors.map((color, i) => ({
      label: quartileName(i + 1),
      value: 0,
      color,
    }));

    return (
      <PerformanceSpectrumProvider value={contextValue}>
        <div
          ref={ref}
          role="group"
          aria-label={labels.label}
          data-slot="performance-spectrum"
          data-view="chart"
          data-mode={mode}
          className={cn("flex min-w-0 flex-col gap-3", className)}
          {...props}
        >
          <div
            data-slot="performance-spectrum-legend"
            className="flex flex-wrap items-center gap-2"
          >
            <span className="text-meta text-muted-foreground">{labels.legend}</span>
            <Legend items={legendItems} className="flex-row flex-wrap gap-1">
              <LegendItemComponent className="flex items-center gap-1.5 px-1.5 py-0.5">
                <LegendMarker />
                <LegendLabel className="text-meta" />
              </LegendItemComponent>
            </Legend>
          </div>

          <div data-slot="performance-spectrum-body" dir="ltr" className="flex min-w-0">
            <div
              aria-hidden="true"
              data-slot="performance-spectrum-gutter"
              className="flex w-40 shrink-0 flex-col"
            >
              {rows.map((row) => {
                const selected = isRowSelected(row, selection);
                return (
                  <div
                    key={row.key}
                    data-selected={selected ? "" : undefined}
                    className={cn(
                      "flex min-w-0 flex-col justify-between border-t border-s-2 border-t-border-strong py-0.5 ps-2 pe-2",
                      selected ? "border-s-primary" : "border-s-transparent",
                    )}
                    style={{ height: rowHeight + 1 }}
                  >
                    <span className={cn("truncate text-meta", selected && "font-medium")}>
                      {row.definition.label ?? row.definition.from}
                    </span>
                    <span className="truncate text-meta text-muted-foreground">
                      {row.definition.label ? "" : row.definition.to}
                    </span>
                  </div>
                );
              })}
            </div>

            <div data-slot="performance-spectrum-plot" className="flex min-w-0 flex-1 flex-col">
              <div className="relative">
                {rows.map((row, index) => (
                  <PerformanceSpectrumRow
                    key={row.key}
                    row={row}
                    bins={binsByRow ? (binsByRow[index] as SpectrumBin[]) : null}
                    maxBinCount={maxBinCount}
                    selected={isRowSelected(row, selection)}
                  />
                ))}
                {brush && brush.from !== brush.to ? (
                  <div
                    aria-hidden="true"
                    data-slot="performance-spectrum-brush"
                    className="pointer-events-none absolute inset-y-0 border-x border-primary bg-primary/10"
                    style={{
                      insetInlineStart: pct(Math.min(brush.from, brush.to)),
                      width: `${(Math.abs(brush.to - brush.from) / spanMs) * 100}%`,
                    }}
                  />
                ) : null}
                {trackFocused && caret !== null ? (
                  <div
                    aria-hidden="true"
                    data-slot="performance-spectrum-caret"
                    className="pointer-events-none absolute inset-y-0 w-0.5 bg-ring"
                    style={{ insetInlineStart: pct(caret) }}
                  />
                ) : null}
              </div>

              <div
                ref={trackRef}
                data-slot="performance-spectrum-axis"
                className={cn(
                  "relative h-8 touch-none select-none border-t border-border-strong",
                  onFilterIntent && "focus-ring-inset cursor-col-resize",
                )}
                {...(onFilterIntent
                  ? {
                      role: "group",
                      tabIndex: 0,
                      "aria-label": labels.brush,
                      "aria-describedby": hintId,
                      onPointerDown,
                      onPointerMove,
                      onPointerUp,
                      onPointerCancel: () => {
                        dragRef.current = null;
                        anchorRef.current = null;
                      },
                      onKeyDown: onTrackKeyDown,
                      onFocus: () => {
                        setTrackFocused(true);
                        setCaret((c) => c ?? domain[0]);
                      },
                      onBlur: () => setTrackFocused(false),
                    }
                  : { "aria-hidden": true })}
              >
                {ticks.map((tick, i) => (
                  <span
                    key={tick}
                    className={cn(
                      "pointer-events-none absolute top-1 whitespace-nowrap text-meta text-muted-foreground tabular-nums",
                      i === 0
                        ? ""
                        : i === ticks.length - 1
                          ? "-translate-x-full"
                          : "-translate-x-1/2",
                    )}
                    style={{ insetInlineStart: pct(tick) }}
                  >
                    {formatTick(tick)}
                  </span>
                ))}
              </div>
              {onFilterIntent ? (
                <>
                  <span id={hintId} className="sr-only">
                    {labels.brushHint}
                  </span>
                  <span
                    role="status"
                    aria-live="polite"
                    data-slot="performance-spectrum-brush-status"
                    className="sr-only"
                  >
                    {brushText}
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </PerformanceSpectrumProvider>
    );
  },
);
