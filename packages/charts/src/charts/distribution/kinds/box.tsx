"use client";

/**
 * box.tsx — the `kind="box"` mark (RM-026).
 *
 * Provenance: `F15 Tick Box`. Four decisions the ordinary box plot does not make:
 *
 * - **the box is a CAPSULE** (`rx = half the box's thickness`), not a rectangle.
 *   A rounded IQR reads as a range rather than as a bar someone might try to
 *   compare by area — which is exactly the misreading a box plot invites.
 * - **the whisker is a HAIRLINE**, drawn behind the capsule, with no end caps.
 *   Caps make the fences look like data; they are not, they are 1.5 × IQR.
 * - **the median tick is drawn in the PAPER colour** (`--chart-background`), so
 *   it reads as a cut through the capsule rather than a fifth mark on top of it.
 *   That is what keeps it legible on any fill without a second colour token.
 * - **outliers are HOLLOW.** A filled dot at the tail competes with the box for
 *   attention; an outline says "one record, out here" and stays quiet.
 *
 * The median is ALSO the non-colour channel this mark needs: when the container
 * shades boxes by median rank (`palette="sequential"`), the rank is carried by
 * the tick's POSITION as well as by the fill, so the ordering survives greyscale
 * (@.claude/rules/accessibility.md).
 */
import { memo } from "react";
import { chartCssVars } from "../../chart-context";
import type { DistributionKindProps } from "../distribution-kind";

/** The capsule's thickness as a fraction of the band's inner extent. */
const BOX_FRACTION = 0.44;

/** Outlier marker radius, in px. */
const OUTLIER_RADIUS = 2.75;

export interface DistributionBoxProps extends DistributionKindProps {
  /** Draw the hollow marks beyond the fences. */
  showOutliers: boolean;
}

function DistributionBoxImpl({
  color,
  formatValue,
  geometry,
  group,
  onActivate,
  onHover,
  showMedian,
  showOutliers,
}: DistributionBoxProps) {
  const summary = group.summary;
  if (!summary) return null;

  const horizontal = geometry.orientation === "horizontal";
  const centre = geometry.crossPos(group.index);
  const thickness = Math.max(4, geometry.bandInner * BOX_FRACTION);
  const half = thickness / 2;

  const q1 = geometry.valuePos(summary.q1);
  const q3 = geometry.valuePos(summary.q3);
  const boxLo = Math.min(q1, q3);
  const boxLength = Math.max(1, Math.abs(q3 - q1));
  const medianPos = geometry.valuePos(summary.median);
  const whiskerLo = geometry.valuePos(summary.lowerWhisker);
  const whiskerHi = geometry.valuePos(summary.upperWhisker);

  const enter = () =>
    onHover({
      x: horizontal ? medianPos : centre,
      y: horizontal ? centre : medianPos,
      title: group.label,
      rows: [
        { color, label: "Median", value: formatValue(summary.median) },
        { color, label: "IQR", value: `${formatValue(summary.q1)} – ${formatValue(summary.q3)}` },
        {
          color,
          label: "Range",
          value: `${formatValue(summary.min)} – ${formatValue(summary.max)}`,
        },
        { color, label: "Records", value: summary.n },
      ],
    });

  return (
    <g
      data-slot="distribution-chart-box"
      onPointerEnter={enter}
      onPointerLeave={() => onHover(null)}
    >
      {/* Whisker: one hairline through the whole reach, drawn first so the
          capsule covers its middle. */}
      <line
        stroke={chartCssVars.foregroundMuted}
        strokeWidth={1}
        x1={horizontal ? whiskerLo : centre}
        x2={horizontal ? whiskerHi : centre}
        y1={horizontal ? centre : whiskerLo}
        y2={horizontal ? centre : whiskerHi}
      />
      <rect
        fill={color}
        height={horizontal ? thickness : boxLength}
        onClick={
          onActivate
            ? (event) =>
                onActivate(group.rows[0] ?? {}, group.rowIndices[0] ?? 0, summary.median, event)
            : undefined
        }
        opacity={0.9}
        rx={half}
        ry={half}
        width={horizontal ? boxLength : thickness}
        x={horizontal ? boxLo : centre - half}
        y={horizontal ? centre - half : boxLo}
      />
      {showMedian ? (
        <line
          data-slot="distribution-chart-median"
          stroke={chartCssVars.background}
          strokeLinecap="round"
          strokeWidth={2}
          x1={horizontal ? medianPos : centre - half * 0.8}
          x2={horizontal ? medianPos : centre + half * 0.8}
          y1={horizontal ? centre - half * 0.8 : medianPos}
          y2={horizontal ? centre + half * 0.8 : medianPos}
        />
      ) : null}
      {showOutliers
        ? summary.outliers.map((value, index) => {
            const position = geometry.valuePos(value);
            return (
              <circle
                cx={horizontal ? position : centre}
                cy={horizontal ? centre : position}
                data-slot="distribution-chart-outlier"
                fill="none"
                key={`${value}-${index}`}
                r={OUTLIER_RADIUS}
                stroke={color}
                strokeWidth={1}
              />
            );
          })
        : null}
    </g>
  );
}

/** Memoized for the same reason every kind is — see `histogram.tsx`. */
export const DistributionBox = memo(DistributionBoxImpl);
DistributionBox.displayName = "DistributionBox";
