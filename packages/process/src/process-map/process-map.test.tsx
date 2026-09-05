/**
 * Unit coverage for the parts of `ProcessMap` that render with no engine behind them —
 * the loading and empty panels, the accessible `tableView` twin, and the filter-intent
 * menu. The keyboard path and the axe pass are still NOT asserted here: React Flow needs
 * real interaction/measurement for those, and a mocked stand-in would prove nothing about
 * the surface that ships — that coverage stays in `process-map.stories.tsx`, which runs in
 * a real browser. The one exception is the canvas NODE-ORDERING invariant at the bottom of
 * this file (#365): it renders the real canvas (see the `DOMMatrixReadOnly` polyfill below)
 * because that invariant is reproducible under jsdom with no interaction/measurement at all
 * — see that describe block's own comment for why.
 */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { discoverGraph } from "../core/discover-graph";
import { generateSyntheticLog } from "../core/fixtures/synthetic-log";
import { buildProcessMapModel } from "./map-model";
import { ProcessMap } from "./process-map";

// jsdom ships no `DOMMatrixReadOnly`/`DOMMatrix` at all, which `@xyflow/react`'s internal
// transform math calls unconditionally — with neither stubbed, mounting `ProcessMap`'s
// canvas throws `window.DOMMatrixReadOnly is not a constructor` before a single node
// renders (confirmed against this exact fixture while building the #365 lock below). This
// is a MISSING BROWSER API, not React Flow's rendering logic — filling it in lets the real
// engine run for real under jsdom, which is a different thing from `canvas-shell.test.tsx`
// mocking `@xyflow/react` itself out. Scoped to this file (not the package's shared
// `vitest.setup.ts`) since only the one describe block below needs it.
if (typeof globalThis.DOMMatrixReadOnly === "undefined") {
  class DOMMatrixReadOnlyPolyfill {
    // The only field React Flow's viewport/position math reads off this type for a canvas
    // with no zoom/pan applied (this suite never zooms or pans).
    m22 = 1;
    constructor(_init?: unknown) {}
  }
  globalThis.DOMMatrixReadOnly = DOMMatrixReadOnlyPolyfill as unknown as typeof DOMMatrixReadOnly;
}
if (typeof globalThis.DOMMatrix === "undefined") {
  globalThis.DOMMatrix = globalThis.DOMMatrixReadOnly as unknown as typeof DOMMatrix;
}

afterEach(cleanup);

const log = generateSyntheticLog({ cases: 40, seed: 11 });
const graph = discoverGraph(log);
const metric = { node: "absolute_case", edge: "absolute" } as const;
const model = buildProcessMapModel({ graph, metric });

describe("ProcessMap — not-ready states", () => {
  it("shows a loading panel rather than an empty canvas", () => {
    render(<ProcessMap graph={graph} metric={metric} loading />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(document.querySelector('[data-slot="process-map"]')).toHaveAttribute(
      "data-state",
      "loading",
    );
  });

  it("shows a real empty state for a graph with no activities", () => {
    render(
      <ProcessMap
        graph={{
          activities: [],
          transitions: [],
          startActivities: {},
          endActivities: {},
          totals: { cases: 0, events: 0, variants: 0 },
        }}
        metric={metric}
      />,
    );
    expect(screen.getByText("No activities to map")).toBeInTheDocument();
  });

  it("shows the empty state when neither a graph nor a log is given", () => {
    render(<ProcessMap metric={metric} />);
    expect(screen.getByText("No activities to map")).toBeInTheDocument();
  });
});

describe("ProcessMap — the accessible table twin", () => {
  it("prints one row per activity and one per transition", () => {
    render(<ProcessMap graph={graph} metric={metric} tableView />);
    const activities = screen.getByRole("table", { name: /Activities/ });
    const transitions = screen.getByRole("table", { name: /Transitions/ });
    expect(within(activities).getAllByRole("row")).toHaveLength(graph.activities.length + 1);
    expect(within(transitions).getAllByRole("row")).toHaveLength(graph.transitions.length + 1);
  });

  it("prints the SAME numbers the canvas model carries — the twin cannot drift", () => {
    render(<ProcessMap graph={graph} metric={metric} tableView />);
    const table = screen.getByRole("table", { name: /Activities/ });
    for (const row of model.activityRows) {
      const cells = within(table).getByRole("row", { name: new RegExp(escapeRe(row.title)) });
      expect(cells).toHaveTextContent(row.primaryLabel);
    }
  });

  it("names the metric in the column header, so a number is never unlabelled", () => {
    render(<ProcessMap graph={graph} metric={metric} tableView />);
    expect(screen.getByRole("columnheader", { name: model.nodeMetricLabel })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: model.edgeMetricLabel })).toBeInTheDocument();
  });

  it("carries the selection tri-state on the row, not only as a colour", () => {
    const target = graph.activities[0]!.id;
    render(
      <ProcessMap
        graph={graph}
        metric={metric}
        tableView
        selection={{ kind: "activity", id: target }}
      />,
    );
    const table = screen.getByRole("table", { name: /Activities/ });
    const row = within(table).getByRole("row", { name: new RegExp(escapeRe(target)) });
    expect(row).toHaveAttribute("data-selection", "selected");
  });
});

