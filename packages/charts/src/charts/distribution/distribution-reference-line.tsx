"use client";

/**
 * distribution-reference-line.tsx — an optional labelled threshold line drawn
 * across the shared value axis (RM-026 follow-up).
 *
 * A box/strip/violin/histogram plot answers "what is the spread" — a caller
 * that also needs to show a fixed threshold against that spread (an SLA, a
 * spec limit, a target) draws it here, on the SAME geometry every mark
 * shares, rather than composing a second, misaligned overlay on top of the
 * chart. Perpendicular to the value axis, like {@link DistributionValueAxis}'s
 * gridlines, but drawn in `--chart-foreground` (a MEANINGFUL threshold, not
 * grid furniture) with a `--chart-background` halo so it stays legible over a
 * box/violin body — the same pairing `Gauge`'s target tick uses.
 */
import { HaloText } from "../../marks/halo-text";
import { chartCssVars } from "../chart-context";
import type { DistributionGeometry } from "./distribution-geometry";

export interface DistributionReferenceLine {
  /** Position along the shared value axis. */
  value: number;
  /** Short label rendered beside the line, e.g. "SLA: 48h". Omit for an unlabelled line. */
  label?: string;
}

/** Dash pattern distinguishing a threshold from the axis' solid gridlines. */
const REFERENCE_DASH = "4 3";

/** A rough `text-meta` average glyph width, in px — enough to decide which side of the line the label clears the plot edge on, never enough to lay the text out itself. */
const APPROX_GLYPH_WIDTH_PX = 5.5;

export interface DistributionReferenceLinesProps {
  geometry: DistributionGeometry;
  lines: readonly DistributionReferenceLine[];
}

export function DistributionReferenceLines({ geometry, lines }: DistributionReferenceLinesProps) {
  if (lines.length === 0) return null;
  const horizontal = geometry.orientation === "horizontal";

  return (
    <g data-slot="distribution-chart-reference-lines">
      {lines.map((line, index) => {
        const position = geometry.valuePos(line.value);
        const x1 = horizontal ? position : 0;
        const x2 = horizontal ? position : geometry.plotWidth;
        const y1 = horizontal ? 0 : position;
        const y2 = horizontal ? geometry.plotHeight : position;
        // A label past the line clips against the plot's right edge once the
        // threshold sits in roughly the last third of the axis — flip it to
        // the line's LEFT instead of letting it run off the card (#…).
        const labelWidth = (line.label?.length ?? 0) * APPROX_GLYPH_WIDTH_PX;
        const clipsRight = horizontal && position + 4 + labelWidth > geometry.plotWidth;
        return (
          <g data-slot="distribution-chart-reference-line" key={line.label ?? index}>
            <line
              stroke={chartCssVars.foreground}
              strokeDasharray={REFERENCE_DASH}
              strokeWidth={1.5}
              x1={x1}
              x2={x2}
              y1={y1}
              y2={y2}
            />
            {line.label ? (
              <HaloText
                className="text-meta"
                textAnchor={horizontal ? (clipsRight ? "end" : "start") : "end"}
                x={horizontal ? position + (clipsRight ? -4 : 4) : geometry.plotWidth - 4}
                y={horizontal ? 12 : Math.max(12, position - 4)}
              >
                {line.label}
              </HaloText>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

DistributionReferenceLines.displayName = "DistributionReferenceLines";
