import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_EDGE_WIDTH_RANGE } from "../flow-weighted-edge/weight-scale";
import { FLOW_EDGE_DEFAULTS } from "./flow-edge-defaults";

// The jsdom environment gives `import.meta.url` an http: scheme, so resolve from the
// Vitest root (this package) instead — the same approach as `no-raw-base-edge.test.ts`.
const SRC = join(process.cwd(), "src");

/**
 * Every shipped module that draws an edge. `flow-edge-defaults.ts` is deliberately
 * absent: it is the one place the numbers are written down.
 */
const EDGE_MODULES = [
  "flow-edge/flow-edge.tsx",
  "flow-button-edge/flow-button-edge.tsx",
  "flow-edge-path/flow-edge-path.tsx",
  "flow-edge-path/flow-edge-label.tsx",
  "flow-floating-edge/flow-floating-edge.tsx",
  "flow-edge-tokens/flow-edge-tokens.tsx",
  "flow-smart-edge/flow-smart-edge.tsx",
  "flow-weighted-edge/flow-weighted-edge.tsx",
  "flow-weighted-edge/edge-label-pill.tsx",
  "flow-weighted-edge/weight-scale.ts",
  "flow-self-loop-edge/flow-self-loop-edge.tsx",
];

/** Source with block and line comments removed, so prose about the old literal does not count. */
function code(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

describe("FLOW_EDGE_DEFAULTS", () => {
  it("is the resting look every plain edge draws", () => {
    expect(FLOW_EDGE_DEFAULTS).toEqual({
      stroke: "var(--flow-edge)",
      strokeWidth: 1.5,
      selectedStroke: "var(--ring)",
      selectedWidthIncrease: 1.5,
    });
    expect(Object.isFrozen(FLOW_EDGE_DEFAULTS)).toBe(true);
  });

  it("is the floor of the weighted-edge width range, so the two can never drift apart", () => {
    expect(DEFAULT_EDGE_WIDTH_RANGE[0]).toBe(FLOW_EDGE_DEFAULTS.strokeWidth);
  });

  it("is the only place an edge's resting or selected width is written as a literal", () => {
    const offenders = EDGE_MODULES.filter((rel) => /(?<![\d.])1\.5(?!\d)/.test(code(rel)));
    expect(
      offenders,
      `These edge modules still hard-code the 1.5px edge width; read it from ` +
        `FLOW_EDGE_DEFAULTS instead: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("leaves no edge with its own selected-stroke branch", () => {
    // Selection is drawn once, by FlowEdgePath. An edge that still picks `--ring` itself
    // would diverge from the shared look the next time it changes.
    const offenders = EDGE_MODULES.filter((rel) =>
      /selected\s*\?\s*["']var\(--ring\)["']/.test(code(rel)),
    );
    expect(offenders).toEqual([]);
  });
});
