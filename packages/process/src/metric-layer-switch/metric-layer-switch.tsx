"use client";

/**
 * MetricLayerSwitch — the "what number is this graph drawing" control (RM-052, issue
 * #227). A `ProcessMap` always shows SOME number per activity/transition; this component
 * is how a reader picks it.
 *
 * ## Three layers, not just two selects
 *
 * The Frequency/Performance/Rework `ToggleGroup` picks a FAMILY of readings before the
 * two `Select`s narrow to one member of it:
 * - **Frequency** — counts and shares (`ActivityFrequencyMode` / `TransitionFrequencyMode`).
 * - **Performance** — duration aggregates (`PerformanceAgg`) — the same 7-value domain on
 *   both node and edge, so locking is always safe here.
 * - **Rework** — there is no frequency/performance READING for "how much rework happened
 *   at this activity"; that overlay is `ProcessMap`'s own `rework` prop, driven by
 *   `detectRework`, not a `ProcessMetric`. Selecting this layer disables both `Select`s
 *   (and the lock, which has nothing to lock) rather than inventing a metric value that
 *   does not exist — see RM-052-result.md for this interpretation call.
 *
 * ## The lock keeps node and edge metrics in sync — and keeps the domain honest
 *
 * `ActivityFrequencyMode` only ever has 4 members (a node has no "antecedent"/
 * "consequent" side); `TransitionFrequencyMode` has 6. So the LOCKED edge `Select` is
 * restricted to the 4-member intersection — every option it offers is guaranteed valid
 * for the node too — and widens back to all 6 the moment the lock comes off. In the
 * Performance layer both sides already share one domain, so locking never restricts
 * anything there.
 *
 * ## Metric-value labels are REUSED from `ProcessMap`, not re-localized
 *
 * `nodeMetricLabel`/`edgeMetricLabel` (`process-map/map-model.ts`) already resolve every
 * `ProcessMetric` to its correct, audience-specific text — "Occurrences" for a node's
 * `absolute` vs "Transitions" for an edge's, "Share of events" vs "Share of transitions"
 * for `relative`, and so on. Minting a SECOND, shared `process.metricLayerSwitch.metric.*`
 * locale key per value would either duplicate that resolution or (worse) collapse the
 * node/edge distinction those two functions exist to preserve — so this component calls
 * them directly instead, per the reuse-first rule in `.claude/rules/quality-gates.md`.
 */
import { forwardRef, useCallback, useId, useState, type HTMLAttributes } from "react";
import { Lock, LockOpen } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Toggle,
  ToggleGroup,
  ToggleGroupItem,
  useLocale,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  edgeMetricLabel,
  isPerformanceMetric,
  nodeMetricLabel,
  type ProcessMetric,
} from "../process-map/map-model";

export type MetricLayer = "frequency" | "performance" | "rework";

export interface MetricLayerSwitchMetric {
  node: ProcessMetric;
  edge: ProcessMetric;
}

export interface MetricLayerSwitchProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  layer: MetricLayer;
  onLayerChange(layer: MetricLayer): void;
  metric: MetricLayerSwitchMetric;
  onMetricChange(next: Partial<MetricLayerSwitchMetric>): void;
  /** Controlled lock state. Omit to let the component manage it (`defaultLocked`). */
  locked?: boolean;
  /** Initial lock state when uncontrolled. Default `true`. */
  defaultLocked?: boolean;
  onLockedChange?(locked: boolean): void;
  label?: string;
}

const FREQUENCY_NODE_OPTIONS: readonly ProcessMetric[] = [
  "absolute",
  "absolute_case",
  "relative",
  "relative_case",
];
const FREQUENCY_EDGE_OPTIONS_LOCKED: readonly ProcessMetric[] = FREQUENCY_NODE_OPTIONS;
const FREQUENCY_EDGE_OPTIONS_UNLOCKED: readonly ProcessMetric[] = [
  "absolute",
  "absolute_case",
  "relative",
  "relative_case",
  "relative_antecedent",
  "relative_consequent",
];
const PERFORMANCE_OPTIONS: readonly ProcessMetric[] = [
  "median",
  "mean",
  "min",
  "max",
  "sum",
  "p90",
  "trimmed_mean",
];

