"use client";

/**
 * violin.tsx — the `kind="violin"` mark (RM-026).
 *
 * Provenance: `G19 Violin`. A mirrored kernel density estimate sampled on the
 * fixed 44-point grid (`../kde.ts`), smoothed with quadratic midpoints
 * (`../blob-path.ts`) so the silhouette never bulges past its own estimate, and
 * cut at the waist by a paper-coloured median tick — the same tick `box.tsx`
 * uses, for the same reason.
 *
 * ## The half-width is scaled per GROUP, and that is a real limitation
 *
 * Each violin's widest point fills its band. So two violins say "this is the
 * shape of this group", NOT "this group has more records than that one" — n is
 * carried by the tooltip and the text summary, never by the width. That is the
 * conventional reading, but it is the single most common misreading of a violin
 * plot, so it is stated here rather than assumed.
 */
import { localPoint } from "@visx/event";
import { memo, useMemo } from "react";
import { chartCssVars } from "../../chart-context";
import { blobPath, type BlobPoint } from "../blob-path";
import type { DistributionKindProps } from "../distribution-kind";
import { kde, kdeDensityAt } from "../kde";

/** The widest half of the silhouette, as a fraction of the band's inner extent. */
const VIOLIN_FRACTION = 0.46;

export interface DistributionViolinProps extends DistributionKindProps {
  /** KDE bandwidth override. Unset uses Silverman's rule of thumb. */
  bandwidth?: number;
}

function DistributionViolinImpl({
  bandwidth,
  color,
  formatValue,
  geometry,
  group,
  onHover,
  showMedian,
}: DistributionViolinProps) {
  const horizontal = geometry.orientation === "horizontal";
  const centre = geometry.crossPos(group.index);
  const halfMax = Math.max(2, geometry.bandInner * VIOLIN_FRACTION);

  const estimate = useMemo(() => kde(group.values, { bandwidth }), [bandwidth, group.values]);

  const path = useMemo(() => {
    if (estimate.points.length < 2 || estimate.peak <= 0) return "";
    const upper: BlobPoint[] = [];
    const lower: BlobPoint[] = [];
    for (const point of estimate.points) {
      const along = geometry.valuePos(point.value);
      const spread = (point.density / estimate.peak) * halfMax;
      upper.push(horizontal ? { x: along, y: centre - spread } : { x: centre - spread, y: along });
      lower.push(horizontal ? { x: along, y: centre + spread } : { x: centre + spread, y: along });
    }
    // One closed outline: out along the top, back along the bottom. Closing it
    // (rather than drawing two mirrored strokes) is what lets the fill and the
    // stroke agree at the tapered ends.
    return blobPath([...upper, ...lower.reverse()], true);
  }, [centre, estimate, geometry, halfMax, horizontal]);

  if (!path) return null;

  const summary = group.summary;
  const medianPos = summary ? geometry.valuePos(summary.median) : 0;

  /**
   * Density AT the pointer's value — a violin's honest tooltip. Reading the
   * grid's nearest sample would report a number the reader cannot see; the
   * estimate is cheap enough to evaluate exactly where the pointer is.
   *
   * `localPoint` resolves to the SVG ROOT's space, so the plot margin is
   * subtracted here rather than assumed away. It reads layout in an EVENT
   * HANDLER, never in render (@.claude/rules/interaction-guidelines.md).
   */
  const handleMove = (event: React.PointerEvent<SVGGElement>) => {
    const owner = event.currentTarget.ownerSVGElement;
    if (!owner) return;
    const local = localPoint(owner, event.nativeEvent);
    if (!local) return;
    const along = horizontal ? local.x - geometry.margin.left : local.y - geometry.margin.top;
    const value = geometry.valueAt(along);
    const [lo, hi] = geometry.domain;
    if (value < lo || value > hi) return;
    onHover({
      x: horizontal ? geometry.valuePos(value) : centre,
      y: horizontal ? centre : geometry.valuePos(value),
      title: group.label,
      rows: [
        { color, label: "Value", value: formatValue(value) },
        {
          color,
          label: "Density",
          value: kdeDensityAt(group.values, value, estimate.bandwidth).toFixed(4),
        },
        { color, label: "Records", value: group.values.length },
      ],
    });
  };

  return (
    <g
      data-slot="distribution-chart-violin"
      onPointerLeave={() => onHover(null)}
      onPointerMove={handleMove}
    >
      <path d={path} fill={color} opacity={0.72} stroke={color} strokeWidth={1} />
      {showMedian && summary ? (
        <line
          data-slot="distribution-chart-median"
          stroke={chartCssVars.background}
          strokeLinecap="round"
          strokeWidth={2}
          x1={horizontal ? medianPos : centre - halfMax * 0.5}
          x2={horizontal ? medianPos : centre + halfMax * 0.5}
          y1={horizontal ? centre - halfMax * 0.5 : medianPos}
          y2={horizontal ? centre + halfMax * 0.5 : medianPos}
        />
      ) : null}
    </g>
  );
}

/** Memoized for the same reason every kind is — see `histogram.tsx`. */
export const DistributionViolin = memo(DistributionViolinImpl);
DistributionViolin.displayName = "DistributionViolin";
