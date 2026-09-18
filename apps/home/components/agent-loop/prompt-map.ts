/**
 * The agent loop's data door (RM-099): the hand-authored prompt map (`content/agent-loop.json`)
 * and the GENERATED recorded responses (`content/generated/agent-loop-recorded.json`, written by
 * `pnpm gen --only home` from the same `handleMessage` the hosted `/mcp` wraps). Typed once here
 * so the rest of the loop never touches raw JSON.
 */
import map from "../../content/agent-loop.json";
import recorded from "../../content/generated/agent-loop-recorded.json";

export type AgentLoopCall = { tool: string; args: Record<string, unknown> };
export type AgentLoopSurface = "region-map" | "dashboard-sheet";
export type AgentLoopPromptEntry = {
  id: string;
  text: string;
  calls: AgentLoopCall[];
  /** Registry block ids, copy-owned under `components/blocks/`. */
  blocks: string[];
  /** A site composition for a prompt no library-only block covers. */
  surface?: AgentLoopSurface;
};
export type RecordedCall = AgentLoopCall & { result: unknown };

export const PROMPTS = map.prompts as AgentLoopPromptEntry[];
export const RECORDED = recorded as unknown as Record<string, RecordedCall[]>;

/** Stable key for a call, so a recorded answer is found by what was asked, not by position. */
export const callKey = (tool: string, args: unknown) => `${tool} ${JSON.stringify(args)}`;

/** The recorded answer to `tool(args)` across every prompt, or `undefined` if none was recorded. */
export function findRecorded(
  tool: string,
  args: unknown,
  table: Record<string, RecordedCall[]> = RECORDED,
): unknown {
  const key = callKey(tool, args);
  for (const calls of Object.values(table)) {
    const hit = calls.find((c) => callKey(c.tool, c.args) === key);
    if (hit) return hit.result;
  }
  return undefined;
}
