import { describe, expect, it } from "vitest";

import {
  assertProcessContract,
  buildProcessDoublePayload,
  ProcessContractError,
  readProcessDoubleProps,
  type ProcessContractSpec,
} from "./contract";
import type { ProcessGraph, Variant } from "../core/types";

const GRAPH_SPEC: ProcessContractSpec = { dataProp: "graph" };
const VARIANTS_SPEC: ProcessContractSpec = { dataProp: "variants" };

const emptyGraph: ProcessGraph = {
  activities: [],
  transitions: [],
  startActivities: {},
  endActivities: {},
  totals: { cases: 0, events: 0, variants: 0 },
};

const oneVariant: Variant[] = [
  {
    id: "v1",
    sequence: ["A", "B"],
    count: 1,
    share: 1,
    cumulativeShare: 1,
    caseIds: ["c1"],
    duration: { min: 0, max: 0, mean: 0, median: 0, p90: 0, sum: 0, trimmedMean: 0 },
  },
];

describe("assertProcessContract", () => {
  it("passes for a valid graph payload", () => {
    expect(() =>
      assertProcessContract("ProcessMapDouble", { graph: emptyGraph }, GRAPH_SPEC),
    ).not.toThrow();
  });

  it("passes for a valid variants payload", () => {
    expect(() =>
      assertProcessContract("VariantExplorerDouble", { variants: oneVariant }, VARIANTS_SPEC),
    ).not.toThrow();
  });

  it("throws ProcessContractError when the graph prop is missing", () => {
    expect(() => assertProcessContract("ProcessMapDouble", {}, GRAPH_SPEC)).toThrow(
      ProcessContractError,
    );
  });

  it("throws ProcessContractError when the variants prop is not an array", () => {
    expect(() =>
      assertProcessContract("VariantExplorerDouble", { variants: "nope" }, VARIANTS_SPEC),
    ).toThrow(ProcessContractError);
  });

  it("throws when a required prop is undefined", () => {
    const spec: ProcessContractSpec = { dataProp: "graph", requiredProps: ["onSelectionChange"] };
    expect(() => assertProcessContract("ProcessMapDouble", { graph: emptyGraph }, spec)).toThrow(
      /missing required prop "onSelectionChange"/,
    );
  });
});

describe("buildProcessDoublePayload / readProcessDoubleProps round-trip", () => {
  it("carries the graph's activity count and the current selection", () => {
    const graph: ProcessGraph = { ...emptyGraph, activities: [...emptyGraph.activities] };
    const payload = buildProcessDoublePayload(
      "ProcessMapDouble",
      { graph, selection: { kind: "node", id: "A" } },
      GRAPH_SPEC,
    );
    expect(payload).toEqual({
      component: "ProcessMapDouble",
      dataLength: 0,
      selection: { kind: "node", id: "A" },
    });

    const el = document.createElement("div");
    el.setAttribute("data-process-props", JSON.stringify(payload));
    expect(readProcessDoubleProps(el)).toEqual(payload);
  });

  it("counts variants length for a variants-shaped double", () => {
    const payload = buildProcessDoublePayload(
      "VariantExplorerDouble",
      { variants: oneVariant },
      VARIANTS_SPEC,
    );
    expect(payload.dataLength).toBe(1);
  });

  it("readProcessDoubleProps returns null when the attribute is absent", () => {
    expect(readProcessDoubleProps(document.createElement("div"))).toBeNull();
  });
});
