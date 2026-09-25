/**
 * RM-140 — ChartNavigator: strip DOM contract, keyboard contract, pointer
 * gestures, and the shell's byte-identical opt-out.
 *
 * The "byte-identical" snapshots were recorded against the shell BEFORE the
 * navigator landed; with `scrollbar="none"` (or nothing set, on data below
 * `maxVisiblePoints`) the rendered DOM must still match them exactly.
 */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

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

import { AreaChart } from "../area-chart";
import { ChartNavigator } from "./chart-navigator";
import type { NavigatorWindow } from "./types";
import { Grid } from "../grid";
import { Line } from "../line";
import { LineChart } from "../line-chart";
import { XAxis } from "../x-axis";
import { YAxis } from "../y-axis";

afterEach(cleanup);

// jsdom has no SVG geometry: the derived-series painter measures its path.
beforeAll(() => {
  Object.defineProperty(SVGElement.prototype, "getTotalLength", {
    configurable: true,
    value: () => 100,
  });
});

// jsdom has no PointerEvent: React reads clientX / pointerId off a MouseEvent subclass.
if (typeof globalThis.PointerEvent === "undefined") {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? "mouse";
    }
  }
  globalThis.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
}

const DAY = 86_400_000;
const T0 = Date.UTC(2024, 0, 1);

function makeRows(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    date: new Date(T0 + i * DAY),
    users: 100 + ((i * 37) % 50),
    sessions: 300 + ((i * 11) % 80),
  }));
}

function lineChart(extra: Record<string, unknown> = {}) {
  return (
    <LineChart animationDuration={0} data={makeRows(24)} {...extra}>
      <Grid horizontal />
      <XAxis />
      <YAxis />
    </LineChart>
  );
}

