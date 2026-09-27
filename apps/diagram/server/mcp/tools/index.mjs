/**
 * DG-35 — the tool registry. Each group module exports an array of tools:
 *
 *   { name, description, inputSchema, handler(args, ctx) }
 *
 * `name` is the WIRE name: `^[a-zA-Z0-9_-]{1,64}$` (the Claude API's tool-name rule; Claude
 * Code shows it as `mcp__atlas__<name>`), so the plan's dotted names become underscores
 * (`diagram.read` → `diagram_read`). `description` is written for a model: when to use it
 * and what comes back. `handler` returns a JSON value (sent as text) or an MCP result with
 * its own `content` (an image); it throws to fail — the handler turns that into `isError`.
 *
 * Later items add a group here (DG-24 `catalog.mjs`, DG-26 `compose_use_component`, DG-31
 * `story_set_steps`) — the registry is the one place that lists them.
 */
import { specTools } from "./spec.mjs";
import { workspaceTools } from "./workspace.mjs";

export const TOOL_NAME = /^[a-zA-Z0-9_-]{1,64}$/;

export const TOOL_GROUPS = [workspaceTools, specTools];

export function createToolRegistry(groups = TOOL_GROUPS) {
  const byName = new Map();
  for (const tool of groups.flat()) {
    if (!TOOL_NAME.test(tool.name)) throw new Error(`Bad MCP tool name: ${tool.name}`);
    if (byName.has(tool.name)) throw new Error(`Duplicate MCP tool: ${tool.name}`);
    byName.set(tool.name, tool);
  }
  return {
    list: () => [...byName.values()],
    get: (name) => (typeof name === "string" ? byName.get(name) : undefined),
  };
}
