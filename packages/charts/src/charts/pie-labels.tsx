"use client";

/**
 * PieLabels — slice labels for `PieChart` (RM-114, Datawrapper parity
 * `dw-charts.md` §2.17–2.21).
 *
 * Two placements:
 * - `"inside"` — `HaloText` centred on each wedge's centroid, hidden under
 *   `minAngle` (the wedge is too thin to hold text without spilling out).
 * - `"outside"` — a label on a fixed ring outside `outerRadius`, tied back to
 *   its wedge with a `Leader`. Labels on the same side (left/right of the
 *   vertical axis) that would collide are nudged apart along that ring — the
 *   local declutter pass RM-110's shared solver will eventually replace
 *   (`pie-chart.stories.tsx`'s "Orchestrator notes"); until then this is the
 *   whole story for pie/donut.
 *
 * Pure layout math lives in exported functions so `pie-labels.test.tsx` can
 * assert exact positions/rects with no SVG measurement (jsdom returns `0` for
 * `getBBox`) — the same shape as `layoutPieReferenceRingLabels` in
 * `pie-chart.tsx`.
 */

import { Fragment } from "react";
import { HaloText } from "../marks/halo-text";
import { Leader } from "../marks/leader";
import { pieCssVars, type PieArcData } from "./pie-context";

/** Where a pie/donut's slice labels sit. `"none"` renders nothing (today's behavior). */
export type PieLabelPlacement = "inside" | "outside" | "none";

/** Which facts a slice label states, in this fixed reading order. */
export type PieLabelField = "label" | "value" | "percent";

export interface PieLabelsConfig {
  /** `"inside"`, `"outside"`, or `"none"`. Default `"outside"` (see `PieChart`'s `labels` prop doc for the responsive default). */
  placement?: PieLabelPlacement;
  /** Which facts to show, and in what order. Required — no default reading. */
  show: PieLabelField[];
  /** Paint the label in the slice's own color instead of the neutral ink. Default `false`. */
  matchColor?: boolean;
  /**
   * Hide an `"inside"` label whose wedge angle (radians) is under this. A
   * label that cannot fit is worse than no label. Default `0.2` (~11.5°).
   * No effect on `"outside"` labels — they never sit inside the wedge.
   */
  minAngle?: number;
}

export const DEFAULT_PIE_LABEL_MIN_ANGLE = 0.2;

/** The ring gap (px) an outside label's leader crosses beyond `outerRadius`. */
const OUTSIDE_LEADER_GAP = 14;
/** The gap (px) between the leader's outer end and the label's text anchor. */
const OUTSIDE_TEXT_GAP = 4;
/** Vertical room (px) reserved per stacked outside label — the declutter minimum gap. */
const OUTSIDE_LINE_HEIGHT = 14;
/** Rough px-per-character used ONLY to keep stacked labels from colliding in x — not real text measurement. */
const APPROX_CHAR_WIDTH = 6;

export interface PieLabelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PieOutsideLabelLayout {
  index: number;
  text: string;
  /** Where the label's text anchor sits. */
  x: number;
  y: number;
  textAnchor: "start" | "end";
  side: "left" | "right";
  /** Leader endpoints: from the wedge's outer edge to the label's ring position. */
  leaderFrom: readonly [number, number];
  leaderTo: readonly [number, number];
  /** Approximate on-screen box (see `APPROX_CHAR_WIDTH`) — for collision assertions, not paint. */
  rect: PieLabelRect;
}

function declutter(ys: number[], minGap: number): number[] {
  const out = [...ys];
  for (let i = 1; i < out.length; i++) {
    const prev = out[i - 1]!;
    if (out[i]! - prev < minGap) {
      out[i] = prev + minGap;
    }
  }
  return out;
}

/**
 * Lay out one label per arc on the outside ring, grouped by side (left/right
 * of the vertical axis through the pie's centre) and decluttered vertically
 * within each side so no two labels on the same side overlap. Order within a
 * side follows each wedge's natural vertical position (top to bottom), never
 * the data/arc order — that is what keeps a leader from crossing a neighbour.
 */
