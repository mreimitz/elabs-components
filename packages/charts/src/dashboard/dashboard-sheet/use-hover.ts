"use client";

import type { DashboardHover } from "../core/store";
import { useDashboard, useDashboardActions } from "./use-dashboard";

/** The shared hover channel and its setter. */
export function useHover(): [DashboardHover | null, (hover: DashboardHover | null) => void] {
  const hover = useDashboard((state) => state.hover);
  const actions = useDashboardActions();
  return [hover, actions.setHover];
}
