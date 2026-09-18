"use client";

/**
 * PieLabels — slice labels for `PieChart` (RM-114, Datawrapper parity
 * `dw-charts.md` §2.17–2.21).
 *
 * Two placements:
 * - `"inside"` — `HaloText` centred on each wedge's centroid, hidden under
 *   `minAngle` (the wedge is too thin to hold text without spilling out).
 * - `"outside"` — a label on a fixed ring outside `outerRadius`, tied back to
 *   its wedge with a `Leader`. The ANGLE → ring-position math (a polar
 *   problem: `midAngle`, `sin`/`cos` around the pie's centre, which side of
 *   the vertical axis) stays pie-specific — RM-110's solver only ever sees
 *   already-positioned pixel rects. Once each label has a preferred rect,
 *   same-side collision avoidance is RM-110's shared `layoutLabels`
 *   (`./labels/label-layout`): real 2D overlap avoidance (not just same-side
 *   vertical stacking), a bounded nudge, and a `dropped` list restated
 *   `sr-only` via RM-110's `UnpaintedLabels` — a real gap this item's earlier
 *   unbounded, never-drops declutter left open.
 *
 * Pure layout math lives in exported functions so `pie-labels.test.tsx` can
 * assert exact positions/rects with no SVG measurement (jsdom returns `0` for
 * `getBBox`) — the same shape as `layoutPieReferenceRingLabels` in
 * `pie-chart.tsx`.
 */

import { Fragment, useMemo } from "react";
import { HaloText } from "../marks/halo-text";
import { Leader } from "../marks/leader";
import {
  DEFAULT_LABEL_PADDING,
  type LabelAnchorSide,
  type LabelBox,
  layoutLabels,
} from "./labels/label-layout";
import { useReportUnpaintedLabels } from "./labels/unpainted-labels";
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
/**
 * Largest same-side vertical nudge (px) before `layoutLabels` drops a label
 * instead of stacking it further — room for ~8 stacked labels. This item's
 * earlier declutter had no ceiling at all (an unbounded same-side push that
 * could, at extreme density, stack labels off the visible canvas with no
 * fallback); a bounded nudge plus a `dropped` list restated `sr-only` is
 * strictly better, and is why this switches to RM-110's `layoutLabels`.
 */
const OUTSIDE_LABEL_MAX_NUDGE = 8 * OUTSIDE_LINE_HEIGHT;

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

/** Result of {@link layoutOutsideLabels}: paint `placements`, restate `dropped` `sr-only`. */
export interface PieOutsideLabelsResult {
  /** Placed or nudged — paint these. In arc-index order. */
  placements: PieOutsideLabelLayout[];
  /** Collision-dropped by `layoutLabels` — restate these via `UnpaintedLabels`. In arc-index order. */
  dropped: PieOutsideLabelLayout[];
}

interface RawOutsideLabel {
  index: number;
  text: string;
  side: "left" | "right";
  anchorX: number;
  naturalY: number;
  leaderFrom: readonly [number, number];
}

/** One side's boxes through `layoutLabels`, mapped back to `PieOutsideLabelLayout`. */
function layoutOutsideLabelsForSide(
  group: readonly RawOutsideLabel[],
  side: LabelAnchorSide & ("left" | "right"),
): { placed: PieOutsideLabelLayout[]; dropped: PieOutsideLabelLayout[] } {
  const textAnchor: "start" | "end" = side === "right" ? "start" : "end";
  const textGap = side === "right" ? OUTSIDE_TEXT_GAP : -OUTSIDE_TEXT_GAP;
  const boxes: LabelBox[] = group.map((g) => {
    const anchorX = g.anchorX + textGap;
    const textWidth = Math.max(g.text.length * APPROX_CHAR_WIDTH, APPROX_CHAR_WIDTH);
    return {
      id: `pie-outside-${g.index}`,
      x: textAnchor === "start" ? anchorX : anchorX - textWidth,
      y: g.naturalY - OUTSIDE_LINE_HEIGHT / 2,
      width: textWidth,
      height: OUTSIDE_LINE_HEIGHT,
      anchorSide: side,
    };
  });

  const result = layoutLabels(boxes, {
    maxNudge: OUTSIDE_LABEL_MAX_NUDGE,
    padding: DEFAULT_LABEL_PADDING,
  });

  const placed: PieOutsideLabelLayout[] = [];
  const dropped: PieOutsideLabelLayout[] = [];
  result.placements.forEach((placement, i) => {
    const g = group[i]!;
    const box = boxes[i]!;
    const anchorX = g.anchorX + textGap;
    const centerY = placement.y + box.height / 2;
    const item: PieOutsideLabelLayout = {
      index: g.index,
      text: g.text,
      x: anchorX,
      y: centerY,
      textAnchor,
      side,
      leaderFrom: g.leaderFrom,
      leaderTo: [g.anchorX, centerY],
      rect: { x: box.x, y: placement.y, width: box.width, height: box.height },
    };
    (placement.status === "dropped" ? dropped : placed).push(item);
  });
  return { placed, dropped };
}

