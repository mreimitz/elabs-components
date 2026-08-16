/**
 * Cross-family drill-down contract (#349).
 *
 * The three properties that must hold for EVERY chart family, because they are
 * the ones a per-family implementation can silently get wrong:
 *
 * 1. **Pointer** — clicking a rendered datapoint fires `onDatapointClick` with
 *    the right datum / series / value / category and `source: "pointer"`.
 * 2. **Keyboard** — the whole chart is exactly ONE tab stop (roving tabindex),
 *    arrows traverse, Enter activates with `source: "keyboard"`, and every
 *    target carries an accessible name. The targets live OUTSIDE the
 *    `aria-hidden` SVG, which is what keeps axe's `aria-hidden-focus` green.
 * 3. **Opt-out is inert** — with no handler there is no layer and no new
 *    focusable, so nothing about the existing charts changes.
 *
 * Plus the highest-probability implementation bug, called out in the design:
 * a layer that intercepts pointer events would silently kill hover tooltips.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// @visx/responsive uses ResizeObserver + real DOM measurement which jsdom lacks.
vi.mock("@visx/responsive", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory is hoisted; lazy require avoids TDZ
  const React = require("react");
  return {
    ParentSize: ({
      children,
    }: {
      children: (size: { width: number; height: number }) => React.ReactNode;
    }) =>
      React.createElement(
        "div",
        { "data-testid": "parent-size" },
        children({ width: 560, height: 288 }),
      ),
  };
});

import type { ChartDatapoint } from "./chart-datapoint";
import { useChartHover } from "./chart-context";
import { LineChart } from "./line-chart";
import { XAxis } from "./x-axis";

afterEach(cleanup);

const seriesData = [
  { turn: "A", users: 10, sessions: 40 },
  { turn: "B", users: 20, sessions: 50 },
  { turn: "C", users: 30, sessions: 60 },
];

const TARGET = '[data-slot="chart-datapoint-layer-target"]';

/**
 * Stands in for `<Line>` / `<Area>`. The real ones call `getTotalLength()` on an
 * SVG path, which jsdom does not implement (the same pre-existing gap
 * `line-chart.test.tsx` documents) — but the shell only needs a child carrying a
 * `dataKey` to register the series, so a null-rendering stub exercises the
 * REAL registration + layer code path without that dependency.
 */
function SeriesStub(_props: { dataKey: string }) {
  return null;
}

/** Reports the chart's live hover state so a test can assert the tooltip path. */
function TooltipProbe({ onTooltip }: { onTooltip: (t: { index: number } | null) => void }) {
  const { tooltipData } = useChartHover();
  onTooltip(tooltipData);
  return null;
}

function renderLineChart(onDatapointClick?: (point: ChartDatapoint, event: unknown) => void) {
  return render(
    <LineChart
      aspectRatio={undefined}
      data={seriesData}
      onDatapointClick={onDatapointClick}
      xDataKey="turn"
      xScale="band"
    >
      <SeriesStub dataKey="users" />
      <SeriesStub dataKey="sessions" />
      <XAxis />
    </LineChart>,
  );
}

describe("ChartDatapointLayer — opt-out (#349)", () => {
  it("renders no layer and no focusable when onDatapointClick is unset", () => {
    const { container } = renderLineChart();
    expect(container.querySelector('[data-slot="chart-datapoint-layer"]')).toBeNull();
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });
});

