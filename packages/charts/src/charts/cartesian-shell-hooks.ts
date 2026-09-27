"use client";

import { bisector } from "d3-array";
import { type ReactNode, type RefObject, useEffect, useMemo, useState } from "react";
import type { ChartPhase } from "./chart-phase";
import { type ChartRevealOn, useChartRevealGate } from "./chart-reveal-clip";
import {
  type AxisDomain,
  collectValueAxisConfigs,
  DEFAULT_Y_AXIS_ID,
  type ValueAxisConfig,
  warnValueAxisOnce,
} from "./y-axis-scales";

/**
 * The hooks every cartesian container shares: the reveal gate and enter
 * timer, the phase report, the x bisector and the value-axis requests read
 * off the children. `TimeSeriesChartInner` (Line, Area, Composed), BarChart,
 * ScatterChart and CandlestickChart all call these rather than keeping their
 * own copies, so a fix to one reaches every family.
 */

type Row = Record<string, unknown>;

export interface UseContainerRevealGateOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  revealOn?: ChartRevealOn;
  replayOnClick?: boolean;
}

/**
 * The container's reveal gate (#175). The container element is handed over
 * only when a caller opted in (`revealOn="inView"` or `replayOnClick`):
 * `useInView` observes any non-null ref, so an unconditional ref would mount
 * an `IntersectionObserver` for every default `"mount"` chart (and fail in a
 * jsdom test, which has none).
 */
export function useContainerRevealGate({
  containerRef,
  revealOn,
  replayOnClick,
}: UseContainerRevealGateOptions) {
  return useChartRevealGate({
    replayOnClick,
    revealOn,
    viewportRef: revealOn === "inView" || replayOnClick ? containerRef : undefined,
  });
}

export interface UseChartEnterRevealOptions {
  animationDuration: number;
  /** A change replays the enter reveal (the Studio motion controls). */
  revealSignature?: string;
  /** The reveal gate holds the enter state: no settle timer runs until it releases. */
  held?: boolean;
  /** Each bump from the reveal gate replays the enter reveal. */
  replayEpoch?: number;
}

export interface ChartEnterReveal {
  /** `true` once the enter reveal has settled; interaction waits for it. */
  isLoaded: boolean;
  /** Bumps on every (re)start of the enter reveal; marks key their grow off it. */
  revealEpoch: number;
}

/**
 * The enter reveal of a container whose data has no loading → ready
 * hand-off of its own (Bar, Scatter, Candlestick): every start bumps
 * `revealEpoch`, and `isLoaded` turns true `animationDuration` ms later.
 * Line, Area and Composed run the same reveal inside
 * `useChartPhaseOrchestrator`, which also sequences the skeleton exit.
 */
export function useChartEnterReveal({
  animationDuration,
  revealSignature = "",
  held = false,
  replayEpoch = 0,
}: UseChartEnterRevealOptions): ChartEnterReveal {
  const [isLoaded, setIsLoaded] = useState(false);
  const [revealEpoch, setRevealEpoch] = useState(0);

  useEffect(() => {
    setIsLoaded(false);
    if (held) {
      return;
    }
    setRevealEpoch((n) => n + 1);
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, animationDuration);
    return () => clearTimeout(timer);
  }, [animationDuration, revealSignature, held, replayEpoch]);

  return { isLoaded, revealEpoch };
}

/** Reports every phase change to the caller's `onPhaseChange`. */
export function useChartPhaseReport(
  phase: ChartPhase,
  onPhaseChange: ((phase: ChartPhase) => void) | undefined,
): void {
  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);
}

/** The left bisector over the rows' x, the one nearest-row lookup the tooltip and clicks share. */
export function useDateBisector(xAccessor: (d: Row) => Date) {
  return useMemo(() => bisector<Row, Date>((d) => xAccessor(d)).left, [xAccessor]);
}

/**
 * The `YAxis domain` / `scale` requests read off the direct children (RM-108),
 * with a `ChartMultiples` panel's shared domain on the default axis unless a
 * `YAxis domain` pins one (RM-120).
 */
export function useValueAxisConfigs(
  children: ReactNode,
  facetYDomain?: AxisDomain,
): Record<string, ValueAxisConfig> {
  return useMemo(() => {
    const configs = collectValueAxisConfigs(children);
    if (facetYDomain && !configs[DEFAULT_Y_AXIS_ID]?.domain) {
      configs[DEFAULT_Y_AXIS_ID] = { ...configs[DEFAULT_Y_AXIS_ID], domain: facetYDomain };
    }
    return configs;
  }, [children, facetYDomain]);
}

/** Dev warnings for value-axis requests the chart could not honour, once per axis, never for an empty chart. */
export function useValueAxisWarnings(
  warningsByAxis: Readonly<Record<string, string[]>> | undefined,
  hasData: boolean,
): void {
  useEffect(() => {
    if (!warningsByAxis || !hasData) {
      return;
    }
    for (const [axisId, warnings] of Object.entries(warningsByAxis)) {
      warnValueAxisOnce(axisId, warnings);
    }
  }, [warningsByAxis, hasData]);
}
