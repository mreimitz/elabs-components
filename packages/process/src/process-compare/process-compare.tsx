"use client";

/**
 * ProcessCompare — side-by-side or superimposed diff of two process maps (RM-064).
 *
 * ## What it is
 *
 * A composition, like every other view in this package: `side-by-side` renders two
 * `CompareSide` panels — each a plain `ProcessMap` — with ONE `AbstractionControls` above
 * both (fanned out to both maps, the same "lift state, drive two children" shape
 * `useProcessExplorer` already uses for a single map); `superimposed` renders a SINGLE
 * `ProcessMap` over the union of both graphs. Either way, `CompareKpiStrip` reads underneath
 * — cases and median throughput, A vs B, with a delta on B's tile.
 *
 * ## The diff channel is never colour alone
 *
 * Superimposed mode paints each activity's accent swatch with a diff-state colour token
 * (`--success` common, `--chart-1` A-only, `--destructive` B-only — {@link diffColorScale})
 * AND appends the diff state as real text to the activity's own title
 * ({@link withDiffLabels}) — the same text a screen reader announces as part of the node's
 * accessible name, not a decorative glyph a colour-blind or non-visual reader could miss
 * (WCAG 1.4.1). The `Legend` alongside states the same three words. Transitions carry no
 * diff encoding of their own: `ProcessMap` has no per-edge colour hook to repurpose the way
 * `colorScale` lets a node's accent be repurposed, and adding one is a `ProcessMap` change
 * outside this item's scope (see this component's own module test for the deviation this
 * records).
 *
 * ## No new `ProcessMap` prop
 *
 * Both modes compose the SHIPPED `ProcessMap` twice or once — no fork, no new prop on it.
 * One consequence: `ProcessMap` exposes no viewport ref or controlled-viewport prop, so
 * `side-by-side`'s two `CanvasShell`s cannot be zoom/pan-synced from outside it. The
 * roadmap's `onZoomSync` is therefore NOT implemented here — a prop that could only ever be
 * a no-op is a worse API than no prop at all (see `.claude/rules/conventions.md`'s "no
 * speculative props"). Two panes with independent pan/zoom, laid out side by side so a
 * reader can still eyeball the same region on both, is what ships.
 */
import { forwardRef, useId, useMemo, useState, type HTMLAttributes } from "react";
import { Table2 } from "lucide-react";
import { Label, Switch, useLocale } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { Legend, type FlowLayoutDirection } from "@elabs-ai/components-flow";
import { abstractGraph, type AbstractionOptions } from "../core/abstract-graph";
import { diffGraphs } from "../core/diff-graphs";
import type { EventLog, ProcessGraph } from "../core/types";
import { AbstractionControls } from "../abstraction-controls/abstraction-controls";
import { ProcessMap, type ProcessMapProps } from "../process-map/process-map";
import { CompareKpiStrip } from "./compare-kpi-strip";
import { CompareSide } from "./compare-side";
import { resolveCompareKpis, withDiffLabels } from "./compare-model";
import { diffColorScale, diffToProcessGraph, EMPTY_PROCESS_GRAPH } from "./diff-to-graph";

/** One side of the comparison. */
export interface ProcessCompareSide {
  /** How this side is named in headers, the KPI strip and the diff legend/labels. */
  label: string;
  /** A discovered graph. `undefined` while this side is still loading. */
  graph: ProcessGraph | undefined;
  /** The raw log, for `CompareKpiStrip`'s median-throughput reading. Optional. */
  log?: EventLog;
}

export type ProcessCompareMode = "side-by-side" | "superimposed";

export interface ProcessCompareProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
  a: ProcessCompareSide;
  b: ProcessCompareSide;
  /** @default "side-by-side" */
  mode?: ProcessCompareMode;
  metric: ProcessMapProps["metric"];
  /** Shared abstraction, synced across both sides (or the one superimposed map). */
  abstraction: AbstractionOptions;
  onAbstractionChange(next: Partial<AbstractionOptions>): void;
  /** @default "TB" */
  direction?: FlowLayoutDirection;
  /** Neither side has a graph yet. Renders every map's own loading panel. @default false */
  loading?: boolean;
  /** Accessible name for the region. Defaults to the localized `process.compare.label`. */
  label?: string;
}

/** ProcessMap's own narrower abstraction shape — `AbstractionControls` needs the full options. */
function toMapAbstraction(
  abstraction: AbstractionOptions,
): Pick<AbstractionOptions, "activities" | "paths"> {
  return { activities: abstraction.activities, paths: abstraction.paths };
}

