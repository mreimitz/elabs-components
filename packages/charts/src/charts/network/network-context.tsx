"use client";

/**
 * network-context — the lifted state behind `NetworkChart` (RM-036).
 *
 * Per @.claude/rules/component-api.md ("Composition patterns"): the provider is
 * the only place that knows HOW the chart's state is managed, and the marks
 * (`NetworkNodes` / `NetworkLinks`) depend on the interface rather than on the
 * container.
 *
 * ## Why the hover state lives HERE and not on a node
 *
 * The 180-node acceptance budget rules out per-node React state: 180 components
 * each owning a `hovered` flag is 180 subscriptions and 180 re-renders a frame
 * while a pointer crosses the graph. Instead there is exactly ONE piece of
 * emphasis state — `activeId` — on the provider, pointer events are DELEGATED
 * from the SVG root (so a mark takes no callback props and stays
 * `React.memo`-comparable), and the dim itself is a CSS class + `opacity`
 * transition on each `<g>` rather than a recomputed inline style.
 */

import { createContext, use } from "react";
import type { NetworkLayoutResult } from "./network-layout";
import type { NetworkPoint } from "./network-types";

/** Hover/focus emphasis mode. `"adjacency"` keeps one hop lit and blurs the rest. */
export type NetworkEmphasis = "adjacency" | "none";

export interface NetworkChartContextValue {
  /** The settled layout: positioned nodes, drawn links, adjacency, groups. */
  layout: NetworkLayoutResult;
  emphasis: NetworkEmphasis;
  /** The node currently hovered or keyboard-focused. */
  activeId: string | null;
  /** Ids that stay lit; `null` = nothing is emphasised, everything is at rest. */
  litIds: Set<string> | null;
  /** Draw a node's label only when its weight reaches this. `undefined` = label everything. */
  labelThreshold: number | undefined;
  /** The node being dragged, and how far it has been pulled from its settled position. */
  dragId: string | null;
  dragOffset: NetworkPoint;
}

const NetworkChartContext = createContext<NetworkChartContextValue | null>(null);

export interface NetworkChartProviderProps extends NetworkChartContextValue {
  children: React.ReactNode;
}

/** Wraps the marks. `NetworkChart` renders it; consumers never need to. */
export function NetworkChartProvider({ children, ...value }: NetworkChartProviderProps) {
  return <NetworkChartContext value={value}>{children}</NetworkChartContext>;
}

/** Read the chart's layout + emphasis state. Throws outside a `NetworkChartProvider`. */
export function useNetworkChart(): NetworkChartContextValue {
  const value = use(NetworkChartContext);
  if (!value) {
    throw new Error("useNetworkChart must be used inside a <NetworkChartProvider> (NetworkChart).");
  }
  return value;
}
