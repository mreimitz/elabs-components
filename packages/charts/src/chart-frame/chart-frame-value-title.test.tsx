/**
 * `ChartTooltip valueInTitle` → `ChartFrame` title (#610, RM-119 follow-up).
 *
 * The tooltip publishes the hovered/pinned value into a store the frame
 * provides; the frame's title reads it. No consumer wiring. What must hold:
 * pointer hover AND keyboard focus both swap the title, leaving restores it,
 * the change is announced once through one polite status, a repeat of the
 * same value is not re-published, and a chart outside a frame is unaffected.
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

import { LineChart } from "../charts/line-chart";
import { ChartTooltip } from "../charts/tooltip";
import { ChartFrame } from "./chart-frame";
import { createChartFrameValueTitleStore } from "./chart-frame-value-title";

afterEach(cleanup);

const data = [
  { month: "Jan", users: 10 },
  { month: "Feb", users: 20 },
  { month: "Mar", users: 30 },
  { month: "Apr", users: 40 },
];

/**
 * Stands in for `<Line>`: the real one calls `getTotalLength()`, which jsdom
 * lacks. The shell still registers the series by `dataKey`.
 */
function SeriesStub(_props: { dataKey: string }) {
  return null;
}

const TITLE = '[data-slot="card-title"]';
const STATUS = '[data-slot="chart-frame-value-title-status"]';
const TARGET = '[data-slot="chart-datapoint-layer-target"]';

function lineChart(props: { valueInTitle?: boolean; onDatapointClick?: () => void } = {}) {
  return (
    <LineChart
      animationDuration={0}
      aspectRatio={undefined}
      data={data}
      onDatapointClick={props.onDatapointClick}
      xDataKey="month"
      xScale="band"
    >
      <SeriesStub dataKey="users" />
      <ChartTooltip pin={false} valueInTitle={props.valueInTitle ?? true} />
    </LineChart>
  );
}

function renderFramed(
  props: { valueInTitle?: boolean; onDatapointClick?: () => void; chrome?: "card" | "tile" } = {},
) {
  const view = render(
    <ChartFrame chrome={props.chrome} title="Users per month">
      {lineChart(props)}
    </ChartFrame>,
  );
  const title = () => view.container.querySelector(TITLE)?.textContent;
  const plot = () => view.container.querySelector("svg > g") as SVGGElement;
  return { ...view, title, plot };
}

