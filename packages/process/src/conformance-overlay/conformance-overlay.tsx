"use client";

/**
 * ConformanceOverlay — the process map read against a reference model (RM-062).
 *
 * A thin composition: `ProcessMap` with its `conformance` prop always set, plus a
 * {@link ConformanceLegend} explaining the three states. It authors no node or edge
 * rendering of its own — the tone, glyph and dash per element come from `ProcessMap`'s own
 * activity node and transition edge, so the overlay and the plain map can never drift
 * (`pnpm check --rule process-reuse`).
 *
 * Every state reaches the reader on three visual channels (tone, glyph, line style) and as
 * text (the accessible name on the canvas, a Conformance column in `tableView`), so the
 * overlay never relies on colour alone (analysis §5.4, WCAG 1.4.1).
 */
import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import type { FlowLayoutDirection } from "@elabs-ai/components-flow";
import type { ConformanceResult } from "../core/conformance";
import type { ProcessGraph } from "../core/types";
import type { ProcessMetricSpec, ProcessSelection } from "../process-map/map-model";
import { ProcessMap, type ProcessMapProps } from "../process-map/process-map";
import { ConformanceLegend } from "./conformance-legend";
import type { ConformanceStateLabels } from "./conformance-state";

/** The metric the overlay paints when none is given: case frequency on both marks. */
export const CONFORMANCE_OVERLAY_DEFAULT_METRIC: ProcessMetricSpec = Object.freeze({
  node: "absolute_case",
  edge: "absolute",
}) as ProcessMetricSpec;

/** Props for {@link ConformanceOverlay}. `onSelect` shadows the DOM handler, so it is omitted. */
export interface ConformanceOverlayProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
  /** The discovered graph to overlay. */
  graph: ProcessGraph;
  /** The replay result (`tokenReplay`) against the reference model. */
  conformance: ConformanceResult;
  /** Which readings the nodes and edges print. @default case frequency */
  metric?: ProcessMetricSpec;
  /** @default "TB" */
  direction?: FlowLayoutDirection;
  /** Controlled selection, passed straight to `ProcessMap`. */
  selection?: ProcessSelection | null;
  onSelect?: ProcessMapProps["onSelect"];
  onFilterIntent?: ProcessMapProps["onFilterIntent"];
  /** Render the accessible table twin instead of the canvas. @default false */
  tableView?: boolean;
  /** No graph or replay yet. Renders the map's loading panel and hides the legend. */
  loading?: boolean;
  /** Override the legend's words. */
  labels?: Partial<ConformanceStateLabels>;
}

/**
 * The conformance overlay.
 *
 * @example
 * ```tsx
 * const model = useMemo(() => liftHappyPath(happyPath), [happyPath]);
 * const conformance = useMemo(() => tokenReplay(log, model), [log, model]);
 * <ConformanceOverlay graph={graph} conformance={conformance} />
 * ```
 */
export const ConformanceOverlay = forwardRef<HTMLDivElement, ConformanceOverlayProps>(
  function ConformanceOverlay(
    {
      graph,
      conformance,
      metric = CONFORMANCE_OVERLAY_DEFAULT_METRIC,
      direction,
      selection,
      onSelect,
      onFilterIntent,
      tableView = false,
      loading = false,
      labels,
      className,
      ...props
    },
    ref,
  ) {
    return (
      <div
        ref={ref}
        data-slot="conformance-overlay"
        data-view={tableView ? "table" : "canvas"}
        className={cn("flex size-full min-h-0 flex-col gap-3", className)}
        {...props}
      >
        {loading ? null : <ConformanceLegend labels={labels} className="self-start" />}
        <div data-slot="conformance-overlay-map" className="min-h-64 flex-1">
          <ProcessMap
            graph={graph}
            metric={metric}
            conformance={conformance}
            direction={direction}
            selection={selection}
            onSelect={onSelect}
            onFilterIntent={onFilterIntent}
            tableView={tableView}
            loading={loading}
          />
        </div>
      </div>
    );
  },
);
