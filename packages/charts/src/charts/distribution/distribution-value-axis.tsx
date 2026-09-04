"use client";

/**
 * distribution-value-axis.tsx — the shared numeric axis and the group labels
 * (RM-026).
 *
 * One axis, drawn once, whatever `kind` is showing. That is the visible half of
 * the "one scale" promise: flipping a `DistributionChart` from `strip` to `box`
 * to `violin` must not move a single tick, or the three readings stop being
 * readings of one picture.
 *
 * Hand-rolled rather than `@visx/axis` because this package has no such
 * dependency (see `x-axis.tsx`, which is hand-rolled for the same reason) and
 * because the group labels have to interleave with the ticks on the SAME
 * geometry — two components would each need half of it.
 */
import { chartCssVars } from "../chart-context";
import type { DistributionGeometry } from "./distribution-geometry";
import type { DistributionGroup } from "./distribution-groups";

export interface DistributionValueAxisProps {
  geometry: DistributionGeometry;
  groups: readonly DistributionGroup[];
  formatValue: (value: number) => string;
  /** Approximate tick count. Default 5. */
  tickCount?: number;
}

export function DistributionValueAxis({
  formatValue,
  geometry,
  groups,
  tickCount = 5,
}: DistributionValueAxisProps) {
  const horizontal = geometry.orientation === "horizontal";
  const ticks = geometry.valueTicks(tickCount);

  return (
    <g data-slot="distribution-chart-axis">
      {ticks.map((tick) => {
        const position = geometry.valuePos(tick);
        return (
          <g key={tick}>
            {/* A gridline, not a rule: it runs the full cross extent so every
                band is read against the same reference. */}
            <line
              stroke={chartCssVars.grid}
              strokeWidth={1}
              x1={horizontal ? position : 0}
              x2={horizontal ? position : geometry.plotWidth}
              y1={horizontal ? 0 : position}
              y2={horizontal ? geometry.plotHeight : position}
            />
            <text
              className="text-meta"
              fill={chartCssVars.label}
              textAnchor={horizontal ? "middle" : "end"}
              x={horizontal ? position : -8}
              y={horizontal ? geometry.plotHeight + 16 : position + 4}
            >
              {formatValue(tick)}
            </text>
          </g>
        );
      })}

      {groups.map((group) => {
        const centre = geometry.crossPos(group.index);
        return (
          <text
            className="text-meta"
            data-slot="distribution-chart-group-label"
            fill={chartCssVars.foreground}
            key={group.key || group.label}
            textAnchor={horizontal ? "end" : "middle"}
            x={horizontal ? -10 : centre}
            y={horizontal ? centre + 4 : geometry.plotHeight + 16}
          >
            {group.label}
          </text>
        );
      })}
    </g>
  );
}

DistributionValueAxis.displayName = "DistributionValueAxis";