/**
 * Lay out one label per arc on the outside ring, grouped by side (left/right
 * of the vertical axis through the pie's centre). The angle → ring-position
 * math (this function) stays pie-specific; same-side collision avoidance is
 * RM-110's shared `layoutLabels` (`./labels/label-layout`) — see this file's
 * top docblock. A label `layoutLabels` cannot place within
 * `OUTSIDE_LABEL_MAX_NUDGE` comes back in `dropped`, never `placements`.
 */
export function layoutOutsideLabels(
  arcs: readonly PieArcData[],
  texts: readonly string[],
  outerRadius: number,
): PieOutsideLabelsResult {
  const raw: RawOutsideLabel[] = arcs.map((arc, i) => {
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

  const placements: PieOutsideLabelLayout[] = [];
  const dropped: PieOutsideLabelLayout[] = [];
  for (const side of ["left", "right"] as const) {
    const group = raw.filter((r) => r.side === side).sort((a, b) => a.naturalY - b.naturalY);
    const sideResult = layoutOutsideLabelsForSide(group, side);
    placements.push(...sideResult.placed);
    dropped.push(...sideResult.dropped);
  }
  return {
    placements: placements.sort((a, b) => a.index - b.index),
    dropped: dropped.sort((a, b) => a.index - b.index),
  };
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

/** Stable empty array so an inactive/inside `PieLabels` reports no dropped texts without a new array every render. */
const EMPTY_OUTSIDE_TEXTS: readonly string[] = [];

/**
 * The label layer itself — an `aria-hidden` SVG group (RM-017: every mark is
 * ink; the reader-facing copy of these facts is the accessible name each
 * slice's drill-down target already carries, or the caller's table flip).
 *
 * An `"outside"` label `layoutOutsideLabels` drops reports its text to the
 * nearest `UnpaintedLabelsProvider` (RM-110, `PieChart`'s own — see
 * `pie-chart.tsx`) via `useReportUnpaintedLabels`, so it is still readable
 * `sr-only` even though it never painted. `"inside"`'s `minAngle` omission is
 * a different, deliberate choice (the wedge is too thin for ANY text to
 * spill from) — it reports nothing, unchanged from before this switch.
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
  const active = placement !== "none" && arcs.length > 0;

  const texts = useMemo(
    () =>
      active
        ? arcs.map((arc) => formatPieLabelText(config.show, textFor(arc.index)))
        : EMPTY_OUTSIDE_TEXTS,
    [active, arcs, config.show, textFor],
  );

  const outsideResult = useMemo(
    () =>
      active && placement === "outside" ? layoutOutsideLabels(arcs, texts, outerRadius) : null,
    [active, placement, arcs, texts, outerRadius],
  );

  const droppedTexts = useMemo(
    () =>
      outsideResult
        ? outsideResult.dropped.map((d) => d.text).filter((t) => t !== "")
        : EMPTY_OUTSIDE_TEXTS,
    [outsideResult],
  );
  // Unconditional (rules of hooks): a no-op when there is no ancestor
  // `UnpaintedLabelsProvider` (`labels` unset — `PieLabels` never mounts
  // then anyway) or when `droppedTexts` is empty.
  useReportUnpaintedLabels("pie-outside-labels", droppedTexts);

  if (!active) {
    return null;
  }

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

  // "outside" — `outsideResult` is non-null here: `active && placement === "outside"`.
  const layout = outsideResult!.placements;
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
