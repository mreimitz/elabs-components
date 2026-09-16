"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type ChartPhase, type ChartStatus, resolveRestingChartPhase } from "./chart-phase";

export interface UseChartPhaseOrchestratorOptions {
  chartStatus: ChartStatus;
  targetData: Record<string, unknown>[];
  skeletonData: Record<string, unknown>[];
  animationDuration: number;
  yDomainTweenDuration: number;
  /** Signature of motion URL state — replays clip reveal in Studio. */
  revealSignature?: string;
  /** Skip mount/signature enter reveal (static docs previews). */
  skipEnterReveal?: boolean;
  /**
   * The enter reveal is held by the RM-020 gate (`useChartRevealGate`,
   * `revealOn="inView"` before the chart has scrolled into view). While true
   * the phase stays `"revealing"` and its settle timer does not start, so the
   * hold cannot silently lapse into `"ready"` off-screen (#175). Default `false`.
   */
  holdReveal?: boolean;
  /**
   * Replay counter from the same gate (`replayOnClick` + keyboard replays).
   * Each bump re-enters `"revealing"` from `"ready"`, or restarts a reveal
   * already in flight (#175). Default `0`.
   */
  replayEpoch?: number;
}

export function useChartPhaseOrchestrator({
  chartStatus,
  targetData,
  skeletonData,
  animationDuration,
  yDomainTweenDuration,
  revealSignature = "",
  skipEnterReveal = false,
  holdReveal = false,
  replayEpoch = 0,
}: UseChartPhaseOrchestratorOptions) {
  const [chartPhase, setChartPhase] = useState<ChartPhase>(() =>
    resolveRestingChartPhase(chartStatus),
  );
  const [plotData, setPlotData] = useState<Record<string, unknown>[]>(() =>
    chartStatus === "loading" ? skeletonData : targetData,
  );
  const [revealEpoch, setRevealEpoch] = useState(0);
  const [concealEpoch, setConcealEpoch] = useState(0);
  const [isLoaded, setIsLoaded] = useState(() => chartStatus === "ready");
  const prevStatusRef = useRef(chartStatus);
  const phaseRef = useRef(chartPhase);
  phaseRef.current = chartPhase;

  // Status transition branches for animation durations.
  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    if (prevStatus === chartStatus) {
      return;
    }
    prevStatusRef.current = chartStatus;

    if (chartStatus === "ready" && prevStatus === "loading") {
      setIsLoaded(false);
      if (animationDuration <= 0) {
        if (yDomainTweenDuration <= 0) {
          setPlotData(targetData);
          setChartPhase("revealing");
        } else {
          setChartPhase("gridTweenReady");
        }
      } else {
        setChartPhase("exiting");
      }
      return;
    }

    if (chartStatus === "loading" && prevStatus === "ready") {
      setIsLoaded(false);
      if (animationDuration <= 0) {
        if (yDomainTweenDuration <= 0) {
          setPlotData(skeletonData);
          setChartPhase("loading");
        } else {
          setChartPhase("gridTweenLoading");
        }
      } else {
        setConcealEpoch((epoch) => epoch + 1);
        setChartPhase("exitingReady");
      }
    }
  }, [animationDuration, chartStatus, skeletonData, targetData, yDomainTweenDuration]);

  // revealSignature (and a gate replay, #175) replays enter.
  useEffect(() => {
    if (skipEnterReveal) {
      return;
    }
    if (chartStatus !== "ready") {
      return;
    }
    if (phaseRef.current !== "ready") {
      return;
    }

    setChartPhase("revealing");
    setIsLoaded(false);
  }, [animationDuration, chartStatus, revealSignature, skipEnterReveal, replayEpoch]);

  useEffect(() => {
    switch (chartPhase) {
      case "loading":
        if (chartStatus === "loading") {
          setPlotData(skeletonData);
        }
        break;
      case "exiting":
        setPlotData(skeletonData);
        break;
      case "exitingReady":
      case "gridTweenLoading":
      case "gridTweenReady":
      case "revealing":
      case "ready":
        setPlotData(targetData);
        break;
      default:
        break;
    }
  }, [chartPhase, chartStatus, skeletonData, targetData]);

  /** Loading pulse exit finished — tween grid to ready spacing next. */
  const notifyLoadingPulseComplete = useCallback(() => {
    if (phaseRef.current !== "exiting") {
      return;
    }
    setChartPhase("gridTweenReady");
  }, []);

  /** Ready series conceal finished — tween grid to loading spacing next. */
  const notifyRevealConcealComplete = useCallback(() => {
    if (phaseRef.current !== "exitingReady") {
      return;
    }
    setChartPhase("gridTweenLoading");
  }, []);

  /** Grid tween finished — enter the next resting phase. */
  const notifyYDomainTweenComplete = useCallback(() => {
    if (phaseRef.current === "gridTweenLoading") {
      setChartPhase("loading");
      return;
    }
    if (phaseRef.current === "gridTweenReady") {
      setChartPhase("revealing");
    }
  }, []);

  useEffect(() => {
    if (chartPhase !== "revealing") {
      return;
    }

    if (animationDuration <= 0) {
      setRevealEpoch((epoch) => epoch + 1);
      setChartPhase("ready");
      setIsLoaded(true);
      return;
    }

    // Held for the in-view gate: stay in "revealing" with no settle timer. The
    // release (or a replay) re-runs this effect and starts the real reveal.
    if (holdReveal) {
      return;
    }

    setRevealEpoch((epoch) => epoch + 1);

    const timer = window.setTimeout(() => {
      setChartPhase("ready");
      setIsLoaded(true);
    }, animationDuration);
    return () => window.clearTimeout(timer);
  }, [animationDuration, chartPhase, holdReveal, replayEpoch]);

  return {
    chartPhase,
    plotData,
    revealEpoch,
    concealEpoch,
    isLoaded,
    notifyLoadingPulseComplete,
    notifyRevealConcealComplete,
    notifyYDomainTweenComplete,
  };
}
