"use client";
/**
 * What each prompt renders (RM-099). Every render is a dynamic import, so a block's chunk —
 * the map engine above all — loads only when a prompt that renders it runs.
 */
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { AgentLoopSurface } from "./prompt-map";

const loading = () => null;

export const BLOCK_RENDERS: Record<string, ComponentType> = {
  "kpi-movers-01": dynamic(
    () => import("../blocks/kpi-movers-01/kpi-movers").then((m) => () => <m.KpiMovers />),
    { loading },
  ),
  "kpi-trend-reference-01": dynamic(
    () =>
      import("../blocks/kpi-trend-reference-01/kpi-trend-reference").then((m) => () => (
        <m.KpiTrendReference />
      )),
    { loading },
  ),
  "kpi-status-threshold-01": dynamic(
    () =>
      import("../blocks/kpi-status-threshold-01/kpi-status-threshold").then((m) => () => (
        <m.KpiStatusThreshold />
      )),
    { loading },
  ),
  "infographic-cohort-retention-01": dynamic(
    () =>
      import("../blocks/infographic-cohort-retention-01/infographic-cohort-retention").then(
        (m) => () => <m.InfographicCohortRetention />,
      ),
    { loading },
  ),
};

export const SURFACE_RENDERS: Record<AgentLoopSurface, ComponentType<{ label: string }>> = {
  "region-map": dynamic(() => import("./region-map").then((m) => m.RegionMap), {
    ssr: false,
    loading,
  }),
};
