/**
 * RM-141 — overflow scrolling on the category families: the fits-case opt-out
 * is byte-identical, an index window slices what is DRAWN (never `data`), the
 * value axis stays on the full data by default, horizontal bars get a vertical
 * strip, and every index a consumer sees (datapoint, tooltip) is the row's
 * index into the FULL `data`.
 */

import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useReducedMotion: () => true,
}));

// jsdom lacks ResizeObserver-backed measurement: a fixed 560×288 plot box.
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

import { Bar } from "../bar";
import { BarChart } from "../bar-chart";
import { BarXAxis } from "../bar-x-axis";
import { BarYAxis } from "../bar-y-axis";
import { useChart } from "../chart-context";
import type { ChartDatapoint } from "../chart-datapoint";
import { HeatmapChart } from "../heatmap/heatmap-chart";
import { LineChart } from "../line-chart";
import { XAxis } from "../x-axis";
import { isCategoryWindowActive, resolveVisibleCount } from "./category-window";
import type { NavigatorWindow } from "./types";

afterEach(cleanup);

// jsdom has no IntersectionObserver (the heatmap's in-view reveal): a stub that never fires.
if (typeof globalThis.IntersectionObserver === "undefined") {
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
}

const rows = (count: number, value: (i: number) => number = (i) => 10 + (i % 7)) =>
  Array.from({ length: count }, (_, i) => ({
    name: `C${String(i).padStart(3, "0")}`,
    value: value(i),
    other: 5,
  }));

const strip = (root: ParentNode) => root.querySelector('[data-slot="chart-navigator"]');
const handles = (root: ParentNode) =>
  Array.from(root.querySelectorAll<HTMLElement>('[data-slot="chart-navigator-handle"]'));
const targets = (root: ParentNode) =>
  Array.from(root.querySelectorAll<HTMLElement>('[data-slot="chart-datapoint-layer-target"]'));
const normalise = (html: string) => html.replace(/_r_[0-9a-z]+_/g, "_id_");

/** Reads the chart context from inside the chart (renders nothing). */
function Probe({ onRead }: { onRead: (ctx: ReturnType<typeof useChart>) => void }) {
  onRead(useChart());
  return null;
}

describe("pure rules", () => {
  it("resolveVisibleCount: a number wins, clamped; auto = the readable count", () => {
    expect(resolveVisibleCount(20, 7, 120)).toBe(20);
    expect(resolveVisibleCount(500, 7, 120)).toBe(120);
    expect(resolveVisibleCount("auto", 7, 120)).toBe(7);
    expect(resolveVisibleCount(undefined, 0, 120)).toBe(1);
  });

  it("isCategoryWindowActive: off by default, on overflow, always with a window", () => {
    expect(isCategoryWindowActive({}, 120, 20)).toBe(false);
    expect(isCategoryWindowActive({ scrollbar: "none" }, 120, 20)).toBe(false);
    expect(isCategoryWindowActive({ scrollbar: "miniChart" }, 12, 20)).toBe(false);
    expect(isCategoryWindowActive({ scrollbar: "miniChart" }, 120, 20)).toBe(true);
    expect(isCategoryWindowActive({ scrollbar: "auto" }, 21, 20)).toBe(true);
    expect(
      isCategoryWindowActive({ defaultWindow: { kind: "index", start: 0, end: 5 } }, 12, 20),
    ).toBe(true);
    expect(
      isCategoryWindowActive(
        { scrollbar: "none", defaultWindow: { kind: "index", start: 0, end: 5 } },
        12,
        20,
      ),
    ).toBe(false);
  });
});

