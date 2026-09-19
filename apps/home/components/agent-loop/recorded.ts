/**
 * The offline fallback's data (RM-099): the GENERATED recorded responses
 * (`content/generated/agent-loop-recorded.json`, written by `pnpm gen --only home` from the same
 * `handleMessage` the hosted `/mcp` wraps). `mcp-client.ts` reaches this module only through a
 * dynamic `import()` when a live call fails, so the page never ships it up front.
 */
import recorded from "../../content/generated/agent-loop-recorded.json";
import type { AgentLoopCall } from "./prompt-map";

export type RecordedCall = AgentLoopCall & { result: unknown };
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
