/**
 * Object-centric mode — RM-066. The pure model plus the table twin; the canvas itself is
 * covered in a real browser by `process-map-object-centric.stories.tsx`.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fromOcel } from "../core/adapters/ocel";
import {
  discoverObjectCentricGraph,
  objectCentricProcessGraph,
  objectTypeColorScale,
} from "../core/discover-object-centric-graph";
import { discoverGraph } from "../core/discover-graph";
import { OCEL_SAMPLE } from "../core/fixtures/ocel-sample";
import { generateSyntheticLog } from "../core/fixtures/synthetic-log";
import {
  buildObjectCentricMapModel,
  buildProcessMapModel,
  objectCentricEdgeId,
  processEdgeId,
  type ProcessTransitionEdgeData,
} from "./map-model";
import { ProcessMap } from "./process-map";

afterEach(cleanup);

const parsed = fromOcel(OCEL_SAMPLE);
if (!parsed.ok) throw new Error("fixture must parse");
const objectCentric = discoverObjectCentricGraph(parsed.logs, { objectTypes: parsed.objectTypes });
const flat = objectCentricProcessGraph(objectCentric);
const scale = objectTypeColorScale(objectCentric);
const metric = { node: "absolute_case", edge: "absolute" } as const;

function build(selection?: { kind: "activity" | "transition"; id: string }) {
  return buildObjectCentricMapModel({
    graph: flat,
    metric,
    selection,
    objectCentric,
    objectTypeScale: scale,
  });
}

describe("buildObjectCentricMapModel", () => {
  it("is exactly buildProcessMapModel without an object-centric graph", () => {
    const graph = discoverGraph(generateSyntheticLog({ cases: 20, seed: 3 }));
    // Serialized: `formatEdgeValue` is a fresh closure per build, equal only in behaviour.
    expect(JSON.stringify(buildObjectCentricMapModel({ graph, metric }))).toBe(
      JSON.stringify(buildProcessMapModel({ graph, metric })),
    );
  });

  it("gives a shared activity one chip per object type, each named in text", () => {
    const pack = build().nodes.find((node) => node.id === "Pack")!;
    expect(pack.data.objectTypes!.map((entry) => entry.type)).toEqual(["order", "item", "package"]);
    const names = pack.data.objectTypes!.map((entry) => entry.ariaLabel);
    expect(new Set(names).size).toBe(3);
    expect(names[1]).toBe("item: 2 objects, 2 occurrences");
    expect(pack.ariaLabel).toContain("item: 2 objects, 2 occurrences");
    for (const entry of pack.data.objectTypes!) {
      expect(entry.code).toMatch(/^.{2}$/);
      expect(entry.color.token).toMatch(/^--chart-\d+$/);
    }
  });

  it("draws one edge per object type, side by side, in the type's chart colour", () => {
    const model = build();
    const pair = model.edges.filter(
      (edge) => edge.source === "Place Order" && edge.target === "Pack",
    );
    expect(pair.map((edge) => edge.id)).toEqual([
      objectCentricEdgeId("Place Order", "Pack", "order"),
      objectCentricEdgeId("Place Order", "Pack", "item"),
    ]);
    const data = pair.map((edge) => edge.data as ProcessTransitionEdgeData);
    expect(data.map((d) => [d.parallelIndex, d.parallelCount])).toEqual([
      [0, 2],
      [1, 2],
    ]);
    expect(pair[0]!.style).toEqual({ stroke: `var(${scale.colorFor("order").token})` });
    expect(data[1]!.label).toBe(`${scale.codeFor("item")} 1`);
    expect(data[1]!.ariaLabel).toMatch(/^item flow: Transition from Place Order to Pack/);
    // Never merged across types: 2 (order) + 3 (item) + 1 (package).
    expect(model.edges).toHaveLength(6);
    expect(model.transitionRows.map((row) => row.objectType)).toHaveLength(6);
  });

  it("selects only the named per-type edge, keeping its pair's neighbourhood", () => {
    const id = objectCentricEdgeId("Place Order", "Pack", "item");
    const model = build({ kind: "transition", id });
    const states = Object.fromEntries(
      model.edges.map((edge) => [edge.id, (edge.data as ProcessTransitionEdgeData).selectionState]),
    );
    expect(states[id]).toBe("selected");
    expect(states[objectCentricEdgeId("Place Order", "Pack", "order")]).toBe("associated");
    expect(states[objectCentricEdgeId("Pack", "Ship", "package")]).toBe("excluded");

    const merged = build({ kind: "transition", id: processEdgeId("Place Order", "Pack") });
    const selected = merged.edges.filter(
      (edge) => (edge.data as ProcessTransitionEdgeData).selectionState === "selected",
    );
    expect(selected).toHaveLength(2);
  });
});

describe("ProcessMap — object-centric table twin", () => {
  it("adds an object-types column and one transition row per type", () => {
    render(<ProcessMap objectCentric={objectCentric} metric={metric} tableView />);
    const activities = screen.getByRole("table", { name: /Activities/ });
    expect(within(activities).getByRole("columnheader", { name: "Object types" })).toBeVisible();
    const transitions = screen.getByRole("table", { name: /Transitions/ });
    expect(within(transitions).getByRole("columnheader", { name: "Object type" })).toBeVisible();
    // Header row + six per-type transitions.
    expect(within(transitions).getAllByRole("row")).toHaveLength(7);
  });

  it("renders the empty panel for an object-centric graph with no activities", () => {
    const empty = discoverObjectCentricGraph({ order: { events: [] } });
    render(<ProcessMap objectCentric={empty} metric={metric} />);
    expect(document.querySelector('[data-slot="process-map"]')).toHaveAttribute(
      "data-state",
      "empty",
    );
  });

  it("warns once in development when given objectCentric together with graph", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<ProcessMap objectCentric={objectCentric} graph={flat} metric={metric} tableView />);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("mutually exclusive"));
    warn.mockRestore();
  });
});