describe("ChartDatapointLayer — keyboard model (#349)", () => {
  it("exposes exactly ONE tab stop for the whole chart", () => {
    const { container } = renderLineChart(() => {});
    // One target per (row × series): 3 rows × 2 series.
    const targets = container.querySelectorAll(TARGET);
    expect(targets).toHaveLength(6);
    expect(container.querySelectorAll(`${TARGET}[tabindex="0"]`)).toHaveLength(1);
  });

  it("keeps every keyboard target OUTSIDE the aria-hidden SVG", () => {
    const { container } = renderLineChart(() => {});
    for (const target of container.querySelectorAll(TARGET)) {
      expect(target.closest("svg")).toBeNull();
      expect(target.closest('[aria-hidden="true"]')).toBeNull();
    }
  });

  it("names every target for AT", () => {
    const { container } = renderLineChart(() => {});
    for (const target of container.querySelectorAll(TARGET)) {
      expect(target.getAttribute("aria-label")).toBeTruthy();
    }
    // Default template: "<series>, <category>: <value>".
    expect(container.querySelector(TARGET)?.getAttribute("aria-label")).toBe("users, A: 10");
  });

  it("honours a custom datapointLabel", () => {
    const { container } = render(
      <LineChart
        aspectRatio={undefined}
        data={seriesData}
        datapointLabel={(point) => `drill ${String(point.category)}`}
        onDatapointClick={() => {}}
        xDataKey="turn"
        xScale="band"
      >
        <SeriesStub dataKey="users" />
        <XAxis />
      </LineChart>,
    );
    expect(container.querySelector(TARGET)?.getAttribute("aria-label")).toBe("drill A");
  });

  it("moves the roving tabindex with ArrowRight and activates with a keyboard click", () => {
    const onDatapointClick = vi.fn();
    const { container } = renderLineChart(onDatapointClick);
    const targets = [...container.querySelectorAll<HTMLButtonElement>(TARGET)];
    const first = targets[0] as HTMLButtonElement;

    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });

    expect(container.querySelectorAll(`${TARGET}[tabindex="0"]`)).toHaveLength(1);
    expect(targets[1]?.getAttribute("tabindex")).toBe("0");
    expect(targets[0]?.getAttribute("tabindex")).toBe("-1");

    // `detail: 0` is what the platform reports for Enter/Space on a button.
    fireEvent.click(targets[1] as HTMLButtonElement, { detail: 0 });
    expect(onDatapointClick).toHaveBeenCalledTimes(1);
    const [point] = onDatapointClick.mock.calls[0] as [ChartDatapoint];
    expect(point).toMatchObject({
      category: "B",
      index: 1,
      seriesKey: "users",
      source: "keyboard",
      value: 20,
    });
    expect(point.datum).toBe(seriesData[1]);
  });

  it("Home / End jump within the series ROW, not across the whole chart", () => {
    // Targets are row-major: 0–2 are the `users` row, 3–5 the `sessions` row.
    const { container } = renderLineChart(() => {});
    const targets = [...container.querySelectorAll<HTMLButtonElement>(TARGET)];
    fireEvent.keyDown(targets[0] as HTMLButtonElement, { key: "End" });
    expect(targets[2]?.getAttribute("tabindex")).toBe("0");
    fireEvent.keyDown(targets[2] as HTMLButtonElement, { key: "Home" });
    expect(targets[0]?.getAttribute("tabindex")).toBe("0");
  });

  it("ArrowDown / ArrowUp move ACROSS series, holding the column", () => {
    const { container } = renderLineChart(() => {});
    const targets = [...container.querySelectorAll<HTMLButtonElement>(TARGET)];
    fireEvent.keyDown(targets[1] as HTMLButtonElement, { key: "ArrowDown" });
    // Same column (index 1), next series row → the `sessions` point at "B".
    expect(targets[4]?.getAttribute("tabindex")).toBe("0");
    expect(targets[4]?.getAttribute("aria-label")).toBe("sessions, B: 50");
    fireEvent.keyDown(targets[4] as HTMLButtonElement, { key: "ArrowUp" });
    expect(targets[1]?.getAttribute("tabindex")).toBe("0");
  });

  it("gives every target a usable hit box (WCAG 2.5.8, ≥24×24)", () => {
    const { container } = renderLineChart(() => {});
    for (const target of container.querySelectorAll<HTMLButtonElement>(TARGET)) {
      expect(Number.parseFloat(target.style.width)).toBeGreaterThanOrEqual(24);
      expect(Number.parseFloat(target.style.height)).toBeGreaterThanOrEqual(24);
    }
  });
});

describe("ChartDatapointLayer — pointer must not be intercepted (#349)", () => {
  it("leaves the layer pointer-events:none so the SVG keeps hover/tooltip", () => {
    const { container } = renderLineChart(() => {});
    const layer = container.querySelector('[data-slot="chart-datapoint-layer"]');
    expect(layer?.className).toContain("pointer-events-none");
  });

  it("still resolves a hover tooltip while the interaction layer is mounted", async () => {
    // The single highest-probability way to break this feature is a layer that
    // swallows pointer events — hover tooltips would silently die on every
    // line/area chart. `TooltipProbe` reads the hover slice of the chart
    // context directly, so this asserts the REAL mousemove → tooltip path
    // rather than the presence of a class name.
    let seen: { index: number } | null = null;
    const { container } = render(
      <LineChart
        animationDuration={0}
        aspectRatio={undefined}
        data={seriesData}
        onDatapointClick={() => {}}
        xDataKey="turn"
        xScale="band"
      >
        <SeriesStub dataKey="users" />
        <TooltipProbe
          onTooltip={(tooltip) => {
            seen = tooltip;
          }}
        />
      </LineChart>,
    );

    const plotGroup = container.querySelector("svg > g") as SVGGElement;
    // The chart only accepts interaction once its enter phase settles, and the
    // tooltip commit is rAF-scheduled — so poll rather than assert once.
    await waitFor(() => {
      fireEvent.mouseMove(plotGroup, { clientX: 300, clientY: 120 });
      expect(seen).not.toBeNull();
    });
  });

  it("resolves a POINTER click on the plot area to the nearest point and series", async () => {
    // A `Line` is one path, so there is no per-datapoint element to click. The
    // pointer path reuses the tooltip's bisector lookup for the row and picks
    // the series by vertical distance — this is what makes a click on a
    // multi-line chart report WHICH line was hit.
    const onDatapointClick = vi.fn();
    const { container } = render(
      <LineChart
        animationDuration={0}
        aspectRatio={undefined}
        data={seriesData}
        onDatapointClick={onDatapointClick}
        xDataKey="turn"
        xScale="band"
      >
        <SeriesStub dataKey="users" />
        <SeriesStub dataKey="sessions" />
      </LineChart>,
    );

    const plotGroup = container.querySelector("svg > g") as SVGGElement;
    await waitFor(() => {
      fireEvent.click(plotGroup, { clientX: 300, clientY: 200 });
      expect(onDatapointClick).toHaveBeenCalled();
    });

    const [point] = onDatapointClick.mock.calls[0] as [ChartDatapoint];
    expect(point.source).toBe("pointer");
    expect(point.datum).toBe(seriesData[point.index]);
    expect(["users", "sessions"]).toContain(point.seriesKey);
    expect(point.value).toBe(seriesData[point.index]?.[point.seriesKey as "users"]);
  });

  it("still renders the layer group with an accessible name", () => {
    renderLineChart(() => {});
    expect(screen.getByRole("group", { name: "Chart data points" })).toBeInTheDocument();
  });
});
