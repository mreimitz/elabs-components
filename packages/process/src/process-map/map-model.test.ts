import { describe, expect, it } from "vitest";
import { computeEdgeWeightScale, DEFAULT_EDGE_WIDTH_RANGE } from "@elabs-ai/components-flow";
import { discoverGraph } from "../core/discover-graph";
import { detectRework } from "../core/detect-rework";
import { generateSyntheticLog } from "../core/fixtures/synthetic-log";
import type { ProcessGraph } from "../core/types";
import {
  activityAriaLabel,
  activityRole,
  buildProcessMapModel,
  edgeMetricLabel,
  formatDurationMs,
  formatMetricValue,
  nodeMetricLabel,
  processEdgeId,
  processGraphStructureKey,
  resolveActivityFrequencyMode,
  resolveTransitionFrequencyMode,
  selectionNeighbourhood,
  transitionAriaLabel,
  transitionShape,
} from "./map-model";

const log = generateSyntheticLog({ cases: 60, seed: 7 });
const graph: ProcessGraph = discoverGraph(log);
const rework = detectRework(log);

describe("metric resolution", () => {
  it("maps the three edge-only frequency modes onto readings an activity can answer", () => {
    expect(resolveActivityFrequencyMode("relative_antecedent")).toBe("relative_case");
    expect(resolveActivityFrequencyMode("relative_consequent")).toBe("relative_case");
    expect(resolveActivityFrequencyMode("max_repetitions")).toBe("absolute");
    expect(resolveActivityFrequencyMode("absolute_case")).toBe("absolute_case");
  });

  it("only resolves max_repetitions for a transition", () => {
    expect(resolveTransitionFrequencyMode("max_repetitions")).toBe("absolute");
    expect(resolveTransitionFrequencyMode("relative_antecedent")).toBe("relative_antecedent");
  });

  it("labels the RESOLVED mode, so no value is printed under another measure's name", () => {
    // The activity cannot answer "share of the source's traffic", so it must not claim to.
    expect(nodeMetricLabel("relative_antecedent")).toBe("Share of cases");
    expect(edgeMetricLabel("relative_antecedent")).toBe("Share of source traffic");
    expect(nodeMetricLabel("median")).toBe("Median duration");
  });
});

describe("formatting", () => {
  it("prints a duration with one decimal below ten and none above", () => {
    expect(formatDurationMs(3.4 * 24 * 3_600_000)).toBe("3.4 d");
    expect(formatDurationMs(18 * 3_600_000)).toBe("18 h");
    expect(formatDurationMs(0)).toBe("0 s");
  });

  it("answers an em dash rather than NaN for a hole in the data", () => {
    expect(formatDurationMs(Number.NaN)).toBe("—");
    expect(formatDurationMs(-1)).toBe("—");
    expect(formatMetricValue(Number.POSITIVE_INFINITY, "absolute")).toBe("—");
  });

  it("prints a share as a percentage and a count grouped", () => {
    expect(formatMetricValue(0.1234, "relative_case")).toBe("12.3%");
    expect(formatMetricValue(1234, "absolute")).toBe((1234).toLocaleString());
  });
});

describe("identity", () => {
  it("keys an edge the way /core keys it, so a selection round-trips", () => {
    const first = graph.transitions[0]!;
    expect(processEdgeId(first.source, first.target)).toContain(first.source);
    expect(processEdgeId(first.source, first.target)).toContain(first.target);
  });

  it("keys the STRUCTURE only — a metric change must not move the key", () => {
    expect(processGraphStructureKey(graph)).toBe(processGraphStructureKey(graph));
    const reordered: ProcessGraph = {
      ...graph,
      activities: [...graph.activities].reverse(),
      transitions: [...graph.transitions].reverse(),
    };
    expect(processGraphStructureKey(reordered)).toBe(processGraphStructureKey(graph));
  });
});