describe("ProcessMap — filter exclusion re-inks, never removes (RM-052 round 2, #227, Invariant F)", () => {
  it("keeps an excluded activity's row, marked excluded, rather than dropping it", () => {
    const excludedId = graph.activities[graph.activities.length - 1]!.id;
    render(
      <ProcessMap
        graph={graph}
        metric={metric}
        tableView
        selectionStates={{ activities: { [excludedId]: "excluded" } }}
      />,
    );
    const table = screen.getByRole("table", { name: /Activities/ });
    // Invariant F: the row count is unchanged — nothing was removed from the render.
    expect(within(table).getAllByRole("row")).toHaveLength(graph.activities.length + 1);
    const row = within(table).getByRole("row", { name: new RegExp(escapeRe(excludedId)) });
    expect(row).toHaveAttribute("data-selection", "excluded");
    // An excluded row stays fully operable — never aria-disabled.
    expect(row).not.toHaveAttribute("aria-disabled");
  });

  it("omitting selectionStates reproduces today's model exactly (regression lock)", () => {
    render(<ProcessMap graph={graph} metric={metric} tableView />);
    const table = screen.getByRole("table", { name: /Activities/ });
    for (const row of model.activityRows) {
      const cell = within(table).getByRole("row", { name: new RegExp(escapeRe(row.title)) });
      expect(cell).toHaveAttribute("data-selection", row.selectionState);
    }
  });
});

describe("ProcessMap — the filter-intent menu", () => {
  it("offers the four intents and emits the one that was chosen", async () => {
    const user = userEvent.setup();
    const onFilterIntent = vi.fn();
    const target = graph.activities[0]!.id;
    render(
      <ProcessMap
        graph={graph}
        metric={metric}
        tableView
        selection={{ kind: "activity", id: target }}
        onFilterIntent={onFilterIntent}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Filter/ }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getAllByRole("menuitem")).toHaveLength(4);

    await user.click(within(menu).getByRole("menuitem", { name: "Keep cases containing" }));
    expect(onFilterIntent).toHaveBeenCalledWith({ kind: "with", activity: target });
  });

  it("advertises its keyboard shortcut on the trigger", () => {
    render(<ProcessMap graph={graph} metric={metric} tableView />);
    expect(screen.getByRole("button", { name: /Filter/ })).toHaveAttribute(
      "aria-keyshortcuts",
      "f",
    );
  });
});

// ── The cheap jsdom lock (#365, "Test to add" item 3) ────────────────────────────────────
//
// `process-map.stories.tsx`'s `Selection` story asserts this SAME invariant against a real
// browser, but that story runs in the Storybook `addon-vitest` project — the NON-BLOCKING
// CI job. This test asserts it here too, in the package's own jsdom suite, which IS the
// blocking job, so a regression in `applyPositions`' sort (`process-map.tsx`) actually fails
// a check that gates a merge. It is deliberately independent of the story: it renders the
// real `ProcessMap` canvas itself, off the same fixture used above, rather than importing
// anything from the story file — a change to the story can never mask a regression here, and
// a regression here is never masked by the story either.
//
// Dagre computes every node's `position` synchronously off the graph's STRUCTURE (see
// `useProcessLayout`) using FIXED default node dimensions — it never measures the DOM — so
// the sort order is reproducible under jsdom exactly as it is in a real browser, with no
// `ResizeObserver`/`getBoundingClientRect` dependency to fake. What jsdom canNOT reproduce is
// the map's 260ms CSS entry transition (`PROCESS_MAP_NODE_MOTION_CLASS`) actually PLAYING —
// jsdom has no compositor — so this lock does not need the story's "read the transform
// instead of a measured rectangle" workaround for ITS OWN sake. It reads `style.transform`
// anyway, for two independent reasons: (1) it is the exact mechanism `applyPositions` and
// this lock both care about, so a regression there is caught the same way in both places, and
// (2) `getBoundingClientRect` is always `{0,0,0,0}` under jsdom regardless of animation, so it
// could never distinguish laid-out nodes from un-laid-out ones anyway.
describe("ProcessMap — canvas node ordering is DOM order (blocking-CI lock, #365)", () => {
  it("orders .react-flow__node wrappers by their laid-out position, not model order", async () => {
    render(<ProcessMap graph={graph} metric={metric} />);

    // The first layout run is not debounced (`useProcessLayout`), but it still lands after
    // mount via an effect — wait for it rather than asserting on the pre-layout frame.
    const wrappers = await waitFor(() => {
      const nodes = [...document.querySelectorAll<HTMLElement>(".react-flow__node")];
      expect(nodes.length).toBe(graph.activities.length);
      return nodes;
    });

    const positions = wrappers.map((wrapper) => {
      const match = /translate\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px\s*\)/.exec(
        wrapper.style.transform,
      );
      expect(
        match,
        `expected a translate() transform on node "${wrapper.dataset.id}"`,
      ).toBeTruthy();
      return { x: Number(match![1]), y: Number(match![2]) };
    });

    for (let i = 1; i < positions.length; i += 1) {
      const previous = positions[i - 1]!;
      const current = positions[i]!;
      // dagre gives an entire rank the SAME y — an exact tie, not a 1px tolerance, because
      // this is the laid-out coordinate rather than a painted, sub-pixel rectangle.
      const sameRow = previous.y === current.y;
      expect({
        index: i,
        y: [previous.y, current.y],
        x: [previous.x, current.x],
        ordered: sameRow ? previous.x <= current.x : previous.y < current.y,
      }).toMatchObject({ ordered: true });
    }
  });
});

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
