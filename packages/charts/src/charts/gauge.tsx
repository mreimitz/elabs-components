"use client";

import { ChartParentSize } from "./chart-parent-size";
import { motion, type Transition, useReducedMotion } from "motion/react";
import {
  Children,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useId,
  useMemo,
} from "react";
import { cn } from "@elabs-ai/components-ui";
import { ChartA11yLabel, type ChartA11yProps, useChartA11yContainerProps } from "./chart-a11y";
import { type ChartStatFlowFormat, defaultChartStatFlowFormat } from "./chart-stat-flow";
import { CHART_HAIRLINE_WIDTH } from "../chart-hairline";
import { HaloText } from "../marks/halo-text";
import { PieCenterShell } from "./pie-center-shell";
import { useChartTranslate } from "./chart-messages";

// Radial gap (px) reserved between the dial's outer edge and a milestone's
// halo-text number, matching `RingTickRing`'s `leaderReserve` idiom
// (`ring.tsx`) — a short dotted leader connects the dot to the label so the
// two read as one mark instead of two disconnected scales (#248).
const MILESTONE_LEADER_RESERVE = 18;

function isDefsComponent(child: ReactElement): boolean {
  const typeLabel =
    (child.type as { displayName?: string })?.displayName ||
    (child.type as { name?: string })?.name ||
    "";
  return (
    typeLabel.includes("Gradient") ||
    typeLabel.includes("Pattern") ||
    typeLabel === "LinearGradient" ||
    typeLabel === "RadialGradient" ||
    typeLabel === "Lines" ||
    typeLabel === "PatternLines" ||
    typeLabel === "Circles" ||
    typeLabel === "Hexagons" ||
    typeLabel === "Waves"
  );
}

function collectDefsElements(nodes: ReactNode): ReactElement[] {
  const out: ReactElement[] = [];
  Children.forEach(nodes, (child) => {
    if (!isValidElement(child)) {
      return;
    }
    if (child.type === Fragment) {
      out.push(...collectDefsElements((child.props as { children?: ReactNode }).children));
      return;
    }
    if (isDefsComponent(child)) {
      out.push(child);
    }
  });
  return out;
}