describe("buildProcessMapModel", () => {
  const model = buildProcessMapModel({
    graph,
    metric: { node: "absolute_case", edge: "absolute" },
    rework,
  });

  it("emits one node per activity and one edge per transition", () => {
    expect(model.nodes).toHaveLength(graph.activities.length);
    expect(model.edges).toHaveLength(graph.transitions.length);
  });

  it("registers every node and edge against this package's own types", () => {
    expect(new Set(model.nodes.map((n) => n.type))).toEqual(new Set(["process-activity"]));
    expect(new Set(model.edges.map((e) => e.type))).toEqual(new Set(["process-transition"]));
  });

  it("gives the table twin exactly the canvas's numbers", () => {
    for (const row of model.activityRows) {
      const node = model.nodes.find((n) => n.id === row.id);
      expect(node?.data.primaryLabel).toBe(row.primaryLabel);
    }
    for (const row of model.transitionRows) {
      const edge = model.edges.find((e) => e.id === row.id);
      expect(edge?.data?.label).toBe(row.primaryLabel);
    }
  });

  it("resolves through flow's own scale into the [1.5, 8] px band, monotonically", () => {
    // `data.weight` is the RAW metric value; `flow` owns the min-max into
    // DEFAULT_EDGE_WIDTH_RANGE. Asserting through the real scale is what proves the
    // encoding, rather than asserting a band this package does not apply.
    const widths = computeEdgeWeightScale(
      model.edges.map((edge) => ({ id: edge.id, data: edge.data })),
    );
    const [floor, ceiling] = DEFAULT_EDGE_WIDTH_RANGE;
    for (const edge of model.edges) {
      const width = widths.get(edge.id)!;
      expect(width).toBeGreaterThanOrEqual(floor);
      expect(width).toBeLessThanOrEqual(ceiling);
    }
    const sorted = [...model.edges].sort((a, b) => a.data!.weight! - b.data!.weight!);
    for (let i = 1; i < sorted.length; i += 1) {
      expect(widths.get(sorted[i]!.id)!).toBeGreaterThanOrEqual(widths.get(sorted[i - 1]!.id)!);
    }
  });

  it("prints a label on every edge, so width is never the only channel", () => {
    for (const edge of model.edges) {
      expect(edge.data!.label).toBeTruthy();
    }
  });

  it("keeps node saturation inside [0, 1] and mid-scale for a flat domain", () => {
    for (const node of model.nodes) {
      expect(node.data.saturation).toBeGreaterThanOrEqual(0);
      expect(node.data.saturation).toBeLessThanOrEqual(1);
    }
    const flat = buildProcessMapModel({
      graph: { ...graph, activities: [graph.activities[0]!] },
      metric: { node: "absolute", edge: "absolute" },
    });
    expect(flat.nodes[0]!.data.saturation).toBe(0.5);
  });

  it("applies the back-edge ids the layout reports, on the second pass", () => {
    const id = model.edges[0]!.id;
    const second = buildProcessMapModel({
      graph,
      metric: { node: "absolute_case", edge: "absolute" },
      backEdgeIds: new Set([id]),
    });
    expect(second.edges.find((e) => e.id === id)!.data!.isBackEdge).toBe(true);
  });

  it("carries the rework tally onto the node that repeats", () => {
    const repeating = Object.entries(rework.perActivity).find(
      ([, tally]) => tally.selfLoops + tally.loops > 0,
    );
    if (!repeating) return; // a log with no rework is a valid log; nothing to assert
    const node = model.nodes.find((n) => n.id === repeating[0]);
    expect(node?.data.reworkCount).toBeGreaterThan(0);
  });
});

describe("selection", () => {
  const focus = graph.transitions[0]!.source;
  const neighbourhood = selectionNeighbourhood(graph, { kind: "activity", id: focus })!;

  it("keeps the activity, its neighbours and its incident edges", () => {
    expect(neighbourhood.activities.has(focus)).toBe(true);
    for (const transition of graph.transitions) {
      if (transition.source !== focus && transition.target !== focus) continue;
      expect(
        neighbourhood.transitions.has(processEdgeId(transition.source, transition.target)),
      ).toBe(true);
    }
  });

  it("marks everything outside the neighbourhood excluded AND aria-disabled", () => {
    const model = buildProcessMapModel({
      graph,
      metric: { node: "absolute", edge: "absolute" },
      selection: { kind: "activity", id: focus },
    });
    const selected = model.nodes.find((n) => n.id === focus)!;
    expect(selected.data.selectionState).toBe("selected");
    const excluded = model.nodes.filter((n) => n.data.selectionState === "excluded");
    for (const node of excluded) {
      expect(node.domAttributes).toMatchObject({ "aria-disabled": "true" });
    }
  });

  it("answers null when nothing is selected", () => {
    expect(selectionNeighbourhood(graph, null)).toBeNull();
  });
});

describe("non-colour channels reach assistive technology", () => {
  const model = buildProcessMapModel({
    graph,
    metric: { node: "absolute_case", edge: "absolute" },
    rework,
  });

  it("says a node's role in words, not only with a glyph", () => {
    const start = model.nodes.find((n) => n.data.isStart)!;
    expect(activityRole(start.data)).toMatch(/^Start/);
    expect(activityAriaLabel(start.data)).toContain("start");
    expect(activityAriaLabel(start.data)).toContain(start.data.primaryLabel);
  });

  it("says an edge's shape in words, not only with a dash pattern", () => {
    const edge = model.edges[0]!;
    expect(["Self-loop", "Back edge", "Forward"]).toContain(transitionShape(edge.data!));
    const back = { ...edge.data!, isBackEdge: true, isSelfLoop: false };
    expect(transitionAriaLabel(back, "Transitions")).toContain("Back edge");
    const loop = { ...edge.data!, isSelfLoop: true };
    expect(transitionAriaLabel(loop, "Transitions")).toContain("Self-loop");
  });

  it("names every node and edge, and stamps that name for React Flow", () => {
    for (const node of model.nodes) expect(node.ariaLabel).toBe(activityAriaLabel(node.data));
    for (const edge of model.edges) expect(edge.ariaLabel).toBeTruthy();
  });
});