describe("BarChart — a chart that fits is byte-identical", () => {
  const chart = (props: Partial<Parameters<typeof BarChart>[0]> = {}) => (
    <BarChart animationDuration={0} data={rows(6)} xDataKey="name" {...props}>
      <Bar dataKey="value" />
      <BarXAxis />
    </BarChart>
  );

  it("scrollbar on six categories: no strip, no wrapper, same DOM as no prop", () => {
    const plain = normalise(render(chart()).container.innerHTML);
    expect(plain).toMatchSnapshot();
    cleanup();
    const withMini = render(chart({ scrollbar: "miniChart" }));
    expect(strip(withMini.container)).toBeNull();
    expect(normalise(withMini.container.innerHTML)).toBe(plain);
    cleanup();
    const withAuto = render(chart({ scrollbar: "auto", maxVisibleItems: 20 }));
    expect(normalise(withAuto.container.innerHTML)).toBe(plain);
  });

  it("the default (`scrollbar` unset) never mounts a strip, even on 120 categories", () => {
    const { container } = render(chart({ data: rows(120) }));
    expect(strip(container)).toBeNull();
  });
});

describe("BarChart — index-window slicing", () => {
  it("draws only the window; `data` and the indices stay whole", () => {
    const onDatapointClick = vi.fn();
    const data = rows(120);
    const { container } = render(
      <BarChart
        animationDuration={0}
        data={data}
        maxVisibleItems={20}
        onDatapointClick={onDatapointClick}
        scrollbar="miniChart"
        xDataKey="name"
      >
        <Bar dataKey="value" />
        <BarXAxis />
      </BarChart>,
    );
    expect(strip(container)).not.toBeNull();
    expect(strip(container)?.getAttribute("data-orientation")).toBe("horizontal");
    const ids = targets(container).map((t) => t.getAttribute("data-target-id"));
    expect(ids).toHaveLength(20);
    expect(ids[0]).toBe("value:0");
    expect(ids.at(-1)).toBe("value:19");
    const [start, end] = handles(container);
    expect(start?.getAttribute("aria-valuetext")).toBe("Row 1 of 120");
    expect(end?.getAttribute("aria-valuetext")).toBe("Row 20 of 120");
  });

  it('align="end" starts on the last categories', () => {
    const { container } = render(
      <BarChart
        align="end"
        animationDuration={0}
        data={rows(120)}
        maxVisibleItems={20}
        onDatapointClick={() => {}}
        scrollbar="bar"
        xDataKey="name"
      >
        <Bar dataKey="value" />
      </BarChart>,
    );
    expect(strip(container)?.getAttribute("data-scrollbar")).toBe("bar");
    const ids = targets(container).map((t) => t.getAttribute("data-target-id"));
    expect(ids[0]).toBe("value:100");
    expect(ids.at(-1)).toBe("value:119");
  });

  it("a controlled window moves the slice; the keyboard reports index windows", () => {
    const onWindowChange = vi.fn();
    const { container, rerender } = render(
      <BarChart
        animationDuration={0}
        data={rows(120)}
        onDatapointClick={() => {}}
        onWindowChange={onWindowChange}
        scrollbar="miniChart"
        window={{ kind: "index", start: 40, end: 60 }}
        xDataKey="name"
      >
        <Bar dataKey="value" />
      </BarChart>,
    );
    expect(targets(container)[0]?.getAttribute("data-target-id")).toBe("value:40");
    fireEvent.keyDown(handles(container)[0]!, { key: "ArrowRight" });
    const [next, meta] = onWindowChange.mock.calls.at(-1)! as [NavigatorWindow, unknown];
    expect(next).toEqual({ kind: "index", start: 41, end: 60 });
    expect(meta).toEqual({ phase: "commit", source: "keyboard" });
    rerender(
      <BarChart
        animationDuration={0}
        data={rows(120)}
        onDatapointClick={() => {}}
        onWindowChange={onWindowChange}
        scrollbar="miniChart"
        window={next}
        xDataKey="name"
      >
        <Bar dataKey="value" />
      </BarChart>,
    );
    expect(targets(container)[0]?.getAttribute("data-target-id")).toBe("value:41");
  });

  it("the category axis paints (and restates sr-only) only the visible categories", () => {
    const { container } = render(
      <BarChart
        animationDuration={0}
        data={rows(120)}
        maxVisibleItems={10}
        scrollbar="miniChart"
        xDataKey="name"
      >
        <Bar dataKey="value" />
        <BarXAxis />
      </BarChart>,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("C000");
    expect(text).toContain("C009");
    expect(text).not.toContain("C010");
    expect(text).not.toContain("C119");
  });
});

describe("BarChart — value domain while scrolling", () => {
  // Rows 0–99 are small; row 110 is huge and OUTSIDE the first window.
  const data = rows(120, (i) => (i === 110 ? 1000 : 10));
  const domainFor = (windowDomain?: "all" | "visible") => {
    let domain: number[] = [];
    render(
      <BarChart
        animationDuration={0}
        data={data}
        maxVisibleItems={20}
        scrollbar="miniChart"
        windowDomain={windowDomain}
        xDataKey="name"
      >
        <Bar dataKey="value" />
        <Probe onRead={(ctx) => (domain = ctx.yScale.domain())} />
      </BarChart>,
    );
    cleanup();
    return domain;
  };

  it('"all" (default) keeps the full data\'s zero-based domain', () => {
    const domain = domainFor();
    expect(domain[0]).toBe(0);
    expect(domain[1]).toBeGreaterThanOrEqual(1000);
  });

  it('"visible" refits to the window, still zero-based', () => {
    const domain = domainFor("visible");
    expect(domain[0]).toBe(0);
    expect(domain[1]).toBeLessThan(100);
  });

  it("stacked bars keep a stable axis over the window", () => {
    let domain: number[] = [];
    render(
      <BarChart
        animationDuration={0}
        data={data}
        maxVisibleItems={20}
        scrollbar="miniChart"
        stacked
        xDataKey="name"
      >
        <Bar dataKey="value" />
        <Bar dataKey="other" />
        <Probe onRead={(ctx) => (domain = ctx.yScale.domain())} />
      </BarChart>,
    );
    expect(domain[1]).toBeGreaterThanOrEqual(1005);
  });
});

describe("BarChart — horizontal bars", () => {
  it("mounts a VERTICAL strip on the right edge; handles announce rows", () => {
    const { container } = render(
      <BarChart
        animationDuration={0}
        data={rows(80)}
        maxVisibleItems={12}
        orientation="horizontal"
        scrollbar="miniChart"
        xDataKey="name"
      >
        <Bar dataKey="value" />
        <BarYAxis />
      </BarChart>,
    );
    const el = strip(container) as HTMLElement | null;
    expect(el).not.toBeNull();
    expect(el?.getAttribute("data-orientation")).toBe("vertical");
    // Right edge: the strip starts at the plot box's width minus its thickness.
    expect(Number.parseFloat(el?.style.left ?? "0")).toBeGreaterThan(500);
    const [start, end] = handles(container);
    expect(start?.getAttribute("aria-orientation")).toBe("vertical");
    expect(start?.getAttribute("aria-valuetext")).toBe("Row 1 of 80");
    expect(end?.getAttribute("aria-valuetext")).toBe("Row 12 of 80");
    // ArrowDown moves the thumb down (the value grows downward).
    fireEvent.keyDown(start!, { key: "ArrowDown" });
    expect(start?.getAttribute("aria-valuetext")).toBe("Row 2 of 80");
  });
});

describe("index integrity", () => {
  it("onDatapointClick returns the row's index into the FULL data", () => {
    const data = rows(120);
    const onDatapointClick = vi.fn<(point: ChartDatapoint) => void>();
    const { container } = render(
      <BarChart
        animationDuration={0}
        data={data}
        defaultWindow={{ kind: "index", start: 50, end: 70 }}
        onDatapointClick={onDatapointClick}
        scrollbar="miniChart"
        xDataKey="name"
      >
        <Bar dataKey="value" />
      </BarChart>,
    );
    fireEvent.click(targets(container)[3]!);
    const point = onDatapointClick.mock.calls[0]![0];
    expect(point.index).toBe(53);
    expect(point.datum).toBe(data[53]);
    expect(point.category).toBe("C053");
  });

  it("the tooltip's row index is into the full data, not the slice", async () => {
    const data = rows(120);
    let tooltipIndex: number | null = null;
    const { container } = render(
      <BarChart
        animationDuration={0}
        data={data}
        defaultWindow={{ kind: "index", start: 30, end: 50 }}
        margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
        scrollbar="miniChart"
        xDataKey="name"
      >
        <Bar dataKey="value" />
        <Probe onRead={(ctx) => (tooltipIndex = ctx.tooltipData?.index ?? tooltipIndex)} />
      </BarChart>,
    );
    const plot = container.querySelector<SVGGElement>('svg g[style*="cursor"]')!;
    // 20 visible columns over 560 px = 28 px each: x = 70 is the 3rd band.
    await waitFor(() => {
      fireEvent.mouseMove(plot, { clientX: 70, clientY: 100 });
      expect(tooltipIndex).toBe(32);
    });
  });
});

describe("HeatmapChart — column window", () => {
  const days = Array.from({ length: 365 }, (_, i) => `D${String(i).padStart(3, "0")}`);
  const cells = days.flatMap((day, column) =>
    ["North", "South", "West"].map((region, r) => ({
      day,
      region,
      v: ((column * 7 + r) % 13) + 1,
    })),
  );

  it("draws only the visible columns and keeps full-data indices", () => {
    const onDatapointClick = vi.fn<(point: ChartDatapoint) => void>();
    const { container } = render(
      <HeatmapChart
        data={cells}
        maxVisibleItems={30}
        onDatapointClick={onDatapointClick}
        scrollbar="miniChart"
        valueKey="v"
        window={{ kind: "index", start: 100, end: 130 }}
        x="day"
        y="region"
      />,
    );
    expect(strip(container)).not.toBeNull();
    expect(container.querySelectorAll('[data-slot="heatmap-cell"]')).toHaveLength(90);
    fireEvent.click(targets(container)[0]!);
    const point = onDatapointClick.mock.calls[0]![0];
    expect(point.index).toBe(cells.indexOf(point.datum as (typeof cells)[number]));
    expect(point.category).toBe("D100");
  });

  it("without a scrollbar the grid is untouched", () => {
    const { container } = render(<HeatmapChart data={cells} valueKey="v" x="day" y="region" />);
    expect(strip(container)).toBeNull();
    expect(container.querySelectorAll('[data-slot="heatmap-cell"]')).toHaveLength(365 * 3);
  });
});

describe("LineChart — band x", () => {
  it("scrolls by index through the shell's xDomain; the strip announces rows", () => {
    const data = rows(60);
    const { container } = render(
      <LineChart
        animationDuration={0}
        data={data}
        maxVisibleItems={10}
        scrollbar="miniChart"
        xDataKey="name"
        xScale="band"
      >
        {/* No Line child: Line calls getTotalLength() — not in jsdom. */}
        <XAxis />
      </LineChart>,
    );
    expect(strip(container)).not.toBeNull();
    const [start, end] = handles(container);
    expect(start?.getAttribute("aria-valuetext")).toBe("Row 1 of 60");
    expect(end?.getAttribute("aria-valuetext")).toBe("Row 10 of 60");
  });

  it("a band x that fits renders the same DOM with or without the prop", () => {
    const chart = (scrollbar?: "miniChart") => (
      <LineChart
        animationDuration={0}
        data={rows(6)}
        scrollbar={scrollbar}
        xDataKey="name"
        xScale="band"
      >
        <XAxis />
      </LineChart>
    );
    const a = normalise(render(chart()).container.innerHTML);
    cleanup();
    expect(normalise(render(chart("miniChart")).container.innerHTML)).toBe(a);
  });
});
