"use client";

/**
 * strip.tsx — the `kind="strip"` mark (RM-026).
 *
 * Provenance: `G15 Jitter Strip`. One dot per RECORD, displaced across the band
 * by ±0.29 of a row so overlapping values separate, at 0.62 opacity so a dense
 * cluster reads as density rather than as a solid bar.
 *
 * ## The jitter is seeded, and that is not a detail
 *
 * The displacement comes from {@link seededRnd}, the package's only sanctioned
 * randomness (`../../../marks/seeded-rnd.ts`). `Math.random()` would look
 * identical and would make the chart a different picture on every render — no
 * snapshot, no visual-regression shot and no play-function assertion could ever
 * agree with the previous run. The seed is the record's index within its group,
 * so the same row lands in the same place forever.
 *
 * ## Every record is a keyboard target, deliberately
 *
 * A strip's whole claim is "these are the records". Registering only some of
 * them would give a keyboard user a different chart from a mouse user, which is
 * the 2.1.1 parity rule (#349). The dev-warning threshold
 * (`maxInteractiveDatapoints`) is a NOISE control, not a cap — the layer itself
 * warns and keeps every target reachable.
 */
import { memo, useMemo } from "react";
import { seededRnd } from "../../../marks";
import {
  padDatapointRect,
  useActivateDatapoint,
  useChartDatapointsEnabled,
  useRegisterDatapointTargets,
  type ChartDatapointTarget,
} from "../../chart-datapoint-layer";
import type { DistributionKindProps } from "../distribution-kind";

/** The card's own jitter: ±0.29 of a band, so two neighbouring rows never merge. */
export const STRIP_JITTER = 0.29;

/** Dot opacity. Low enough that overlap reads as density. */
const STRIP_OPACITY = 0.62;

/** Dot radius, in px. */
const STRIP_RADIUS = 2.5;

/** A second, decorrelated draw from the same seed — see `seededRnd`'s doc. */
const JITTER_K = 7;

export interface DistributionStripProps extends DistributionKindProps {
  /** Value key, for the datapoint payload's `seriesKey`. */
  valueKey: string;
  /** Plot-area offset, so a registered hit box lands in CONTAINER coordinates. */
  offsetX: number;
  offsetY: number;
}

function DistributionStripImpl({
  color,
  formatValue,
  geometry,
  group,
  offsetX,
  offsetY,
  onActivate,
  onHover,
  valueKey,
}: DistributionStripProps) {
  const interactive = useChartDatapointsEnabled();
  const activate = useActivateDatapoint();

  const dots = useMemo(
    () =>
      group.values.map((value, index) => {
        const jitter = (seededRnd(index, group.index * 13 + JITTER_K) - 0.5) * 2 * STRIP_JITTER;
        const point = geometry.point(value, group.index, jitter);
        return { value, index, x: point.x, y: point.y };
      }),
    [geometry, group.index, group.values],
  );

  /**
   * Keyboard targets, in CONTAINER coordinates (the layer is a positioned
   * sibling of the `<svg>`, not a child of the margin group). Geometry the dots
   * already computed — never a `getBBox()` in render.
   */
  const targets = useMemo<ChartDatapointTarget[]>(() => {
    if (!interactive) return [];
    return dots.map((dot) => ({
      id: `${group.key || "all"}-${dot.index}`,
      seriesIndex: group.index,
      index: group.rowIndices[dot.index] ?? dot.index,
      datum: group.rows[dot.index] ?? {},
      seriesKey: valueKey,
      seriesLabel: group.label,
      value: dot.value,
      category: group.label,
      rect: padDatapointRect({
        x: offsetX + dot.x - STRIP_RADIUS,
        y: offsetY + dot.y - STRIP_RADIUS,
        width: STRIP_RADIUS * 2,
        height: STRIP_RADIUS * 2,
      }),
    }));
  }, [dots, group, interactive, offsetX, offsetY, valueKey]);

  useRegisterDatapointTargets(`distribution-strip-${group.index}`, targets);

  return (
    <g data-slot="distribution-chart-strip">
      {dots.map((dot) => (
        <circle
          cx={dot.x}
          cy={dot.y}
          data-slot="distribution-chart-record"
          fill={color}
          key={dot.index}
          onClick={
            onActivate || activate
              ? (event) => {
                  const row = group.rows[dot.index] ?? {};
                  const rowIndex = group.rowIndices[dot.index] ?? dot.index;
                  onActivate?.(row, rowIndex, dot.value, event);
                  activate?.(
                    {
                      id: `${group.key || "all"}-${dot.index}`,
                      seriesIndex: group.index,
                      index: rowIndex,
                      datum: row,
                      seriesKey: valueKey,
                      seriesLabel: group.label,
                      value: dot.value,
                      category: group.label,
                      rect: { x: dot.x, y: dot.y, width: 0, height: 0 },
                    },
                    event,
                  );
                }
              : undefined
          }
          onPointerEnter={() =>
            onHover({
              x: dot.x,
              y: dot.y,
              title: group.label,
              rows: [{ color, label: valueKey, value: formatValue(dot.value) }],
            })
          }
          onPointerLeave={() => onHover(null)}
          opacity={STRIP_OPACITY}
          r={STRIP_RADIUS}
        />
      ))}
    </g>
  );
}

/**
 * Memoized: this is the kind that has to survive 2,000 records. Hovering one dot
 * updates the CONTAINER's tooltip state, and without this memo that re-renders
 * every circle — the difference between a hover inside one frame and one that
 * is not.
 */
export const DistributionStrip = memo(DistributionStripImpl);
DistributionStrip.displayName = "DistributionStrip";
