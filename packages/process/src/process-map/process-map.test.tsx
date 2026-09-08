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
import { buildProcessMapModel, GHOST_OPACITY } from "./map-model";
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
    // #373: the property this test is NAMED for is the row's real accessible name — the
    // channel that reaches a screen reader — not merely the styling-hook attribute below,
    // which every prior version of this test asserted while claiming otherwise.
    expect(row).toHaveAccessibleName(/Selected/);
    expect(row).toHaveAttribute("data-selection", "selected");
  });

  // #373: the negative case — an ordinary row's name carries neither state word, so the
  // State column reads as a marker for the two states that matter rather than as noise
  // repeated on every row.
  it("names an ordinary (associated) row with neither 'Selected' nor 'Excluded'", () => {
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
    const associatedRows = within(table)
      .getAllByRole("row")
      .filter((row) => row.getAttribute("data-selection") === "associated");
    expect(associatedRows.length).toBeGreaterThan(0);
    for (const row of associatedRows) {
      expect(row).not.toHaveAccessibleName(/Selected|Excluded/);
    }
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
    // #373: same gap as the "selected" case above — the row's real accessible name, not
    // only the styling-hook attribute.
    expect(row).toHaveAccessibleName(/Excluded/);
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

    await user.click(
      within(menu).getByRole("menuitem", { name: `Keep cases containing ${target}` }),
    );
    expect(onFilterIntent).toHaveBeenCalledWith({ kind: "with", activity: target });
  });

  it("advertises its keyboard shortcut on the trigger", () => {
    render(<ProcessMap graph={graph} metric={metric} tableView />);
    expect(screen.getByRole("button", { name: /Filter/ })).toHaveAttribute(
      "aria-keyshortcuts",
      "f",
    );
  });

  // #346: a transition's menu offers the same four intents once per endpoint — eight
  // items, four visible-text duplicates. Locks that every item's real ACCESSIBLE name
  // (not merely its textContent) is distinct, and that each is uniquely resolvable by
  // name — the property the issue's own reproduction found broken.
  it("gives a transition's eight menu items eight distinct accessible names", async () => {
    const user = userEvent.setup();
    const edge = model.edges.find((e) => e.source !== e.target)!;
    render(
      <ProcessMap
        graph={graph}
        metric={metric}
        tableView
        selection={{ kind: "transition", id: edge.id }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Filter/ }));
    const menu = await screen.findByRole("menu");
    const items = within(menu).getAllByRole("menuitem");
    expect(items).toHaveLength(8);

    const names = items.map((item) => item.getAttribute("aria-label"));
    expect(new Set(names).size).toBe(8);

    // Asserting only `textContent` differs would pass on the pre-fix markup (the visible
    // text is unsuffixed on purpose) — the lock is on the computed accessible name.
    expect(
      within(menu).getByRole("menuitem", { name: `Keep cases without ${edge.source}` }),
    ).toBeInTheDocument();
    expect(
      within(menu).getByRole("menuitem", { name: `Keep cases without ${edge.target}` }),
    ).toBeInTheDocument();
  });
});