describe("shell opt-out is byte-identical", () => {
  it("LineChart with nothing set matches the pre-navigator DOM", () => {
    // `tooltip: false`: the snapshot predates the default tooltip.
    const { container } = render(lineChart({ tooltip: false }));
    expect(container.innerHTML).toMatchSnapshot();
  });

  it("AreaChart with nothing set matches the pre-navigator DOM", () => {
    const { container } = render(
      <AreaChart animationDuration={0} data={makeRows(24)} tooltip={false}>
        <Grid horizontal />
        <XAxis />
      </AreaChart>,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});

// ── The strip on its own ─────────────────────────────────────────────────────

function indexStrip(extra: Partial<React.ComponentProps<typeof ChartNavigator>> = {}) {
  const onWindowChange = vi.fn();
  const utils = render(
    <ChartNavigator
      data={Array.from({ length: 100 }, (_, i) => ({ v: i % 10 === 3 ? 90 : 10 }))}
      defaultWindow={{ kind: "index", start: 20, end: 40 }}
      extent={[0, 100]}
      kind="index"
      length={200}
      onWindowChange={onWindowChange}
      valueKeys={["v"]}
      {...extra}
    />,
  );
  const [start, end] = screen.getAllByRole("slider");
  return { ...utils, onWindowChange, start: start!, end: end! };
}

describe("ChartNavigator — DOM contract", () => {
  it("renders the strip parts with their data-slots, outside the aria-hidden svg", () => {
    const { container } = indexStrip();
    const root = container.querySelector('[data-slot="chart-navigator"]')!;
    expect(root).toHaveStyle({ height: "40px", width: "200px" });
    expect(root.querySelector('[data-slot="chart-navigator-track"]')).not.toBeNull();
    expect(root.querySelector('[data-slot="chart-navigator-shadow"]')).not.toBeNull();
    expect(root.querySelector('[data-slot="chart-navigator-window"]')).not.toBeNull();
    const handles = root.querySelectorAll('[data-slot="chart-navigator-handle"]');
    expect(handles).toHaveLength(2);
    for (const handle of handles) {
      expect(handle.tagName).toBe("BUTTON");
      expect(handle.closest("svg")).toBeNull();
      expect(handle).toHaveClass("focus-ring");
    }
    expect(screen.getByRole("group", { name: "Chart navigator" })).toContainElement(
      handles[0] as HTMLElement,
    );
  });

  it("paints the shadow in --chart-foreground-muted and the window with the compound outline", () => {
    const { container } = indexStrip();
    const shadow = container.querySelector('[data-slot="chart-navigator-shadow"]')!;
    expect(shadow.getAttribute("fill")).toBe("var(--chart-foreground-muted)");
    expect(shadow.getAttribute("opacity")).toBeNull();
    const rects = container.querySelectorAll('[data-slot="chart-navigator-window"] rect');
    expect(rects[0]!.getAttribute("stroke")).toBe("var(--chart-foreground)");
    expect(rects[1]!.getAttribute("stroke")).toBe("var(--chart-background)");
  });

  it('draws no shadow for scrollbar="bar"', () => {
    const { container } = indexStrip({ scrollbar: "bar" });
    expect(container.querySelector('[data-slot="chart-navigator-shadow"]')).toBeNull();
    expect(container.querySelector('[data-slot="chart-navigator"]')).toHaveStyle({
      height: "24px",
    });
  });

  it("uses the 32 px strip at the narrow tier", async () => {
    const { ChartConfigProvider } = await import("../chart-config-context");
    const { container } = render(
      <ChartConfigProvider value={{ breakpoint: "narrow" }}>
        <ChartNavigator extent={[0, 10]} kind="index" length={200} />
      </ChartConfigProvider>,
    );
    expect(container.querySelector('[data-slot="chart-navigator"]')).toHaveStyle({
      height: "32px",
    });
  });
});

describe("ChartNavigator — keyboard (APG multi-thumb slider)", () => {
  it("exposes value, bounds and data-terms value text", () => {
    const { start, end } = indexStrip();
    expect(start).toHaveAttribute("aria-valuenow", "20");
    expect(start).toHaveAttribute("aria-valuemin", "0");
    expect(start).toHaveAttribute("aria-valuemax", "37");
    expect(start).toHaveAttribute("aria-valuetext", "Row 21 of 100");
    expect(end).toHaveAttribute("aria-valuenow", "40");
    expect(end).toHaveAttribute("aria-valuemin", "23");
    expect(end).toHaveAttribute("aria-valuetext", "Row 40 of 100");
    expect(start).toHaveAccessibleName("Window start");
    expect(end).toHaveAccessibleName("Window end");
  });

  it("arrows step one row, Shift+arrows ten, and every key commits", () => {
    const { start, onWindowChange } = indexStrip();
    fireEvent.keyDown(start, { key: "ArrowRight" });
    expect(onWindowChange).toHaveBeenLastCalledWith(
      { kind: "index", start: 21, end: 40 },
      { phase: "commit", source: "keyboard" },
    );
    expect(start).toHaveAttribute("aria-valuenow", "21");
    fireEvent.keyDown(start, { key: "ArrowLeft", shiftKey: true });
    expect(start).toHaveAttribute("aria-valuenow", "11");
  });

  it("Home / End go to the thumb's own bounds; PageUp / PageDown pan a window", () => {
    const { start, end } = indexStrip();
    fireEvent.keyDown(start, { key: "Home" });
    expect(start).toHaveAttribute("aria-valuenow", "0");
    fireEvent.keyDown(end, { key: "End" });
    expect(end).toHaveAttribute("aria-valuenow", "100");
    fireEvent.keyDown(end, { key: "Home" });
    expect(end).toHaveAttribute("aria-valuenow", "3");
    fireEvent.keyDown(end, { key: "PageUp" });
    expect(start).toHaveAttribute("aria-valuenow", "3");
    expect(end).toHaveAttribute("aria-valuenow", "6");
    fireEvent.keyDown(end, { key: "PageDown" });
    expect(start).toHaveAttribute("aria-valuenow", "0");
  });

  it("stops minSpan short of the other thumb", () => {
    const { start } = indexStrip({ minSpan: 10 });
    fireEvent.keyDown(start, { key: "End" });
    expect(start).toHaveAttribute("aria-valuenow", "30");
  });

  it("ignores Enter and Space", () => {
    const { start, onWindowChange } = indexStrip();
    fireEvent.keyDown(start, { key: "Enter" });
    fireEvent.keyDown(start, { key: " " });
    expect(onWindowChange).not.toHaveBeenCalled();
  });

  it("announces the settled range in the polite live region", () => {
    const { start, container } = indexStrip();
    fireEvent.keyDown(start, { key: "ArrowRight" });
    const status = container.querySelector('[data-slot="chart-navigator-status"]')!;
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Showing Row 22 of 100 to Row 40 of 100");
  });

  it("formats a time thumb as a date and steps by the median data step", () => {
    const DAYS = 30;
    const rows = Array.from({ length: DAYS }, (_, i) => ({ date: new Date(T0 + i * DAY), v: i }));
    const onWindowChange = vi.fn();
    render(
      <ChartNavigator
        data={rows}
        defaultWindow={{ kind: "time", start: new Date(T0), end: new Date(T0 + 10 * DAY) }}
        extent={[new Date(T0), new Date(T0 + (DAYS - 1) * DAY)]}
        kind="time"
        length={300}
        onWindowChange={onWindowChange}
        valueKeys={["v"]}
      />,
    );
    const [start] = screen.getAllByRole("slider");
    expect(start!.getAttribute("aria-valuetext")).toMatch(/Jan 1, 2024/);
    fireEvent.keyDown(start!, { key: "ArrowRight" });
    const [win] = onWindowChange.mock.calls.at(-1)! as [NavigatorWindow];
    expect(win.kind).toBe("time");
    expect((win.start as Date).getTime()).toBe(T0 + DAY);
  });
});

describe("ChartNavigator — pointer and wheel", () => {
  function stubRect(el: Element, width: number, height = 40) {
    el.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: width, bottom: height, width, height, x: 0, y: 0 }) as DOMRect;
  }

  it("dragging the window pans it and commits once on release", async () => {
    const { container, onWindowChange } = indexStrip();
    const root = container.querySelector('[data-slot="chart-navigator"]')!;
    stubRect(root, 200);
    const track = container.querySelector('[data-slot="chart-navigator-track"]')!;
    // Window 20..40 of 100 over 200 px → 40..80 px. Grab at 60 px, move 20 px (= 10 rows).
    fireEvent.pointerDown(track, { clientX: 60, pointerId: 1, button: 0, pointerType: "mouse" });
    fireEvent.pointerMove(track, { clientX: 80, pointerId: 1, pointerType: "mouse" });
    await waitFor(() =>
      expect(onWindowChange).toHaveBeenCalledWith(
        { kind: "index", start: 30, end: 50 },
        { phase: "move", source: "pointer" },
      ),
    );
    fireEvent.pointerUp(track, { clientX: 80, pointerId: 1, pointerType: "mouse" });
    expect(onWindowChange).toHaveBeenLastCalledWith(
      { kind: "index", start: 30, end: 50 },
      { phase: "commit", source: "pointer" },
    );
    expect(onWindowChange.mock.calls.filter(([, m]) => m.phase === "commit")).toHaveLength(1);
  });

  it("dragging a handle moves only that edge", () => {
    const { container, end, onWindowChange } = indexStrip();
    stubRect(container.querySelector('[data-slot="chart-navigator"]')!, 200);
    fireEvent.pointerDown(end, { clientX: 80, pointerId: 2, button: 0, pointerType: "touch" });
    fireEvent.pointerMove(end, { clientX: 120, pointerId: 2, pointerType: "touch" });
    fireEvent.pointerUp(end, { clientX: 120, pointerId: 2, pointerType: "touch" });
    expect(onWindowChange).toHaveBeenLastCalledWith(
      { kind: "index", start: 20, end: 60 },
      { phase: "commit", source: "touch" },
    );
  });

  it("a press outside the window centres it there", () => {
    const { container, onWindowChange } = indexStrip();
    stubRect(container.querySelector('[data-slot="chart-navigator"]')!, 200);
    const track = container.querySelector('[data-slot="chart-navigator-track"]')!;
    fireEvent.pointerDown(track, { clientX: 160, pointerId: 3, button: 0, pointerType: "mouse" });
    fireEvent.pointerUp(track, { clientX: 160, pointerId: 3, pointerType: "mouse" });
    expect(onWindowChange).toHaveBeenLastCalledWith(
      { kind: "index", start: 70, end: 90 },
      { phase: "commit", source: "pointer" },
    );
  });

  it("the wheel pans the window", async () => {
    vi.useFakeTimers();
    try {
      const { container, onWindowChange } = indexStrip();
      const root = container.querySelector('[data-slot="chart-navigator"]')!;
      act(() => {
        root.dispatchEvent(
          new WheelEvent("wheel", { deltaY: 500, bubbles: true, cancelable: true }),
        );
      });
      await act(async () => {
        vi.advanceTimersByTime(400);
      });
      expect(onWindowChange).toHaveBeenLastCalledWith(
        { kind: "index", start: 30, end: 50 },
        { phase: "commit", source: "wheel" },
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("ChartNavigator — performance", () => {
  it("re-renders a 50 000-row strip under 16 ms once the shadow is condensed", () => {
    const rows = Array.from({ length: 50_000 }, (_, i) => ({ v: (i * 7919) % 1000 }));
    const strip = (start: number) => (
      <ChartNavigator
        data={rows}
        extent={[0, 50_000]}
        kind="index"
        length={800}
        valueKeys={["v"]}
        window={{ kind: "index", start, end: start + 2000 }}
      />
    );
    const { rerender } = render(strip(0));
    // Warm the JIT on the re-render path, then time a window move.
    rerender(strip(100));
    const t0 = performance.now();
    rerender(strip(5000));
    const elapsed = performance.now() - t0;
    expect(screen.getAllByRole("slider")[0]).toHaveAttribute("aria-valuenow", "5000");
    expect(elapsed).toBeLessThan(16);
  });
});

// ── The shell ────────────────────────────────────────────────────────────────

describe("time-series shell + navigator", () => {
  it('stays off with scrollbar="none" even above maxVisiblePoints', () => {
    const { container } = render(
      <LineChart animationDuration={0} data={makeRows(2500)} scrollbar="none">
        <XAxis />
      </LineChart>,
    );
    expect(container.querySelector('[data-slot="chart-navigator"]')).toBeNull();
  });

  it('scrollbar="none" on small data renders exactly what no prop renders', () => {
    // `useId` values differ between two mounts; everything else must not.
    const normalise = (html: string) => html.replace(/_r_[0-9a-z]+_/g, "_id_");
    const a = normalise(render(lineChart()).container.innerHTML);
    cleanup();
    const b = normalise(render(lineChart({ scrollbar: "none" })).container.innerHTML);
    expect(b).toBe(a);
  });

  it("2 500 rows with no scrollbar prop render the whole series (no strip)", () => {
    const { container } = render(
      <LineChart animationDuration={0} data={makeRows(2500)}>
        <XAxis />
      </LineChart>,
    );
    expect(container.querySelector('[data-slot="chart-navigator"]')).toBeNull();
  });

  it('scrollbar="auto" mounts below the plot once rows exceed maxVisiblePoints, windowing the first 2000', () => {
    const onWindowChange = vi.fn();
    const { container } = render(
      <LineChart
        animationDuration={0}
        data={makeRows(2500)}
        onWindowChange={onWindowChange}
        scrollbar="auto"
      >
        <XAxis />
      </LineChart>,
    );
    const strip = container.querySelector<HTMLElement>('[data-slot="chart-navigator"]')!;
    expect(strip).not.toBeNull();
    expect(strip.style.top).toBe("calc(100% + 8px)");
    // The plot box keeps its size; the root reserves the strip below itself.
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.marginBottom).toBe("48px");
    expect(root.contains(strip)).toBe(true);
    const [start, end] = screen.getAllByRole("slider");
    expect(Number(start!.getAttribute("aria-valuenow"))).toBe(T0);
    expect(Number(end!.getAttribute("aria-valuenow"))).toBe(T0 + 1999 * DAY);
  });

  it("the navigable axis reaches a forecast's horizon (RM-139 × RM-140)", () => {
    // 60 daily rows, a 7-day season, a 10-step forecast: the end thumb may
    // travel 10 days past the last reading, and a window ending there paints
    // the projection instead of clipping it.
    const rows = makeRows(60);
    render(
      <LineChart
        analytics={[{ kind: "forecast", horizon: 10, season: 7, id: "fc" }]}
        animationDuration={0}
        data={rows}
        defaultWindow={{ kind: "time", start: rows[30]!.date, end: new Date(T0 + 69 * DAY) }}
        scrollbar="miniChart"
      >
        <Line dataKey="users" />
        <XAxis />
      </LineChart>,
    );
    const [, end] = screen.getAllByRole("slider");
    expect(Number(end!.getAttribute("aria-valuemax"))).toBe(T0 + 69 * DAY);
    expect(Number(end!.getAttribute("aria-valuenow"))).toBe(T0 + 69 * DAY);
  });

  it('align="end" starts at the latest data', () => {
    render(
      <LineChart align="end" animationDuration={0} data={makeRows(2500)} scrollbar="auto">
        <XAxis />
      </LineChart>,
    );
    const [, end] = screen.getAllByRole("slider");
    expect(Number(end!.getAttribute("aria-valuenow"))).toBe(T0 + 2499 * DAY);
  });

  it("a controlled window drives the plot and reports keyboard commits", () => {
    const onWindowChange = vi.fn();
    const win: NavigatorWindow = {
      kind: "time",
      start: new Date(T0 + 5 * DAY),
      end: new Date(T0 + 15 * DAY),
    };
    render(
      <LineChart
        animationDuration={0}
        data={makeRows(24)}
        onWindowChange={onWindowChange}
        window={win}
      >
        <XAxis />
      </LineChart>,
    );
    const [start] = screen.getAllByRole("slider");
    expect(Number(start!.getAttribute("aria-valuenow"))).toBe(T0 + 5 * DAY);
    fireEvent.keyDown(start!, { key: "ArrowRight" });
    const [next, meta] = onWindowChange.mock.calls.at(-1)!;
    expect(meta).toEqual({ phase: "commit", source: "keyboard" });
    expect((next as NavigatorWindow & { kind: "time" }).start.getTime()).toBe(T0 + 6 * DAY);
  });

  it("AreaChart passes the navigator props through", () => {
    const { container } = render(
      <AreaChart animationDuration={0} data={makeRows(24)} scrollbar="bar">
        <XAxis />
      </AreaChart>,
    );
    const strip = container.querySelector('[data-slot="chart-navigator"]')!;
    expect(strip).toHaveAttribute("data-scrollbar", "bar");
  });
});

describe("test double", () => {
  it("validates the strip's kind and extent", async () => {
    const { ChartNavigator: Double } = await import("../../test/primitives");
    const { ChartContractError } = await import("../../test/contract");
    expect(() => render(<Double extent={[0, 10]} kind="index" />)).not.toThrow();
    expect(() => render(<Double extent={[0, 10]} kind="rows" />)).toThrow(ChartContractError);
    expect(() => render(<Double extent={[new Date("nope"), new Date()]} kind="time" />)).toThrow(
      ChartContractError,
    );
  });
});
