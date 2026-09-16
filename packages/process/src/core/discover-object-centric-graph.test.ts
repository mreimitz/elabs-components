import { describe, expect, it } from "vitest";

import { fromOcel } from "./adapters/ocel";
import {
  abstractObjectCentricGraph,
  discoverObjectCentricGraph,
  objectCentricProcessGraph,
  objectTypeColorScale,
} from "./discover-object-centric-graph";
import { OCEL_SAMPLE } from "./fixtures/ocel-sample";

function sampleGraph() {
  const result = fromOcel(OCEL_SAMPLE);
  if (!result.ok) throw new Error("fixture must parse");
  return discoverObjectCentricGraph(result.logs, { objectTypes: result.objectTypes });
}

describe("discoverObjectCentricGraph", () => {
  it("merges an activity shared by all three types into one node with three perType entries", () => {
    const graph = sampleGraph();
    const pack = graph.activities.find((activity) => activity.id === "Pack")!;
    expect(pack.perType).toEqual({
      order: { instances: 1, cases: 1 },
      item: { instances: 2, cases: 2 },
      package: { instances: 1, cases: 1 },
    });
    // One OCEL event, however many objects it touched.
    expect(pack.events).toBe(1);
  });

  it("keeps an activity present in only one type single-type", () => {
    const graph = sampleGraph();
    const pick = graph.activities.find((activity) => activity.id === "Pick Item")!;
    expect(Object.keys(pick.perType)).toEqual(["item"]);
    expect(pick.perType.item).toEqual({ instances: 1, cases: 1 });
  });

  it("keeps edges per type — never merged across types", () => {
    const graph = sampleGraph();
    expect(graph.objectTypes).toEqual(["order", "item", "package"]);
    const pairs = (type: string) =>
      graph.transitionsByType[type]!.map((t) => `${t.source}>${t.target}:${t.count}`).sort();
    expect(pairs("order")).toEqual(["Pack>Ship:1", "Place Order>Pack:1"]);
    expect(pairs("item")).toEqual([
      "Pick Item>Pack:1",
      "Place Order>Pack:1",
      "Place Order>Pick Item:1",
    ]);
    expect(pairs("package")).toEqual(["Pack>Ship:1"]);
  });

  it("flattens to a ProcessGraph that sums shared transitions for layout", () => {
    const flat = objectCentricProcessGraph(sampleGraph());
    expect(flat.activities.map((a) => a.id).sort()).toEqual([
      "Pack",
      "Pick Item",
      "Place Order",
      "Ship",
    ]);
    const placeToPack = flat.transitions.find(
      (t) => t.source === "Place Order" && t.target === "Pack",
    )!;
    expect(placeToPack.count).toBe(2);
    expect(flat.totals).toEqual({ cases: 4, events: 4, variants: 4 });
    expect(flat.activities.find((a) => a.id === "Pack")).toMatchObject({ instances: 1, cases: 4 });
  });

  it("abstracts one type without touching another", () => {
    const graph = sampleGraph();
    const abstracted = abstractObjectCentricGraph(graph, {
      item: { activities: 0.34, paths: 1, keepConnected: false },
    });
    expect(abstracted.transitionsByType.order).toBe(graph.transitionsByType.order);
    expect(abstracted.transitionsByType.item!.length).toBeLessThan(
      graph.transitionsByType.item!.length,
    );
    expect(abstracted.hiddenByType.order).toEqual({ activities: 0, paths: 0 });
    expect(abstracted.hiddenByType.item!.activities).toBeGreaterThan(0);
    // Event counts are carried over, never restated.
    expect(abstracted.activities.find((a) => a.id === "Pack")!.events).toBe(1);
  });

  it("colours object types with the shared RM-054 scale and a text code per type", () => {
    const scale = objectTypeColorScale(sampleGraph());
    // Ranked by object count: item (2) first, then order and package (1 each) by name.
    expect(scale.legend.map((entry) => [entry.activityId, entry.token])).toEqual([
      ["item", "--chart-1"],
      ["order", "--chart-2"],
      ["package", "--chart-3"],
    ]);
    const codes = scale.legend.map((entry) => entry.code);
    expect(new Set(codes).size).toBe(3);
  });
});
