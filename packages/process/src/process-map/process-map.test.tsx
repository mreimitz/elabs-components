/**
 * Unit coverage for the parts of `ProcessMap` that render with no engine behind them —
 * the loading and empty panels, the accessible `tableView` twin, and the filter-intent
 * menu. The CANVAS is deliberately not asserted here: React Flow needs real layout and
 * measurement, and a mocked stand-in would prove nothing about the surface that ships.
 * The canvas, the keyboard path and the axe pass are covered by `process-map.stories.tsx`,
 * which runs in a real browser.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { discoverGraph } from "../core/discover-graph";
import { generateSyntheticLog } from "../core/fixtures/synthetic-log";
import { buildProcessMapModel } from "./map-model";
import { ProcessMap } from "./process-map";

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

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
