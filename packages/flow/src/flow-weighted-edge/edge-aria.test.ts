import { describe, expect, it } from "vitest";
import { buildWeightedEdgeAriaLabel, withWeightedEdgeAria } from "./edge-aria";
import type { BrandFlowWeightedEdge } from "./flow-weighted-edge";

/** Minimal edge factory — only the fields `buildWeightedEdgeAriaLabel` reads. */
function makeEdge(overrides: Partial<BrandFlowWeightedEdge> = {}): BrandFlowWeightedEdge {
  return {
    id: "e1",
    source: "n1",
    target: "n2",
    type: "weighted",
    data: {},
    ...overrides,
  } as BrandFlowWeightedEdge;
}

describe("buildWeightedEdgeAriaLabel", () => {
  it("composes weight only", () => {
    const edge = makeEdge({ data: { weight: 4 } });
    expect(buildWeightedEdgeAriaLabel(edge)).toBe("Edge from n1 to n2, weight 4");
  });

  it("composes weight plus value", () => {
    const edge = makeEdge({ data: { weight: 4, value: 7, valueDomain: [0, 10] } });
    expect(buildWeightedEdgeAriaLabel(edge)).toBe("Edge from n1 to n2, weight 4, value 7");
  });

  it("appends the pill text when label/secondaryLabel are present", () => {
    const edge = makeEdge({ data: { weight: 1, label: "min", secondaryLabel: "1×" } });
    expect(buildWeightedEdgeAriaLabel(edge)).toBe("Edge from n1 to n2, weight 1, min 1×");
  });

  it("appends only the label present when the other pill field is absent", () => {
    const edge = makeEdge({ data: { weight: 4, secondaryLabel: "avg 2d" } });
    expect(buildWeightedEdgeAriaLabel(edge)).toBe("Edge from n1 to n2, weight 4, avg 2d");
  });

  it("an explicit edge.ariaLabel always wins, untouched", () => {
    const edge = makeEdge({
      ariaLabel: "Custom name",
      data: { weight: 4, value: 7, label: "x" },
    });
    expect(buildWeightedEdgeAriaLabel(edge)).toBe("Custom name");
  });

  it("returns undefined when the edge carries no weight, value or labels — the untouched default", () => {
    const edge = makeEdge({ data: {} });
    expect(buildWeightedEdgeAriaLabel(edge)).toBeUndefined();
  });

  it("returns undefined for an edge with no data at all", () => {
    const edge = makeEdge({ data: undefined });
    expect(buildWeightedEdgeAriaLabel(edge)).toBeUndefined();
  });

  it("uses nameOf to resolve endpoint display names", () => {
    const edge = makeEdge({ source: "n1", target: "n2", data: { weight: 2 } });
    const nameOf = (id: string) => ({ n1: "Order placed", n2: "Picked" })[id]!;
    expect(buildWeightedEdgeAriaLabel(edge, { nameOf })).toBe(
      "Edge from Order placed to Picked, weight 2",
    );
  });

  it("honors weightLabel/valueLabel/formatNumber overrides", () => {
    const edge = makeEdge({ data: { weight: 4.5, value: 2, valueDomain: [0, 10] } });
    expect(
      buildWeightedEdgeAriaLabel(edge, {
        weightLabel: "frequency",
        valueLabel: "duration",
        formatNumber: (n) => n.toFixed(1),
      }),
    ).toBe("Edge from n1 to n2, frequency 4.5, duration 2.0");
  });
});

describe("withWeightedEdgeAria", () => {
  it("stamps ariaLabel onto every edge that has none", () => {
    const edges = [
      makeEdge({ id: "e1", data: { weight: 1 } }),
      makeEdge({ id: "e2", data: { weight: 8 } }),
    ];
    const result = withWeightedEdgeAria(edges);
    expect(result.map((e) => e.ariaLabel)).toEqual([
      "Edge from n1 to n2, weight 1",
      "Edge from n1 to n2, weight 8",
    ]);
  });

  it("never overwrites a caller-supplied ariaLabel", () => {
    const edges = [makeEdge({ id: "e1", ariaLabel: "Kept", data: { weight: 9 } })];
    const result = withWeightedEdgeAria(edges);
    expect(result[0]!.ariaLabel).toBe("Kept");
    // Untouched — same reference, not just an equal string.
    expect(result[0]).toBe(edges[0]);
  });

  it("leaves an edge with nothing to add untouched (identity preserved)", () => {
    const edges = [makeEdge({ id: "e1", data: {} })];
    const result = withWeightedEdgeAria(edges);
    expect(result[0]!.ariaLabel).toBeUndefined();
    expect(result[0]).toBe(edges[0]);
  });

  it("returns a new array", () => {
    const edges = [makeEdge({ id: "e1", data: { weight: 1 } })];
    expect(withWeightedEdgeAria(edges)).not.toBe(edges);
  });
});