// #375: applying a filter/selection re-inks the whole map, and nothing announced it. Locks
// that exactly one `role="status"` region exists, names the real counts, and CHANGES text
// between two different exclusion states — a live region whose content never changes
// announces nothing after mount.
describe("ProcessMap — the selection/filter summary live region (#375)", () => {
  it("renders exactly one status region, on the table branch", () => {
    render(<ProcessMap graph={graph} metric={metric} tableView />);
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("renders exactly one status region, on the canvas branch", () => {
    render(<ProcessMap graph={graph} metric={metric} />);
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("names the real excluded/total counts, and changes when the exclusion set changes", () => {
    const target = graph.activities[0]!.id;
    const { rerender } = render(<ProcessMap graph={graph} metric={metric} tableView />);
    const before = screen.getByRole("status").textContent;
    expect(before).toContain(`0 of ${graph.activities.length} activities excluded`);
    expect(before).toContain(`0 of ${graph.transitions.length} transitions excluded`);

    rerender(
      <ProcessMap
        graph={graph}
        metric={metric}
        tableView
        selection={{ kind: "activity", id: target }}
      />,
    );
    const after = screen.getByRole("status").textContent;
    expect(after).not.toBe(before);
    const selectedModel = buildProcessMapModel({
      graph,
      metric,
      selection: { kind: "activity", id: target },
    });
    // Non-vacuity: this selection genuinely excludes something on the shared fixture.
    expect(selectedModel.excludedCounts.activities).toBeGreaterThan(0);
    expect(after).toContain(
      `${selectedModel.excludedCounts.activities} of ${graph.activities.length} activities excluded`,
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

// ── The ghosting-rung locks (#351, #352) ─────────────────────────────────────────────────
//
// Both render the real canvas (same `DOMMatrixReadOnly` polyfill as the #365 block above)
// rather than asserting on class-string presence, because the bug both issues describe is
// a COMPOSITING one: a class string can look right while the rendered opacity chain still
// dims text (opacity on an ancestor flattens its whole subtree — `getComputedStyle` on a
// descendant never reflects that). The primary lock below asserts the specific structural
// property that regressed: the activity node's border-carrying element (`FlowNode`'s own
// root) and its text stay untouched by ghosting, while the frame's retargeted custom
// properties and the meter's opacity are the only things that move.
describe("ProcessMap — ghosted marks keep their border/text, ghosting reaches only non-text channels (#351, #352)", () => {
  it("retints an excluded node's frame and dims its meter, without touching FlowNode's own card or text", async () => {
    const excludedId = graph.activities[graph.activities.length - 1]!.id;
    const includedId = graph.activities[0]!.id;
    render(
      <ProcessMap
        graph={graph}
        metric={metric}
        selectionStates={{ activities: { [excludedId]: "excluded" } }}
      />,
    );

    const excludedWrapper = await waitFor(() => {
      const node = document.querySelector<HTMLElement>(
        `.react-flow__node[data-id="${excludedId}"]`,
      );
      expect(node).toBeTruthy();
      return node!;
    });
    const includedWrapper = document.querySelector<HTMLElement>(
      `.react-flow__node[data-id="${includedId}"]`,
    )!;

    // Only the excluded node's frame carries the two ghost-rung custom-property overrides.
    const excludedFrame = excludedWrapper.querySelector<HTMLElement>(
      '[data-slot="process-activity-node-frame"]',
    )!;
    const includedFrame = includedWrapper.querySelector<HTMLElement>(
      '[data-slot="process-activity-node-frame"]',
    )!;
    expect(excludedFrame.style.getPropertyValue("--border")).toBe("var(--border-strong)");
    expect(excludedFrame.style.getPropertyValue("--flow-node")).toContain("color-mix");
    expect(includedFrame.style.getPropertyValue("--border")).toBe("");
    expect(includedFrame.style.getPropertyValue("--flow-node")).toBe("");

    // `FlowNode`'s own root — the border-carrying card — is untouched by this component on
    // EITHER node: no inline opacity, no `opacity-*` utility class. This is the primary lock:
    // a ghosted node's boundary must survive ghosting, where a single `opacity-35` on the
    // whole subtree used to fade the border along with everything else.
    const excludedCard = excludedFrame.firstElementChild as HTMLElement;
    const includedCard = includedFrame.firstElementChild as HTMLElement;
    for (const card of [excludedCard, includedCard]) {
      expect(card.style.opacity).toBe("");
      expect(card.className).not.toMatch(/\bopacity-/);
    }

    // The card's own text (eyebrow/title) is likewise never dimmed — same reasoning, and the
    // same element a screen reader/contrast checker actually reads.
    const excludedTitle = excludedCard.querySelector(
      ".truncate.text-sm.font-medium",
    ) as HTMLElement;
    expect(excludedTitle.style.opacity).toBe("");
    expect(excludedTitle.className).not.toMatch(/\bopacity-/);

    // The meter fill — a redundant, `aria-hidden` mark, never text — IS the shared ghost
    // rung: dimmed on the excluded node, full-strength on the included one.
    const excludedMeter = excludedWrapper.querySelector<HTMLElement>(
      '[data-slot="process-activity-node-meter"]',
    )!;
    const includedMeter = includedWrapper.querySelector<HTMLElement>(
      '[data-slot="process-activity-node-meter"]',
    )!;
    expect(excludedMeter.style.opacity).toBe(String(GHOST_OPACITY));
    expect(includedMeter.style.opacity).toBe("");
  });

  // The label-pill-reaches-ghosting lock for #351 lives in
  // `process-transition-edge.test.tsx` instead of here: React Flow renders no
  // edges at all under jsdom (`.react-flow__edges`/`.react-flow__edgelabel-renderer`
  // stay empty even with the DOMMatrixReadOnly polyfill this file's node-ordering
  // lock relies on), so asserting the pill through a full `<ProcessMap>` mount
  // cannot pass here — only node POSITIONS are computed synchronously by dagre.
  // `ProcessTransitionEdge`'s own context module documents standalone rendering
  // as the intended test strategy for exactly this component.
});

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
