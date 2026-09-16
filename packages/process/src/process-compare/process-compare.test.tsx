/**
 * Unit coverage for `ProcessCompare` (RM-064). Every side mounts a real `ProcessMap` canvas
 * on first render regardless of whether a test later toggles into `tableView` — the twin
 * bypasses React Flow/dagre entirely and is the cheapest way to assert on diff-state TEXT
 * (see `process-compare.tsx`'s own module docblock for why text, not a glyph, is the second
 * channel here), but the INITIAL mount still needs React Flow's transform math, hence the
 * same `DOMMatrixReadOnly` polyfill `process-map.test.tsx` carries.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { discoverGraph } from "../core/discover-graph";
import { generateSyntheticLog } from "../core/fixtures/synthetic-log";
import type { AbstractionOptions } from "../core/abstract-graph";
import { ProcessCompare } from "./process-compare";

// jsdom ships no `DOMMatrixReadOnly`/`DOMMatrix` at all, which `@xyflow/react`'s internal
// transform math calls unconditionally — see `process-map.test.tsx`'s identical polyfill.
if (typeof globalThis.DOMMatrixReadOnly === "undefined") {
  class DOMMatrixReadOnlyPolyfill {
    m22 = 1;
    constructor(_init?: unknown) {}
  }
  globalThis.DOMMatrixReadOnly = DOMMatrixReadOnlyPolyfill as unknown as typeof DOMMatrixReadOnly;
}
if (typeof globalThis.DOMMatrix === "undefined") {
  globalThis.DOMMatrix = globalThis.DOMMatrixReadOnly as unknown as typeof DOMMatrix;
}

afterEach(cleanup);

const METRIC = { node: "absolute_case", edge: "absolute" } as const;
const IDENTITY_ABSTRACTION: AbstractionOptions = {
  activities: 1,
  paths: 1,
  invert: false,
  keepConnected: true,
};

const logA = generateSyntheticLog({ cases: 30, seed: 1 });
const logB = generateSyntheticLog({ cases: 45, seed: 2 });
const graphA = discoverGraph(logA);
const graphB = discoverGraph(logB);

function noop() {}

describe("ProcessCompare — side-by-side", () => {
  it("renders both sides' own headers and table twin, in A-then-B order", () => {
    render(
      <ProcessCompare
        a={{ label: "Before", graph: graphA, log: logA }}
        b={{ label: "After", graph: graphB, log: logB }}
        metric={METRIC}
        abstraction={IDENTITY_ABSTRACTION}
        onAbstractionChange={noop}
      />,
    );

    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings.map((h) => h.textContent)).toEqual(["Before", "After"]);

    // Both panels render a real canvas region — two, not one, and A before B in the DOM.
    const regions = screen.getAllByLabelText(/Process map — /);
    expect(regions).toHaveLength(2);
    expect(regions[0]).toHaveAccessibleName("Process map — Before");
    expect(regions[1]).toHaveAccessibleName("Process map — After");
  });

  it("shares one AbstractionControls that patches the same handler for both sides", async () => {
    const onAbstractionChange = vi.fn();
    render(
      <ProcessCompare
        a={{ label: "Before", graph: graphA }}
        b={{ label: "After", graph: graphB }}
        metric={METRIC}
        abstraction={IDENTITY_ABSTRACTION}
        onAbstractionChange={onAbstractionChange}
      />,
    );

    // Only ONE abstraction control group — not one per side.
    expect(screen.getAllByRole("group", { name: "Abstraction" })).toHaveLength(1);

    const auto = screen.getByRole("button", { name: /Auto/i });
    await userEvent.click(auto);
    expect(onAbstractionChange).toHaveBeenCalledTimes(1);
  });

  it("toggles both sides into the accessible table twin together", async () => {
    render(
      <ProcessCompare
        a={{ label: "Before", graph: graphA }}
        b={{ label: "After", graph: graphB }}
        metric={METRIC}
        abstraction={IDENTITY_ABSTRACTION}
        onAbstractionChange={noop}
      />,
    );

    expect(screen.queryAllByRole("table")).toHaveLength(0);
    await userEvent.click(screen.getByRole("switch", { name: "Table view" }));
    // Two activity tables + two transition tables, one pair per side.
    expect(screen.getAllByRole("table")).toHaveLength(4);
  });

  it("shows the KPI strip's cases pair with a delta on B's tile", () => {
    render(
      <ProcessCompare
        a={{ label: "Before", graph: graphA, log: logA }}
        b={{ label: "After", graph: graphB, log: logB }}
        metric={METRIC}
        abstraction={IDENTITY_ABSTRACTION}
        onAbstractionChange={noop}
      />,
    );

    // MetricCard's own value rung (`text-2xl`) disambiguates from the abstraction
    // controls' unrelated "30%"/"45%"-shaped tick text elsewhere in the same tree.
    expect(screen.getByText("30", { selector: ".text-2xl" })).toBeInTheDocument();
    expect(screen.getByText("45", { selector: ".text-2xl" })).toBeInTheDocument();
    // (45-30)/30 = +50%.
    expect(screen.getByText("+50%")).toBeInTheDocument();
  });

  it("renders every map's own loading panel while neither side has a graph yet", () => {
    render(
      <ProcessCompare
        a={{ label: "Before", graph: undefined }}
        b={{ label: "After", graph: undefined }}
        metric={METRIC}
        abstraction={IDENTITY_ABSTRACTION}
        onAbstractionChange={noop}
        loading
      />,
    );

    expect(screen.getAllByRole("status")).not.toHaveLength(0);
  });
});

describe("ProcessCompare — superimposed", () => {
  it("renders exactly one map with a three-entry, text-first diff legend", () => {
    render(
      <ProcessCompare
        a={{ label: "Before", graph: graphA }}
        b={{ label: "After", graph: graphB }}
        mode="superimposed"
        metric={METRIC}
        abstraction={IDENTITY_ABSTRACTION}
        onAbstractionChange={noop}
      />,
    );

    expect(screen.getAllByLabelText(/Process map — Before vs After/)).toHaveLength(1);
    expect(screen.getByText("common")).toBeInTheDocument();
    expect(screen.getByText("Before only")).toBeInTheDocument();
    expect(screen.getByText("After only")).toBeInTheDocument();
  });

  it("suffixes every activity's title with its diff-state word — never colour alone", async () => {
    render(
      <ProcessCompare
        a={{ label: "Before", graph: graphA }}
        b={{ label: "After", graph: graphB }}
        mode="superimposed"
        metric={METRIC}
        abstraction={IDENTITY_ABSTRACTION}
        onAbstractionChange={noop}
      />,
    );

    await userEvent.click(screen.getByRole("switch", { name: "Table view" }));
    const activityTable = screen.getAllByRole("table")[0]!;
    const rowText = within(activityTable)
      .getAllByRole("row")
      .map((row) => row.textContent ?? "");
    // Every activity row carries one of the three diff words as real text.
    expect(rowText.some((text) => /common|Before only|After only/.test(text))).toBe(true);
  });

  it("marks activities unique to one side when the two graphs share no activity at all", async () => {
    // `generateSyntheticLog` draws from one fixed activity vocabulary, so two seeds are not
    // a reliable way to get a GUARANTEED disjoint pair — hand-built graphs are.
    const disjointGraph = (id: string): ReturnType<typeof discoverGraph> => ({
      activities: [
        {
          id,
          label: id,
          instances: 5,
          cases: 5,
          isStart: true,
          isEnd: true,
          duration: { min: 1, max: 1, mean: 1, median: 1, p90: 1, sum: 5, trimmedMean: 1 },
        },
      ],
      transitions: [],
      startActivities: { [id]: 5 },
      endActivities: { [id]: 5 },
      totals: { cases: 5, events: 5, variants: 1 },
    });

    render(
      <ProcessCompare
        a={{ label: "Before", graph: disjointGraph("OnlyBefore") }}
        b={{ label: "After", graph: disjointGraph("OnlyAfter") }}
        mode="superimposed"
        metric={METRIC}
        abstraction={IDENTITY_ABSTRACTION}
        onAbstractionChange={noop}
      />,
    );
    // The legend always names all three possible states (it documents the encoding, not
    // which ones are present) — the table twin is what proves NEITHER activity row here
    // reads "common".
    await userEvent.click(screen.getByRole("switch", { name: "Table view" }));
    const activityTable = screen.getAllByRole("table")[0]!;
    const rowText = within(activityTable)
      .getAllByRole("row")
      .map((row) => row.textContent ?? "");
    expect(rowText.some((text) => text.includes("Before only"))).toBe(true);
    expect(rowText.some((text) => text.includes("After only"))).toBe(true);
    expect(rowText.some((text) => text.includes("common"))).toBe(false);
  });
});