/**
 * Side-by-side or superimposed diff of two process maps.
 *
 * @example
 * ```tsx
 * <ProcessCompare
 *   a={{ label: "Before", graph: beforeGraph }}
 *   b={{ label: "After", graph: afterGraph }}
 *   metric={{ node: "absolute_case", edge: "absolute" }}
 *   abstraction={abstraction}
 *   onAbstractionChange={setAbstraction}
 * />
 * ```
 */
export const ProcessCompare = forwardRef<HTMLDivElement, ProcessCompareProps>(
  function ProcessCompare(
    {
      a,
      b,
      mode = "side-by-side",
      metric,
      abstraction,
      onAbstractionChange,
      direction = "TB",
      loading = false,
      label,
      className,
      ...props
    },
    ref,
  ) {
    const { t } = useLocale();
    const tableViewId = useId();
    const [tableView, setTableView] = useState(false);

    const mapAbstraction = useMemo(() => toMapAbstraction(abstraction), [abstraction]);

    // The union of both sides — read for the ONE shared `AbstractionControls` (both modes)
    // and, in superimposed mode, for the single map's own `graph` prop below. Computed
    // unconditionally: it is a cheap linear scan, and building it once keeps the "auto"
    // heuristic's reference graph and the superimposed render byte-identical rather than two
    // independently-maintained unions.
    const diff = useMemo(
      () => diffGraphs(a.graph ?? EMPTY_PROCESS_GRAPH, b.graph ?? EMPTY_PROCESS_GRAPH),
      [a.graph, b.graph],
    );
    const unionGraph = useMemo(() => diffToProcessGraph(diff), [diff]);
    const abstracted = useMemo(
      () => abstractGraph(unionGraph, abstraction),
      [unionGraph, abstraction],
    );

    const aKpis = useMemo(() => resolveCompareKpis(a), [a]);
    const bKpis = useMemo(() => resolveCompareKpis(b), [b]);

    const superimposedGraph = useMemo(
      () => withDiffLabels(unionGraph, diff, a.label, b.label, t),
      [unionGraph, diff, a.label, b.label, t],
    );
    const superimposedColorScale = useMemo(() => diffColorScale(diff), [diff]);

    return (
      <div
        ref={ref}
        data-slot="process-compare"
        role="group"
        aria-label={label ?? t("process.compare.label")}
        className={cn("flex flex-col gap-4", className)}
        {...props}
      >
        <div
          data-slot="process-compare-toolbar"
          className="flex flex-wrap items-start justify-between gap-3"
        >
          <AbstractionControls
            abstraction={abstraction}
            onAbstractionChange={onAbstractionChange}
            graph={abstracted}
            hiddenCounts={abstracted.hidden}
          />
          <div className="flex items-center gap-2">
            <Switch id={tableViewId} checked={tableView} onCheckedChange={setTableView} />
            <Label htmlFor={tableViewId} className="inline-flex items-center gap-1.5 text-body">
              <Table2 aria-hidden="true" className="size-4" />
              {t("process.compare.tableView")}
            </Label>
          </div>
        </div>

        {mode === "superimposed" ? (
          <div data-slot="process-compare-superimposed" className="flex flex-col gap-3">
            <Legend
              variant="categorical"
              title={t("process.compare.legendTitle")}
              items={[
                { label: t("process.compare.diffSuffixCommon"), color: "var(--success)" },
                {
                  label: t("process.compare.diffSuffixOnly", { label: a.label }),
                  color: "var(--chart-1)",
                },
                {
                  label: t("process.compare.diffSuffixOnly", { label: b.label }),
                  color: "var(--destructive)",
                },
              ]}
            />
            <div className="min-h-96 flex-1">
              <ProcessMap
                graph={superimposedGraph}
                metric={metric}
                abstraction={mapAbstraction}
                direction={direction}
                colorScale={superimposedColorScale}
                tableView={tableView}
                loading={loading}
                label={t("process.compare.superimposedMapLabel", {
                  aLabel: a.label,
                  bLabel: b.label,
                })}
                className="size-full"
              />
            </div>
          </div>
        ) : (
          <div data-slot="process-compare-sides" className="grid gap-4 md:grid-cols-2">
            <CompareSide
              label={a.label}
              map={{
                graph: a.graph,
                log: a.log,
                metric,
                abstraction: mapAbstraction,
                direction,
                tableView,
                loading,
                label: t("process.compare.mapLabel", { label: a.label }),
              }}
            />
            <CompareSide
              label={b.label}
              map={{
                graph: b.graph,
                log: b.log,
                metric,
                abstraction: mapAbstraction,
                direction,
                tableView,
                loading,
                label: t("process.compare.mapLabel", { label: b.label }),
              }}
            />
          </div>
        )}

        <CompareKpiStrip
          a={{ label: a.label, kpis: aKpis }}
          b={{ label: b.label, kpis: bKpis }}
          loading={loading}
        />
      </div>
    );
  },
);