describe("ChartFrame value-in-title — pointer", () => {
  it("swaps the frame title for the hovered value and restores it on leave", async () => {
    const { title, plot } = renderFramed();
    expect(title()).toBe("Users per month");
    await waitFor(() => {
      fireEvent.mouseMove(plot(), { clientX: 540, clientY: 120 });
      expect(title()).toBe("Apr: users 40");
    });
    await waitFor(() => {
      fireEvent.mouseLeave(plot());
      expect(title()).toBe("Users per month");
    });
  });

  it("works for the tile chrome too", async () => {
    const { title, plot } = renderFramed({ chrome: "tile" });
    await waitFor(() => {
      fireEvent.mouseMove(plot(), { clientX: 540, clientY: 120 });
      expect(title()).toBe("Apr: users 40");
    });
  });

  it("announces the change once, politely, through one status region", async () => {
    const { container, plot } = renderFramed();
    // Mounted (empty) before the first hover so the first change is announced.
    const status = container.querySelector(STATUS);
    expect(status).not.toBeNull();
    expect(status?.getAttribute("role")).toBe("status");
    expect(status?.getAttribute("aria-live")).toBe("polite");
    expect(status?.textContent).toBe("");
    await waitFor(() => {
      fireEvent.mouseMove(plot(), { clientX: 540, clientY: 120 });
      expect(container.querySelector(STATUS)?.textContent).toBe("Apr: users 40");
    });
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it.each(["card", "tile"] as const)(
    "%s: the status never joins the title column, so mounting it cannot move the layout",
    (chrome) => {
      // Tailwind v4 `space-y-*` margins every child but the LAST: a status
      // appended beside the title made the title "not last", grew the header
      // 4px, and the chart body briefly overflowed — a scroll-region tab stop
      // that swallowed the first Tab, so keyboard focus never reached a
      // datapoint and the title never swapped (#610 round 1).
      const { container } = renderFramed({ chrome });
      const title = container.querySelector(TITLE) as HTMLElement;
      const status = container.querySelector(STATUS) as HTMLElement;
      expect(status).not.toBeNull();
      expect(title.parentElement?.contains(status)).toBe(false);
      expect(title.parentElement?.lastElementChild).toBe(title);
    },
  );

  it("leaves the title alone when the tooltip does not ask for it", async () => {
    const { title, plot, container } = renderFramed({ valueInTitle: false });
    await waitFor(() => {
      fireEvent.mouseMove(plot(), { clientX: 540, clientY: 120 });
      expect(container.querySelector('[data-slot="chart-tooltip-box"]')).not.toBeNull();
    });
    expect(title()).toBe("Users per month");
    expect(container.querySelector(STATUS)).toBeNull();
  });
});

describe("ChartFrame value-in-title — keyboard", () => {
  /**
   * jsdom does no layout: stand in for the focus bridge's two measurements
   * (the target's centre and the shape under it), as
   * `chart-datapoint-layer.test.tsx` does. The replayed hover and the
   * publish into the frame are the real code path.
   */
  function withLayout(stack: () => Element[]) {
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({ left: 290, top: 110, width: 24, height: 24 } as DOMRect);
    const original = document.elementsFromPoint;
    document.elementsFromPoint = vi.fn(() => stack());
    return () => {
      rect.mockRestore();
      document.elementsFromPoint = original;
    };
  }

  it("focusing a datapoint swaps the title; blurring restores it", async () => {
    const { container, title, plot } = renderFramed({ onDatapointClick: () => {} });
    const restore = withLayout(() => [plot()]);
    try {
      const target = container.querySelector(TARGET) as HTMLButtonElement;
      fireEvent.focus(target);
      await waitFor(() => expect(title()).not.toBe("Users per month"));
      expect(title()).toMatch(/^(Jan|Feb|Mar|Apr): users \d+$/);
      fireEvent.blur(target);
      await waitFor(() => expect(title()).toBe("Users per month"));
    } finally {
      restore();
    }
  });
});

describe("ChartFrame value-in-title — outside a frame", () => {
  it("a chart with no frame renders and hovers exactly as before", async () => {
    const { container } = render(lineChart());
    const plot = container.querySelector("svg > g") as SVGGElement;
    await waitFor(() => {
      fireEvent.mouseMove(plot, { clientX: 540, clientY: 120 });
      expect(container.querySelector('[data-slot="chart-tooltip-box"]')).not.toBeNull();
    });
    expect(container.querySelector(STATUS)).toBeNull();
    expect(container.querySelector(TITLE)).toBeNull();
  });
});

describe("createChartFrameValueTitleStore — no re-render storm", () => {
  it("notifies only when the shown value actually changes", () => {
    const store = createChartFrameValueTitleStore();
    const listener = vi.fn();
    store.subscribe(listener);
    const release = store.register("a");
    expect(listener).toHaveBeenCalledTimes(1);
    store.publish("a", "Apr: users 40");
    store.publish("a", "Apr: users 40");
    store.publish("a", "Apr: users 40");
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot().text).toBe("Apr: users 40");
    store.publish("a", null);
    expect(store.getSnapshot().text).toBeNull();
    expect(listener).toHaveBeenCalledTimes(3);
    release();
    expect(store.getSnapshot().publishers).toBe(0);
  });

  it("a release clears a value its publisher left behind", () => {
    const store = createChartFrameValueTitleStore();
    const release = store.register("a");
    store.publish("a", "Mar: users 30");
    release();
    expect(store.getSnapshot().text).toBeNull();
  });
});
