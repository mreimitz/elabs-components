/**
 * The agent loop's data door (RM-099): the hand-authored prompt map (`content/agent-loop.json`)
. Typed once here so the rest of the loop never touches raw JSON. The recorded responses live
 * in `recorded.ts`, loaded only when a live call fails.
 */
import map from "../../content/agent-loop.json";

export type AgentLoopCall = { tool: string; args: Record<string, unknown> };
export type AgentLoopSurface = "region-map";
export type AgentLoopPromptEntry = {
  id: string;
  text: string;
  calls: AgentLoopCall[];
  /** Registry block ids, copy-owned under `components/blocks/`. */
  blocks: string[];
  /** A site composition for a prompt no library-only block covers. */
  surface?: AgentLoopSurface;
};

export const PROMPTS = map.prompts as AgentLoopPromptEntry[];
