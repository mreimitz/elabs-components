import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { discoverGraph } from "../core/discover-graph";
import { liftHappyPath } from "../core/reference-model";
import { tokenReplay } from "../core/token-replay";
import { ProcessMap } from "../process-map/process-map";
import { CONFORMANCE_FIXTURE_LOG, CONFORMANCE_FIXTURE_PATH } from "./conformance-fixture";
import { ConformanceLegend } from "./conformance-legend";
import { ConformanceOverlay } from "./conformance-overlay";

// jsdom has no `DOMMatrixReadOnly`, which React Flow's transform math needs to mount the
// canvas at all — the same missing-browser-API fill `process-map.test.tsx` documents.
if (typeof globalThis.DOMMatrixReadOnly === "undefined") {
  class DOMMatrixReadOnlyPolyfill {
    m22 = 1;
    constructor(_init?: unknown) {}
  }
  globalThis.DOMMatrixReadOnly = DOMMatrixReadOnlyPolyfill as unknown as typeof DOMMatrixReadOnly;
}

afterEach(cleanup);

const graph = discoverGraph(CONFORMANCE_FIXTURE_LOG);
const conformance = tokenReplay(CONFORMANCE_FIXTURE_LOG, liftHappyPath(CONFORMANCE_FIXTURE_PATH));
const metric = { node: "absolute_case", edge: "absolute" } as const;

describe("ConformanceLegend", () => {
  it("pairs every state with a distinct glyph and dash, and names it in text", () => {
    render(<ConformanceLegend />);
    const legend = screen.getByRole("group", { name: "Conformance" });
    const items = legend.querySelectorAll('[data-slot="conformance-legend-item"]');
    expect(items).toHaveLength(3);
    const glyphs = new Set([...items].map((item) => item.getAttribute("data-glyph")));
    const dashes = new Set([...items].map((item) => item.getAttribute("data-dash")));
    expect(glyphs.size).toBe(3);
    expect(dashes.size).toBe(3);
    expect(within(legend).getByText(/Model only/)).toBeInTheDocument();
  });
});

describe("ConformanceOverlay — table twin", () => {
  it("adds a Conformance column whose rows carry data-conformance and a word", () => {
    render(<ConformanceOverlay graph={graph} conformance={conformance} tableView />);
    const activityTable = document.querySelector<HTMLElement>(
      '[data-slot="process-map-activity-table"]',
    )!;
    expect(within(activityTable).getByRole("columnheader", { name: "Conformance" })).toBeVisible();
    const skipped = within(activityTable).getByRole("row", { name: /Check credit/ });
    expect(skipped).toHaveAttribute("data-conformance", "modelOnly");
    expect(within(skipped).getByText(/Model only/)).toBeInTheDocument();

    const transitionTable = document.querySelector<HTMLElement>(
      '[data-slot="process-map-transition-table"]',
    )!;
    const diverged = [...transitionTable.querySelectorAll("tbody tr")].find(
      (row) => row.textContent?.startsWith("RegisterApprove") ?? false,
    );
    expect(diverged).toHaveAttribute("data-conformance", "logOnly");
  });

  it("hides the legend while loading", () => {
    render(<ConformanceOverlay graph={graph} conformance={conformance} loading />);
    expect(document.querySelector('[data-slot="conformance-legend"]')).toBeNull();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});

describe("ProcessMap — conformance is additive", () => {
  it("renders no conformance column or attribute without the prop", () => {
    render(<ProcessMap graph={graph} metric={metric} tableView />);
    expect(screen.queryByRole("columnheader", { name: "Conformance" })).toBeNull();
    expect(document.querySelector("[data-conformance]")).toBeNull();
  });

  it("puts data-conformance on React Flow's node element and a glyph marker inside", async () => {
    render(<ConformanceOverlay graph={graph} conformance={conformance} />);
    await waitFor(() =>
      expect(document.querySelectorAll(".react-flow__node").length).toBe(graph.activities.length),
    );
    const node = document.querySelector<HTMLElement>('.react-flow__node[data-id="Check credit"]')!;
    expect(node).toHaveAttribute("data-conformance", "modelOnly");
    expect(node).toHaveAttribute("data-selection", "associated");
    expect(node).toHaveAttribute("aria-label", expect.stringMatching(/Model only/));
    const marker = node.querySelector('[data-slot="process-activity-node-conformance"]');
    expect(marker).toHaveAttribute("data-glyph", "square");
    expect(marker).toHaveAttribute("data-dash", "dashed");
  });
});
