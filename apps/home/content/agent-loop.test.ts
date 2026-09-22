// RM-099 — the curated prompt map is valid against the repo's real state.
import { describe, expect, it } from "vitest";
import map from "./agent-loop.json";
import recorded from "./generated/agent-loop-recorded.json";
import blocks from "./generated/blocks.json";
import manifest from "../../../brand-ui.manifest.json";

const blockIds = new Set((blocks as { name: string }[]).map((b) => b.name));
const componentNames = new Set(
  Object.values(manifest.packages as Record<string, { components?: (string | { name: string })[] }>)
    .flatMap((p) => p.components ?? [])
    .map((c) => (typeof c === "string" ? c : c.name)),
);
const rec = recorded as Record<string, { tool: string; args: unknown; result: unknown }[]>;

describe("agent-loop.json", () => {
  // Five until 2026-09-22, when the dashboard pack was parked (parked/README.md) and its
  // prompt ("A small dashboard I can rearrange") went with it.
  it("has four curated prompts with unique ids", () => {
    expect(map.prompts).toHaveLength(4);
    expect(new Set(map.prompts.map((p) => p.id)).size).toBe(4);
  });
  for (const prompt of map.prompts) {
    describe(prompt.id, () => {
      it("makes at least two calls, each to a hosted tool", () => {
        expect(prompt.calls.length).toBeGreaterThanOrEqual(2);
        for (const c of prompt.calls)
          expect(["info", "search", "docs", "tokens", "chart_for"]).toContain(c.tool);
      });
      it("names only components that exist in the manifest", () => {
        for (const c of prompt.calls.filter((c) => c.tool === "docs"))
          expect(componentNames).toContain((c.args as { component: string }).component);
      });
      it("renders only block ids that exist in blocks.json, or a named surface", () => {
        for (const id of prompt.blocks) expect(blockIds).toContain(id);
        expect(
          prompt.blocks.length > 0 || typeof (prompt as { surface?: string }).surface === "string",
        ).toBe(true);
      });
      it("has a recorded response for every call, in order", () => {
        const calls = rec[prompt.id];
        expect(calls).toHaveLength(prompt.calls.length);
        prompt.calls.forEach((c, i) => {
          expect(calls![i]!.tool).toBe(c.tool);
          expect(calls![i]!.args).toEqual(c.args);
          expect(calls![i]!.result).toBeTruthy();
        });
      });
    });
  }
});