export function layoutOutsideLabels(
  arcs: readonly PieArcData[],
  texts: readonly string[],
  outerRadius: number,
): PieOutsideLabelLayout[] {
  const raw = arcs.map((arc, i) => {
    const midAngle = (arc.startAngle + arc.endAngle) / 2;
    const side: "left" | "right" = Math.sin(midAngle) >= 0 ? "right" : "left";
    const ringRadius = outerRadius + OUTSIDE_LEADER_GAP;
    const anchorX = Math.sin(midAngle) * ringRadius;
    const naturalY = -Math.cos(midAngle) * ringRadius;
    const leaderFromRadius = outerRadius;
    return {
      index: i,
      text: texts[i] ?? "",
      side,
      anchorX,
      naturalY,
      leaderFrom: [
        Math.sin(midAngle) * leaderFromRadius,
        -Math.cos(midAngle) * leaderFromRadius,
      ] as const,
    };
  });

  const out: PieOutsideLabelLayout[] = [];
  for (const side of ["left", "right"] as const) {
    const group = raw.filter((r) => r.side === side).sort((a, b) => a.naturalY - b.naturalY);
    const adjustedYs = declutter(
      group.map((g) => g.naturalY),
      OUTSIDE_LINE_HEIGHT,
    );
    group.forEach((g, i) => {
      const y = adjustedYs[i]!;
      const textAnchor: "start" | "end" = side === "right" ? "start" : "end";
      const textGap = side === "right" ? OUTSIDE_TEXT_GAP : -OUTSIDE_TEXT_GAP;
      const x = g.anchorX + textGap;
      const textWidth = Math.max(g.text.length * APPROX_CHAR_WIDTH, APPROX_CHAR_WIDTH);
      const rect: PieLabelRect = {
        x: textAnchor === "start" ? x : x - textWidth,
        y: y - OUTSIDE_LINE_HEIGHT / 2,
        width: textWidth,
        height: OUTSIDE_LINE_HEIGHT,
      };
      out.push({
        index: g.index,
        text: g.text,
        x,
        y,
        textAnchor,
        side,
        leaderFrom: g.leaderFrom,
        leaderTo: [g.anchorX, y],
        rect,
      });
    });
  }
  return out.sort((a, b) => a.index - b.index);
}

/** Do any two rects in `rects` overlap? Exported so a story/test can assert the Acceptance bullet directly. */
export function anyPieLabelRectsOverlap(rects: readonly PieLabelRect[]): boolean {
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i]!;
      const b = rects[j]!;
      const overlapsX = a.x < b.x + b.width && b.x < a.x + a.width;
      const overlapsY = a.y < b.y + b.height && b.y < a.y + a.height;
      if (overlapsX && overlapsY) return true;
    }
  }
  return false;
}

export interface PieLabelTextParts {
  label?: string;
  value?: string;
  percent?: string;
}

/** The one reading order every pie label uses, regardless of how `show` lists its fields. */
const PIE_LABEL_FIELD_ORDER: readonly PieLabelField[] = ["label", "value", "percent"];

/** Join whichever of `show`'s fields are present, in the fixed `label → value → percent` order. */
export function formatPieLabelText(
  show: readonly PieLabelField[],
  parts: PieLabelTextParts,
): string {
  return PIE_LABEL_FIELD_ORDER.filter((field) => show.includes(field))
    .map((field) => parts[field])
    .filter((v): v is string => v !== undefined && v !== "")
    .join(" · ");
}

export interface PieLabelsProps {
  config: PieLabelsConfig;
  arcs: readonly PieArcData[];
  center: number;
  innerRadius: number;
  outerRadius: number;
  getColor: (index: number) => string;
  /** `(index) => label/value/percent text` for the fields `config.show` asks for. */
  textFor: (index: number) => PieLabelTextParts;
}

/**
 * The label layer itself — an `aria-hidden` SVG group (RM-017: every mark is
 * ink; the reader-facing copy of these facts is the accessible name each
 * slice's drill-down target already carries, or the caller's table flip).
 */
export function PieLabels({
  config,
  arcs,
  center: _center,
  innerRadius,
  outerRadius,
  getColor,
  textFor,
}: PieLabelsProps) {
  const placement = config.placement ?? "outside";
  if (placement === "none" || arcs.length === 0) {
    return null;
  }

  const texts = arcs.map((arc) => formatPieLabelText(config.show, textFor(arc.index)));

  if (placement === "inside") {
    const minAngle = config.minAngle ?? DEFAULT_PIE_LABEL_MIN_ANGLE;
    const midRadius = (innerRadius + outerRadius) / 2;
    return (
      <g aria-hidden="true" data-slot="pie-labels" data-placement="inside">
        {arcs.map((arc, i) => {
          const angle = arc.endAngle - arc.startAngle;
          const text = texts[i];
          if (!text || angle < minAngle) return null;
          const midAngle = (arc.startAngle + arc.endAngle) / 2;
          const x = Math.sin(midAngle) * midRadius;
          const y = -Math.cos(midAngle) * midRadius;
          return (
            <HaloText
              data-slot="pie-labels-item"
              fontSize={10}
              key={`pie-label-${arc.data.label}-${i}`}
              textAnchor="middle"
              x={x}
              y={y}
              {...(config.matchColor ? { fill: getColor(arc.index) } : null)}
            >
              {text}
            </HaloText>
          );
        })}
      </g>
    );
  }

  // "outside"
  const layout = layoutOutsideLabels(arcs, texts, outerRadius);
  return (
    <g aria-hidden="true" data-slot="pie-labels" data-placement="outside">
      {layout.map((item) => {
        if (!item.text) return null;
        return (
          <Fragment key={`pie-label-${arcs[item.index]?.data.label}-${item.index}`}>
            <Leader dash="1 3" from={item.leaderFrom} to={item.leaderTo} />
            <HaloText
              data-slot="pie-labels-item"
              fill={config.matchColor ? getColor(item.index) : pieCssVars.foreground}
              fontSize={10}
              textAnchor={item.textAnchor}
              x={item.x}
              y={item.y}
            >
              {item.text}
            </HaloText>
          </Fragment>
        );
      })}
    </g>
  );
}

PieLabels.displayName = "PieLabels";