export const MetricLayerSwitch = forwardRef<HTMLDivElement, MetricLayerSwitchProps>(
  function MetricLayerSwitch(
    {
      layer,
      onLayerChange,
      metric,
      onMetricChange,
      locked: lockedProp,
      defaultLocked = true,
      onLockedChange,
      label,
      className,
      ...props
    },
    ref,
  ) {
    const { t } = useLocale();
    const nodeId = useId();
    const edgeId = useId();

    const [uncontrolledLocked, setUncontrolledLocked] = useState(defaultLocked);
    const locked = lockedProp ?? uncontrolledLocked;
    const setLocked = useCallback(
      (next: boolean) => {
        if (lockedProp === undefined) setUncontrolledLocked(next);
        onLockedChange?.(next);
      },
      [lockedProp, onLockedChange],
    );

    const isRework = layer === "rework";
    const isPerformance = layer === "performance";

    const nodeOptions = isPerformance ? PERFORMANCE_OPTIONS : FREQUENCY_NODE_OPTIONS;
    const edgeOptions = isPerformance
      ? PERFORMANCE_OPTIONS
      : locked
        ? FREQUENCY_EDGE_OPTIONS_LOCKED
        : FREQUENCY_EDGE_OPTIONS_UNLOCKED;

    const handleLayerChange = useCallback(
      (next: string) => {
        if (!next) return; // Radix ToggleGroup type="single" emits "" when re-clicking the active item
        const nextLayer = next as MetricLayer;
        onLayerChange(nextLayer);
        if (nextLayer === "performance" && !isPerformanceMetric(metric.node)) {
          onMetricChange({ node: "median", edge: "median" });
        } else if (nextLayer === "frequency" && isPerformanceMetric(metric.node)) {
          onMetricChange({ node: "absolute", edge: "absolute" });
        }
      },
      [onLayerChange, onMetricChange, metric.node],
    );

    const handleNodeChange = useCallback(
      (value: string) => {
        const next = value as ProcessMetric;
        onMetricChange(locked ? { node: next, edge: next } : { node: next });
      },
      [onMetricChange, locked],
    );
    const handleEdgeChange = useCallback(
      (value: string) => {
        const next = value as ProcessMetric;
        onMetricChange(locked ? { node: next, edge: next } : { edge: next });
      },
      [onMetricChange, locked],
    );

    const handleLockToggle = useCallback(
      (pressed: boolean) => {
        setLocked(pressed);
        // Turning the lock ON syncs the edge metric to the node's — the node domain is
        // always the intersection-safe one, so this is always a valid edge value.
        if (pressed && metric.edge !== metric.node) {
          onMetricChange({ edge: metric.node });
        }
      },
      [setLocked, metric.edge, metric.node, onMetricChange],
    );

    return (
      <div
        ref={ref}
        data-slot="metric-layer-switch"
        role="group"
        aria-label={label ?? t("process.metricLayerSwitch.label")}
        className={cn("flex flex-col gap-3", className)}
        {...props}
      >
        <ToggleGroup
          type="single"
          variant="segmented"
          value={layer}
          onValueChange={handleLayerChange}
          aria-label={t("process.metricLayerSwitch.layer")}
        >
          <ToggleGroupItem value="frequency">
            {t("process.metricLayerSwitch.frequency")}
          </ToggleGroupItem>
          <ToggleGroupItem value="performance">
            {t("process.metricLayerSwitch.performance")}
          </ToggleGroupItem>
          <ToggleGroupItem value="rework">{t("process.metricLayerSwitch.rework")}</ToggleGroupItem>
        </ToggleGroup>

        <div className="flex items-end gap-2">
          <div data-slot="metric-layer-switch-node" className="flex flex-1 flex-col gap-1.5">
            <label htmlFor={nodeId} className="text-meta text-muted-foreground">
              {t("process.metricLayerSwitch.node")}
            </label>
            <Select value={metric.node} onValueChange={handleNodeChange} disabled={isRework}>
              <SelectTrigger id={nodeId} aria-label={t("process.metricLayerSwitch.node")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {nodeOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {nodeMetricLabel(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Toggle
            pressed={locked}
            onPressedChange={handleLockToggle}
            disabled={isRework}
            aria-label={
              locked
                ? t("process.metricLayerSwitch.lockOn")
                : t("process.metricLayerSwitch.lockOff")
            }
            data-slot="metric-layer-switch-lock"
          >
            {locked ? <Lock aria-hidden="true" /> : <LockOpen aria-hidden="true" />}
          </Toggle>

          <div data-slot="metric-layer-switch-edge" className="flex flex-1 flex-col gap-1.5">
            <label htmlFor={edgeId} className="text-meta text-muted-foreground">
              {t("process.metricLayerSwitch.edge")}
            </label>
            <Select value={metric.edge} onValueChange={handleEdgeChange} disabled={isRework}>
              <SelectTrigger id={edgeId} aria-label={t("process.metricLayerSwitch.edge")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {edgeOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {edgeMetricLabel(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    );
  },
);