function interpolateHex(color1: string, color2: string, factor: number): string {
  const hex = (c: string) => Number.parseInt(c, 16);
  const r1 = hex(color1.slice(1, 3));
  const g1 = hex(color1.slice(3, 5));
  const b1 = hex(color1.slice(5, 7));
  const r2 = hex(color2.slice(1, 3));
  const g2 = hex(color2.slice(3, 5));
  const b2 = hex(color2.slice(5, 7));

  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

const DEFAULT_ACTIVE_FILL_OPACITY = 1;
// Track notches paint the ring-track rung (--chart-ring-background) at full opacity.
const DEFAULT_INACTIVE_FILL_OPACITY = 1;

// A `thresholds` tick is furniture (a scale marking, not data) — a short
// outer-rim mark past the notch band, same idiom as an axis tick. Lengthened
// from an earlier 6px (#…) — at that length the tick read as lost among the
// notch ring in a screenshot review; 10px reads unmistakably as its own mark.
const THRESHOLD_TICK_LENGTH = 10;

// The target tick and threshold ticks each get a `--chart-background` halo
// UNDER the actual ink — a same-radius, wider stroke that punches a clear gap
// through whatever notch colors the tick crosses, so the mark reads as ITS
// OWN thing rather than blending into a dense, colorful ring (#…).
// chart-hairline-exempt: a halo underlay is masking, not a second grid ink —
// it never carries information on its own, only separates the real tick from
// the notches behind it.
const TARGET_TICK_OVERSHOOT = 8;
const TARGET_HALO_STROKE_WIDTH = 6;
const TARGET_STROKE_WIDTH = 2;
const THRESHOLD_HALO_STROKE_WIDTH = CHART_HAIRLINE_WIDTH + 3;

/**
 * The one angle computation notches/milestones/target/thresholds all share —
 * a value 0–100 maps linearly onto the arc's own `[startAngle, startAngle +
 * availableAngle]` span. Never fork a second mapping.
 */
function valueToAngle(value: number, startAngle: number, availableAngle: number): number {
  const clamped = Math.min(100, Math.max(0, value));
  return startAngle + (clamped / 100) * availableAngle;
}

export interface GaugeThreshold {
  /** 0–100, same scale as `value`. */
  value: number;
  /** The band's name (e.g. "Good") — shown nowhere on the dial itself, only in the accessible text. */
  label: string;
}

export interface GaugeLabels {
  /** Word introducing the `target` value in the composed accessible description (e.g. "target 80"). */
  target: string;
}

/** The shipped English word `labels` overrides to localize (#… target/thresholds). */
const DEFAULT_GAUGE_LABELS: Readonly<GaugeLabels> = Object.freeze({
  target: "target",
});

/** The threshold band a value currently falls in — the first threshold at or above it, else the top band. */
function resolveThresholdBand(
  value: number,
  thresholds: readonly GaugeThreshold[],
): string | undefined {
  if (thresholds.length === 0) return undefined;
  const sorted = [...thresholds].sort((a, b) => a.value - b.value);
  const hit = sorted.find((t) => value <= t.value);
  return (hit ?? sorted[sorted.length - 1])?.label;
}

/**
 * "72 of 100, target 80, band Good" — composed only when `target` and/or
 * `thresholds` are set; `undefined` (no glue text at all) otherwise, so a
 * plain `Gauge` never gains accessible text it did not have (#…).
 */
function composeTargetThresholdDescription(args: {
  value: number;
  target: number | undefined;
  thresholds: readonly GaugeThreshold[] | undefined;
  labels: GaugeLabels;
}): string | undefined {
  const { value, target, thresholds, labels } = args;
  const hasThresholds = Boolean(thresholds && thresholds.length > 0);
  if (target === undefined && !hasThresholds) return undefined;

  const parts = [`${Math.round(value)} of 100`];
  if (target !== undefined) parts.push(`${labels.target} ${Math.round(target)}`);
  if (hasThresholds) {
    const band = resolveThresholdBand(value, thresholds as GaugeThreshold[]);
    if (band) parts.push(`band ${band}`);
  }
  return parts.join(", ");
}

const DEFAULT_NOTCH_ENTER_TRANSITION: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 20,
};

