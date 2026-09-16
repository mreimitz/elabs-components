"use client";

/**
 * The replay channel into the process map (RM-065).
 *
 * `ProcessMap` fixes its own edge types, so a replay cannot hand tokens to an edge through
 * props. `ProcessReplay` provides this context above the map instead, keyed by edge id
 * (`processEdgeId`); `ProcessTransitionEdge` reads its own entry and passes it on as the flow
 * edge's `data.tokens`. Without a provider the read answers `undefined` and the edge's data
 * is exactly what it was before this channel existed.
 *
 * Kept in its own tiny module so the edge imports no replay component.
 */
import { createContext, use } from "react";
import type { FlowEdgeToken } from "@elabs-ai/components-flow";

/** Edge id → the tokens on that edge right now. An edge with no entry carries none. */
export type ProcessReplayTokens = ReadonlyMap<string, readonly FlowEdgeToken[]>;

/** Provided by `ProcessReplay`. `null` (the default) means no replay is running. */
export const ProcessReplayTokensContext = createContext<ProcessReplayTokens | null>(null);

/** The tokens on one edge, or `undefined` outside a replay. */
export function useProcessReplayEdgeTokens(edgeId: string): readonly FlowEdgeToken[] | undefined {
  const tokens = use(ProcessReplayTokensContext);
  if (tokens === null) return undefined;
  return tokens.get(edgeId) ?? EMPTY_TOKENS;
}

const EMPTY_TOKENS: readonly FlowEdgeToken[] = Object.freeze([]);
