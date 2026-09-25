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
 *   Caps make the fences look like data; they are not, they are 1.5 × IQR. It
 *   draws in the same ink as body text (`--chart-foreground`, not the dimmer
 *   `-muted` rung) — the reach to the fence is the whole point of reaching for
 *   a box plot over a bare median, so it has to read at a glance, not just on
 *   close inspection (#…).
 * - **the median tick is a CUT through the capsule**, not a fifth mark on top
 *   of it: an achromatic on-mark ink (`--chart-ink-on-light` /
 *   `--chart-ink-on-dark`) that the container picks from the capsule's own
 *   resolved fill (`medianInk`, see `on-mark-ink.ts`). A fixed paper-coloured
 *   tick measured 1.42:1 on a pale fill (#243); the picked ink clears 4.5:1 on
 *   every ramp step and series fill in both reference themes.
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

/** The capsule's opacity — the median ink is measured on this blend (#243). */
export const BOX_BODY_OPACITY = 0.9;

/** Outlier marker radius, in px. */
const OUTLIER_RADIUS = 3.25;

export interface DistributionBoxProps extends DistributionKindProps {
  /** Draw the hollow marks beyond the fences. */
  showOutliers: boolean;
  /** Stroke for the median tick — the on-mark ink for this capsule's fill. */
  medianInk: string;
}

function DistributionBoxImpl({
  color,
  fill,
  formatValue,
  geometry,
  group,
  medianInk,
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

  // The capsule and its whisker reach, as one box.
  const reachLo = Math.min(whiskerLo, whiskerHi, boxLo);
  const reach = Math.max(whiskerLo, whiskerHi, boxLo + boxLength) - reachLo;

  const enter = () =>
    onHover({
      x: horizontal ? medianPos : centre,
      y: horizontal ? centre : medianPos,
      mark: horizontal
        ? { x: reachLo, y: centre - half, width: reach, height: thickness }
        : { x: centre - half, y: reachLo, width: thickness, height: reach },
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
          capsule covers its middle. Full-contrast ink, not the dimmer `-muted`
          rung — against a filled capsule this thin a line needs to read at a
          glance (#…). */}
      <line
        data-slot="distribution-chart-whisker"
        stroke={chartCssVars.foreground}
        strokeWidth={1.5}
        x1={horizontal ? whiskerLo : centre}
        x2={horizontal ? whiskerHi : centre}
        y1={horizontal ? centre : whiskerLo}
        y2={horizontal ? centre : whiskerHi}
      />
      <rect
        fill={fill ?? color}
        height={horizontal ? thickness : boxLength}
        onClick={
          onActivate
            ? (event) =>
                onActivate(group.rows[0] ?? {}, group.rowIndices[0] ?? 0, summary.median, event)
            : undefined
        }
        opacity={BOX_BODY_OPACITY}
        rx={half}
        ry={half}
        width={horizontal ? boxLength : thickness}
        x={horizontal ? boxLo : centre - half}
        y={horizontal ? centre - half : boxLo}
      />
      {showMedian ? (
        <line
          data-slot="distribution-chart-median"
          stroke={medianInk}
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
                strokeWidth={1.5}
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