export interface GaugeProps extends ChartA11yProps {
  /** Fill level 0–100 */
  value: number;
  /** Number of arc notches */
  totalNotches?: number;
  /** Percentage of the arc reserved for gaps between notches */
  spacing?: number;
  /**
   * Corner fillet radius for each notch corner (pixels). **0** = sharp corners;
   * higher values read more rounded; geometry clamps so large values approach a
   * capsule / near-circular silhouette.
   */
  notchCornerRadius?: number;
  /** `true` = rectangular notches; `false` = tapered toward the center */
  uniformWidth?: boolean;
  startAngle?: number;
  endAngle?: number;
  useGradient?: boolean;
  /**
   * Override the active-notch gradient with two explicit hex stops to interpolate
   * along the arc. When omitted (the default), notches use the theme chart palette
   * (`--chart-1` → `--chart-5`) — no hardcoded colors.
   */
  activeGradient?: readonly [string, string];
  /**
   * When `useGradient` is true, inactive notch colors interpolate between these
   * hex stops. Defaults to {@link activeGradient} when omitted.
   */
  inactiveGradient?: readonly [string, string];
  /** Value passed to {@link PieCenterShell} / NumberFlow */
  centerValue: number;
  defaultLabel?: string;
  prefix?: string;
  suffix?: string;
  formatOptions?: ChartStatFlowFormat;
  /**
   * Inactive / track notch fill — CSS color or `url(#patternId)` (define patterns
   * in `children`).
   */
  inactiveFill?: string;
  /**
   * Active notch fill — CSS color or `url(#patternId)`.
   * When set, overrides solid / gradient active fills for that layer.
   */
  activeFill?: string;
  /**
   * SVG `fill-opacity` for inactive / track notches (0–1).
   * Default **1** — the track rung is already tuned lighter than the hairline ink.
   */
  inactiveFillOpacity?: number;
  /**
   * SVG `fill-opacity` for active notches (0–1). Default **1**.
   */
  activeFillOpacity?: number;
  /**
   * `PatternLines`, gradients, etc. — rendered inside `<defs>` (same convention
   * as `PieChart` children).
   */
  children?: ReactNode;
  className?: string;
  /**
   * Explicit pixel size. When omitted, the gauge fills its parent; give the
   * parent a size (e.g. `min-w-[300px]` + aspect box) for responsive layouts.
   */
  width?: number;
  height?: number;
  /** Minimum width (px) when using the built-in responsive wrapper. Default 300 */
  minWidth?: number;
  /**
   * Radial depth of notches as a **%** of the built-in default (outer 42% /
   * inner 28% of `size`). **100** = full length; lower values pull the inner
   * edge toward the outer arc. Clamped **5–100**.
   */
  notchLengthPercent?: number;
  /** Framer Motion transition for notch enter animation (opacity / scale). */
  enterTransition?: Transition;
  /** Scales notch stagger delays relative to default timing (1 = reference). */
  enterStaggerScale?: number;
  /**
   * Milestone values (0–100) marked with a small dot on the dial and a
   * halo-text number just **outside** the notch band, joined by a short
   * dotted leader — e.g. `[25, 50, 75, 100]` (lieflat F11). Setting
   * `milestones` reserves a small radial margin so the leader + label never
   * clip the gauge's own box; a `Gauge` with `milestones` unset renders its
   * pre-existing, unaffected geometry. #248.
   */
  milestones?: number[];
  /**
   * Caption rendered under the center value/label. Receives the number of
   * notches remaining (`totalNotches - activeNotches`) and returns the
   * caption text — e.g. `(remaining) => \`${remaining} ticks to go\`` renders
   * as "27 TICKS TO GO" (lieflat F11; the caption is rendered upper-cased via
   * CSS, so pass ordinary sentence case). Unset (default) renders no caption.
   */
  remainingLabel?: (remaining: number) => string;
  /**
   * A radial tick crossing the notch band at this value (0–100) — e.g. a
   * quarterly target. Reuses the same value→angle mapping as notches/
   * milestones. Unset (default) renders no tick and the dial's geometry is
   * unaffected.
   */
  target?: number;
  /**
   * Short outer-rim ticks (furniture — `--chart-grid`, `CHART_HAIRLINE_WIDTH`)
   * marking named bands (e.g. `{ value: 75, label: "Good" }`). No colour
   * zones — colour is not status here, only the accessible text names the
   * band a value falls in. Unset (default) renders no ticks.
   */
  thresholds?: GaugeThreshold[];
  /** Overrides the shipped English words the composed accessible text uses (`target`). */
  labels?: Partial<GaugeLabels>;
}

interface GaugeInnerProps extends Omit<
  GaugeProps,
  "className" | "minWidth" | "accessibleLabel" | "accessibleDescription"
> {
  width: number;
  height: number;
}

function GaugeInner({
  value,
  totalNotches = 40,
  spacing = 25,
  notchCornerRadius = 0,
  uniformWidth = false,
  width,
  height,
  startAngle = 135,
  endAngle = 405,
  useGradient = false,
  activeGradient,
  inactiveGradient,
  centerValue,
  defaultLabel: defaultLabelProp,
  prefix,
  suffix,
  formatOptions = defaultChartStatFlowFormat,
  inactiveFill,
  activeFill,
  inactiveFillOpacity,
  activeFillOpacity,
  children,
  notchLengthPercent = 100,
  enterTransition,
  enterStaggerScale = 1,
  milestones,
  remainingLabel,
  target,
  thresholds,
}: GaugeInnerProps) {
  const tChart = useChartTranslate();
  const defaultLabel = defaultLabelProp ?? tChart("charts.gauge.defaultLabel");
  const prefersReducedMotion = useReducedMotion();
  const themeActiveGradientId = `gauge-theme-active-${useId().replace(/:/g, "")}`;
  // NOTE: not wrapped in `useStableValue` (`use-stable-value.ts`) — its output
  // is actual `ReactElement[]`, not JSON-serializable plain config, so a
  // content-signature comparison isn't safe here. `defsChildren` stays
  // `children`-identity-keyed.
  const defsChildren = useMemo(() => collectDefsElements(children), [children]);

  const notchTransition: Transition = prefersReducedMotion
    ? { duration: 0 }
    : (enterTransition ?? DEFAULT_NOTCH_ENTER_TRANSITION);

  const stagger = Math.max(0.25, Math.min(2.5, enterStaggerScale));

  const hasCustomInactive = inactiveFill !== undefined && inactiveFill.length > 0;
  const hasCustomActive = activeFill !== undefined && activeFill.length > 0;

  const resolvedActiveFillOpacity = activeFillOpacity ?? DEFAULT_ACTIVE_FILL_OPACITY;
  const resolvedInactiveFillOpacity = inactiveFillOpacity ?? DEFAULT_INACTIVE_FILL_OPACITY;

  const hasMilestones = Boolean(milestones && milestones.length > 0);
  // Milestone labels sit outside the dial (`MILESTONE_LEADER_RESERVE` + a
  // little label air), so the dial itself pulls in by that much when
  // `milestones` is set — never when it is unset, so a plain `Gauge` keeps
  // its exact pre-existing geometry (#248).
  const milestoneReserve = hasMilestones ? MILESTONE_LEADER_RESERVE + 10 : 0;
  const size = Math.min(width, height);
  const centerX = width / 2;
  const centerY = height / 2;
  const outerRadius = size * 0.42 - milestoneReserve;
  const innerRadiusBase = size * 0.28;
  const defaultRadialDepth = outerRadius - innerRadiusBase;
  const depthFactor = Math.min(100, Math.max(5, notchLengthPercent)) / 100;
  const notchLength = defaultRadialDepth * depthFactor;
  const innerRadius = outerRadius - notchLength;

  const activeNotches = Math.round((value / 100) * totalNotches);

  const totalAngle = endAngle - startAngle;
  const availableAngle = totalAngle * (1 - spacing / 100);
  const notchAngle = totalNotches > 0 ? availableAngle / totalNotches : 0;
  const gapDen = totalNotches - 1 > 0 ? totalNotches - 1 : 1;
  const gapAngle = (totalAngle * (spacing / 100)) / gapDen;

  const activeGrad0 = activeGradient?.[0];
  const activeGrad1 = activeGradient?.[1];
  const inactiveGrad0 = inactiveGradient?.[0] ?? activeGrad0;
  const inactiveGrad1 = inactiveGradient?.[1] ?? activeGrad1;
  const useThemePaletteGradient = useGradient && activeGradient === undefined;

  const notches = useMemo(() => {
    return Array.from({ length: totalNotches }, (_, i) => {
      const angle = startAngle + i * (notchAngle + gapAngle) + notchAngle / 2;
      const radians = (angle * Math.PI) / 180;

      const notchWidth = notchAngle * 0.8;
      const halfWidth = (notchWidth * Math.PI) / 180 / 2;

      const x1 = centerX + Math.cos(radians - halfWidth) * outerRadius;
      const y1 = centerY + Math.sin(radians - halfWidth) * outerRadius;
      const x2 = centerX + Math.cos(radians + halfWidth) * outerRadius;
      const y2 = centerY + Math.sin(radians + halfWidth) * outerRadius;

      let x3: number;
      let y3: number;
      let x4: number;
      let y4: number;

      if (uniformWidth) {
        const perpX = Math.cos(radians);
        const perpY = Math.sin(radians);
        x3 = x2 - perpX * notchLength;
        y3 = y2 - perpY * notchLength;
        x4 = x1 - perpX * notchLength;
        y4 = y1 - perpY * notchLength;
      } else {
        x3 = centerX + Math.cos(radians + halfWidth) * innerRadius;
        y3 = centerY + Math.sin(radians + halfWidth) * innerRadius;
        x4 = centerX + Math.cos(radians - halfWidth) * innerRadius;
        y4 = centerY + Math.sin(radians - halfWidth) * innerRadius;
      }

      const denom = totalNotches > 1 ? totalNotches - 1 : 1;
      const gradientFactor = i / denom;
      const gradientColor =
        useGradient && !useThemePaletteGradient && activeGrad0 && activeGrad1
          ? interpolateHex(activeGrad0, activeGrad1, gradientFactor)
          : "var(--chart-1)";

      return {
        index: i,
        points: { x1, y1, x2, y2, x3, y3, x4, y4 },
        isActive: i < activeNotches,
        gradientColor,
      };
    });
  }, [
    totalNotches,
    notchAngle,
    gapAngle,
    centerX,
    centerY,
    outerRadius,
    innerRadius,
    activeNotches,
    startAngle,
    uniformWidth,
    notchLength,
    activeGrad0,
    activeGrad1,
    useGradient,
    useThemePaletteGradient,
  ]);

  // Milestone dots + numbers (F11) — the dot sits mid-band, on the same arc
  // the fill sweeps (angle mapped over `availableAngle`, so a milestone at
  // 100 lands at the outer edge of the last notch). The NUMBER sits just
  // outside the dial (`MILESTONE_LEADER_RESERVE`), joined to its dot by a
  // short dotted leader — the same idiom `RingTickRing` uses for outside
  // labels (`ring.tsx`) — so a dot and its number read as one mark rather
  // than two disconnected scales (#248). `labelRadius` is always strictly
  // greater than `outerRadius`, so a label can never sit on the notch band.
  const milestoneMarks = useMemo(() => {
    if (!milestones || milestones.length === 0) {
      return [];
    }
    const dotRadius = (outerRadius + innerRadius) / 2;
    const leaderRadius = outerRadius + MILESTONE_LEADER_RESERVE;
    const labelRadius = leaderRadius + 2;
    return milestones.map((m) => {
      const angle = valueToAngle(m, startAngle, availableAngle);
      const radians = (angle * Math.PI) / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      return {
        value: m,
        dotX: centerX + cos * dotRadius,
        dotY: centerY + sin * dotRadius,
        leaderX: centerX + cos * leaderRadius,
        leaderY: centerY + sin * leaderRadius,
        labelX: centerX + cos * labelRadius,
        labelY: centerY + sin * labelRadius,
        labelOnRightHalf: cos >= 0,
      };
    });
  }, [milestones, outerRadius, innerRadius, startAngle, availableAngle, centerX, centerY]);

  // A radial tick crossing the notch band at `target`'s angle (same mapping
  // as notches/milestones, #… target/thresholds) — a single value the dial
  // is measured against, e.g. a quarterly goal. Extends `TARGET_TICK_OVERSHOOT`
  // past the outer edge (never just flush with it) so the mark unmistakably
  // pokes out past the notch ring instead of reading as one more notch.
  const targetMark = useMemo(() => {
    if (target === undefined) {
      return null;
    }
    const angle = valueToAngle(target, startAngle, availableAngle);
    const radians = (angle * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return {
      x1: centerX + cos * innerRadius,
      y1: centerY + sin * innerRadius,
      x2: centerX + cos * (outerRadius + TARGET_TICK_OVERSHOOT),
      y2: centerY + sin * (outerRadius + TARGET_TICK_OVERSHOOT),
    };
  }, [target, startAngle, availableAngle, centerX, centerY, innerRadius, outerRadius]);

  // Short outer-rim ticks (furniture) marking named bands — never a colour
  // zone, colour is not status here (the band name only reaches AT via the
  // composed accessible description).
  const thresholdMarks = useMemo(() => {
    if (!thresholds || thresholds.length === 0) {
      return [];
    }
    return thresholds.map((t) => {
      const angle = valueToAngle(t.value, startAngle, availableAngle);
      const radians = (angle * Math.PI) / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      return {
        value: t.value,
        label: t.label,
        x1: centerX + cos * outerRadius,
        y1: centerY + sin * outerRadius,
        x2: centerX + cos * (outerRadius + THRESHOLD_TICK_LENGTH),
        y2: centerY + sin * (outerRadius + THRESHOLD_TICK_LENGTH),
      };
    });
  }, [thresholds, startAngle, availableAngle, centerX, centerY, outerRadius]);

  const createNotchPath = (
    points: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      x3: number;
      y3: number;
      x4: number;
      y4: number;
    },
    cornerRadiusPx: number,
    radialDepth: number,
  ) => {
    const { x1, y1, x2, y2, x3, y3, x4, y4 } = points;

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay);

    const d12 = dist(x1, y1, x2, y2);
    const d23 = dist(x2, y2, x3, y3);
    const d34 = dist(x3, y3, x4, y4);
    const d41 = dist(x4, y4, x1, y1);

    if (cornerRadiusPx <= 0) {
      return `M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4} Z`;
    }

    const minEdge = Math.min(d12, d23, d34, d41);
    const cr = Math.min(
      cornerRadiusPx,
      radialDepth * 0.48,
      d12 * 0.49,
      d23 * 0.49,
      d34 * 0.49,
      d41 * 0.49,
      minEdge * 0.49,
    );

    const r1 = Math.min(cr / d12, 0.49);
    const r2 = Math.min(cr / d23, 0.49);
    const r3 = Math.min(cr / d34, 0.49);
    const r4 = Math.min(cr / d41, 0.49);

    const p1a = { x: lerp(x1, x4, r4), y: lerp(y1, y4, r4) };
    const p1b = { x: lerp(x1, x2, r1), y: lerp(y1, y2, r1) };
    const p2a = { x: lerp(x2, x1, r1), y: lerp(y2, y1, r1) };
    const p2b = { x: lerp(x2, x3, r2), y: lerp(y2, y3, r2) };
    const p3a = { x: lerp(x3, x2, r2), y: lerp(y3, y2, r2) };
    const p3b = { x: lerp(x3, x4, r3), y: lerp(y3, y4, r3) };
    const p4a = { x: lerp(x4, x3, r3), y: lerp(y4, y3, r3) };
    const p4b = { x: lerp(x4, x1, r4), y: lerp(y4, y1, r4) };

    return `M ${p1a.x} ${p1a.y} Q ${x1} ${y1} ${p1b.x} ${p1b.y} L ${p2a.x} ${p2a.y} Q ${x2} ${y2} ${p2b.x} ${p2b.y} L ${p3a.x} ${p3a.y} Q ${x3} ${y3} ${p3b.x} ${p3b.y} L ${p4a.x} ${p4a.y} Q ${x4} ${y4} ${p4b.x} ${p4b.y} Z`;
  };

  // The track paints the ring-track rung (--chart-ring-background), never the
  // card colour: a --chart-background notch is invisible on the card it sits on.
  const bgFillSolid = "var(--chart-ring-background)";
  const activeFillSolid = "var(--chart-1)";

  const denom = totalNotches > 1 ? totalNotches - 1 : 1;

  const resolveBgFill = (notchIndex: number) => {
    if (hasCustomInactive) {
      return inactiveFill as string;
    }
    if (useThemePaletteGradient) {
      return bgFillSolid;
    }
    if (useGradient && inactiveGrad0 && inactiveGrad1) {
      return interpolateHex(inactiveGrad0, inactiveGrad1, notchIndex / denom);
    }
    return bgFillSolid;
  };

  const resolveActiveFill = (notch: (typeof notches)[number]) => {
    if (hasCustomActive) {
      return activeFill as string;
    }
    if (useThemePaletteGradient) {
      return `url(#${themeActiveGradientId})`;
    }
    if (useGradient) {
      return notch.gradientColor;
    }
    return activeFillSolid;
  };

  return (
    <div className="relative" style={{ height, width }}>
      <svg
        aria-hidden="true"
        className="overflow-visible"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        width={width}
      >
        {defsChildren.length > 0 || useThemePaletteGradient ? (
          <defs>
            {useThemePaletteGradient ? (
              <linearGradient id={themeActiveGradientId} x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stopColor="var(--chart-1)" />
                <stop offset="100%" stopColor="var(--chart-5)" />
              </linearGradient>
            ) : null}
            {defsChildren}
          </defs>
        ) : null}
        {notches.map((notch) => (
          <motion.path
            animate={{ opacity: 1, scale: 1 }}
            d={createNotchPath(notch.points, notchCornerRadius, notchLength)}
            fill={resolveBgFill(notch.index)}
            fillOpacity={resolvedInactiveFillOpacity}
            initial={{ opacity: 0, scale: 0 }}
            key={`bg-${notch.index}`}
            style={{
              transformOrigin: `${centerX}px ${centerY}px`,
            }}
            transition={{
              ...notchTransition,
              delay: notch.index * 0.015 * stagger,
            }}
          />
        ))}

        {notches
          .filter((n) => n.isActive)
          .map((notch) => (
            <motion.path
              animate={{ opacity: 1, scale: 1 }}
              d={createNotchPath(notch.points, notchCornerRadius, notchLength)}
              fill={resolveActiveFill(notch)}
              fillOpacity={resolvedActiveFillOpacity}
              initial={{ opacity: 0, scale: 0 }}
              key={`active-${notch.index}`}
              style={{
                transformOrigin: `${centerX}px ${centerY}px`,
              }}
              transition={{
                ...notchTransition,
                // RM-189: the scale spaces the notches; the lead-in is not a stagger.
                delay: 0.3 + notch.index * 0.02 * stagger,
              }}
            />
          ))}

        {milestoneMarks.length > 0 ? (
          <g aria-hidden="true">
            {milestoneMarks.map((mark) => (
              <g key={`milestone-${mark.value}`}>
                <circle
                  cx={mark.dotX}
                  cy={mark.dotY}
                  fill="var(--chart-foreground)"
                  r={3}
                  stroke="var(--chart-background)"
                  strokeWidth={1.5}
                />
                <line
                  data-slot="gauge-milestone-leader"
                  stroke="var(--chart-foreground-muted)"
                  strokeDasharray="1.5 2.5"
                  strokeWidth={1}
                  x1={mark.dotX}
                  x2={mark.leaderX}
                  y1={mark.dotY}
                  y2={mark.leaderY}
                />
                <HaloText
                  dominantBaseline="middle"
                  fontSize={9}
                  fontWeight={600}
                  textAnchor={mark.labelOnRightHalf ? "start" : "end"}
                  x={mark.labelX}
                  y={mark.labelY}
                >
                  {mark.value}
                </HaloText>
              </g>
            ))}
          </g>
        ) : null}

        {targetMark ? (
          <g>
            {/* Halo first: a wider `--chart-background` underlay so the tick
                separates from whatever notch colors it crosses instead of
                blending in (chart-hairline-exempt: masking, not a 2nd ink). */}
            <line
              stroke="var(--chart-background)"
              strokeLinecap="round"
              strokeWidth={TARGET_HALO_STROKE_WIDTH}
              x1={targetMark.x1}
              x2={targetMark.x2}
              y1={targetMark.y1}
              y2={targetMark.y2}
            />
            <line
              data-slot="gauge-target"
              stroke="var(--chart-foreground)"
              strokeLinecap="round"
              strokeWidth={TARGET_STROKE_WIDTH}
              x1={targetMark.x1}
              x2={targetMark.x2}
              y1={targetMark.y1}
              y2={targetMark.y2}
            />
          </g>
        ) : null}

        {thresholdMarks.length > 0 ? (
          <g aria-hidden="true">
            {thresholdMarks.map((mark) => (
              <g key={`threshold-${mark.value}`}>
                {/* Same halo idiom as the target tick above (chart-hairline-exempt). */}
                <line
                  stroke="var(--chart-background)"
                  strokeLinecap="round"
                  strokeWidth={THRESHOLD_HALO_STROKE_WIDTH}
                  x1={mark.x1}
                  x2={mark.x2}
                  y1={mark.y1}
                  y2={mark.y2}
                />
                <line
                  data-slot="gauge-threshold-tick"
                  stroke="var(--chart-grid)"
                  strokeWidth={CHART_HAIRLINE_WIDTH}
                  x1={mark.x1}
                  x2={mark.x2}
                  y1={mark.y1}
                  y2={mark.y2}
                />
              </g>
            ))}
          </g>
        ) : null}
      </svg>

      <div
        className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
        style={{ paddingTop: size * 0.08 }}
      >
        <PieCenterShell
          centerValue={centerValue}
          contextSize={size}
          defaultLabel={defaultLabel}
          formatOptions={formatOptions}
          innerRadiusPx={Math.max(size * 0.2, 52)}
          prefix={prefix}
          suffix={suffix}
        />
        {remainingLabel ? (
          // Budgeted to the donut hole's own chord, not the gauge's whole
          // box — an `absolute inset-0 items-center` overlay is otherwise
          // free to grow across the tick arc (#248). `innerRadius * 2 * 0.9`
          // leaves a small margin inside the hole; `text-balance` keeps a
          // wrapped two-line caption from breaking raggedly.
          <div
            className="mt-1 text-center text-balance text-eyebrow text-muted-foreground uppercase"
            style={{ maxWidth: innerRadius * 2 * 0.9 }}
          >
            {remainingLabel(Math.max(totalNotches - activeNotches, 0))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * @dataShape a single value against a target or threshold bands
 * @avoidWhen the trend over time matters more than the instant — use a line chart
 */
export function Gauge({
  width: widthProp,
  height: heightProp,
  className,
  minWidth = 300,
  accessibleLabel,
  accessibleDescription,
  value,
  target,
  thresholds,
  labels,
  ...props
}: GaugeProps) {
  const resolvedLabels = useMemo<GaugeLabels>(
    () => ({ ...DEFAULT_GAUGE_LABELS, ...labels }),
    [labels],
  );
  // Appends to (or, absent a caller description, becomes) the accessible
  // text ONLY when `target`/`thresholds` are set — a plain `Gauge` keeps
  // whatever `accessibleDescription` it was given, unchanged (#…).
  const targetThresholdText = composeTargetThresholdDescription({
    value,
    target,
    thresholds,
    labels: resolvedLabels,
  });
  const resolvedDescription = targetThresholdText
    ? accessibleDescription
      ? `${accessibleDescription} ${targetThresholdText}`
      : targetThresholdText
    : accessibleDescription;

  const {
    role,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedby,
    tabIndex,
    descId,
  } = useChartA11yContainerProps(accessibleLabel, resolvedDescription);

  if (widthProp != null && heightProp != null) {
    return (
      <div
        aria-describedby={ariaDescribedby}
        aria-label={ariaLabel}
        className={cn("relative inline-flex max-w-full", className)}
        role={role}
        tabIndex={tabIndex}
      >
        <ChartA11yLabel descId={descId} description={resolvedDescription} />
        <GaugeInner
          height={heightProp}
          target={target}
          thresholds={thresholds}
          value={value}
          width={widthProp}
          {...props}
        />
      </div>
    );
  }

  return (
    <div
      aria-describedby={ariaDescribedby}
      aria-label={ariaLabel}
      className={cn("relative w-full max-w-full", className)}
      role={role}
      style={{ minWidth }}
      tabIndex={tabIndex}
    >
      <ChartA11yLabel descId={descId} description={resolvedDescription} />
      <div className="mx-auto aspect-[21/16] w-full max-w-[560px]">
        <ChartParentSize>
          {({ width, height }) =>
            width > 0 && height > 0 ? (
              <GaugeInner
                height={height}
                target={target}
                thresholds={thresholds}
                value={value}
                width={width}
                {...props}
              />
            ) : null
          }
        </ChartParentSize>
      </div>
    </div>
  );
}

Gauge.displayName = "Gauge";
