/**
 * `YAxis` tick positioning (#609, RM-127 a-4).
 *
 * Each tick used to tween its own `top` — a layout property — via a CSS
 * `transition`. N ticks transitioning `top` at once means N independent
 * reflows a frame; under load the browser can miss a frame for one tick but
 * not its neighbour, so two ticks briefly desync mid-tween and render on top
 * of each other before both settle at their (never-conflicting) final rows.
 * The fix moves the tween onto `transform: translateY(...)` — a
 * compositor-only property — so every tick's move is folded into the same
 * rasterized layer update and they stay in lockstep for the whole
 * transition.
 *
 * Rendered through `LineChart` (real `ChartProvider`, mirrors
 * `x-axis.test.tsx`'s pattern) with no `Line` child — `YAxis` needs none;
 * an unregistered axis falls back to the default `[0, 100]` domain
 * (`y-domain-utils.ts`).
 */

import type { ReactElement } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetWarnOnce } from "@elabs-ai/components-ui/definition";

// ChartParentSize uses ResizeObserver + real DOM measurement which jsdom lacks.
vi.mock("./chart-parent-size", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory is hoisted; lazy require avoids TDZ
  const React = require("react");
  return {
    ChartParentSize: ({
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

import { YAxis as YAxisPart } from "../test/primitives";
import { LineChart } from "./line-chart";
import { YAxis } from "./y-axis";

afterEach(cleanup);

const chartData = [
  { date: new Date("2024-01-01"), value: 5 },
  { date: new Date("2024-02-01"), value: 8 },
];

describe("YAxis — tick tween coordination (#609)", () => {
  it("positions a tick via transform, not top, and transitions transform", () => {
    const { container } = render(
      <LineChart data={chartData}>
        <YAxis />
      </LineChart>,
    );
    const ticks = [...container.querySelectorAll('[data-slot="y-axis"] > div > div')];
    expect(ticks.length).toBeGreaterThan(0);

    for (const tick of ticks) {
      const styleAttr = tick.getAttribute("style") ?? "";
      // `top` stays fixed — it no longer carries the tick's position.
      expect(styleAttr).toMatch(/top:\s*0px/);
      // The transition targets `transform`, never `top` (the old, layout-
      // reflowing tween that let neighbours desync).
      expect(styleAttr).toMatch(/transition:\s*transform\s/);
      expect(styleAttr).not.toMatch(/transition:\s*top\s/);
      // Position (translateY(<px>)) composes with the existing vertical-
      // centering translateY(-50%) — both live in the one `transform`.
      expect(styleAttr.match(/translateY\(/g)?.length).toBe(2);
    }
  });
});

const many = Array.from({ length: 24 }, (_, i) => ({
  date: new Date(2023, i, 1),
  value: 10 + i,
}));

describe("YAxis — `numTicks` → `tickCount`, `orientation` → `position` (RM-192)", () => {
  afterEach(() => {
    resetWarnOnce();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  const warnSpy = () => vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const axisNode = (root: HTMLElement) => root.querySelector('[data-slot="y-axis"]');
  const tickCountOf = (axis: ReactElement): number => {
    const { container } = render(<LineChart data={many}>{axis}</LineChart>);
    return Number(axisNode(container)?.getAttribute("data-tick-count"));
  };

  it("`tickCount` renders the same axis DOM as `numTicks`", () => {
    warnSpy();
    const { container: renamed } = render(
      <LineChart data={many}>
        <YAxis tickCount={3} />
      </LineChart>,
    );
    const { container: old } = render(
      <LineChart data={many}>
        <YAxis numTicks={3} />
      </LineChart>,
    );
    expect(axisNode(old)?.outerHTML).toBe(axisNode(renamed)?.outerHTML);
  });

  it("`position` renders the same axis DOM as `orientation`", () => {
    warnSpy();
    const { container: renamed } = render(
      <LineChart data={many}>
        <YAxis position="right" />
      </LineChart>,
    );
    const { container: old } = render(
      <LineChart data={many}>
        <YAxis orientation="right" />
      </LineChart>,
    );
    expect(axisNode(old)?.outerHTML).toBe(axisNode(renamed)?.outerHTML);
  });

  it("warns once per name in development, however often it renders", () => {
    const warn = warnSpy();
    const { rerender } = render(
      <LineChart data={many}>
        <YAxis numTicks={3} />
      </LineChart>,
    );
    rerender(
      <LineChart data={many}>
        <YAxis numTicks={4} />
      </LineChart>,
    );
    render(
      <LineChart data={many}>
        <YAxis orientation="right" />
      </LineChart>,
    );
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(
      '[YAxis] "numTicks" is deprecated and will be removed in 6.0.0. Use "tickCount".',
    );
    expect(warn).toHaveBeenCalledWith(
      '[YAxis] "orientation" is deprecated and will be removed in 6.0.0. Use "position".',
    );
  });

  it("never warns in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const warn = warnSpy();
    render(
      <LineChart data={many}>
        <YAxis numTicks={3} orientation="right" />
      </LineChart>,
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it("the ./test double stays silent under its default", () => {
    const warn = warnSpy();
    render(<YAxisPart numTicks={3} orientation="right" />);
    expect(warn).not.toHaveBeenCalled();
  });

  it("both given, old-wins: `numTicks` beats `tickCount`, and warns which one was dropped", () => {
    const warn = warnSpy();
    expect(tickCountOf(<YAxis numTicks={3} tickCount={8} />)).toBe(3);
    expect(warn).toHaveBeenCalledWith(
      '[YAxis] "numTicks" is deprecated and will be removed in 6.0.0. Use "tickCount". ' +
        '"tickCount" was ignored: "numTicks" still wins while both are set — remove "numTicks".',
    );
  });

  it("a non-finite `numTicks` never wins over an explicit `tickCount`", () => {
    warnSpy();
    expect(tickCountOf(<YAxis numTicks={NaN} tickCount={3} />)).toBe(3);
    // Fix round 1: `null` slipped through a first-pass `!= null` guard (it is false FOR null).
    expect(tickCountOf(<YAxis numTicks={null as never} tickCount={3} />)).toBe(3);
  });

  it("both given, new-wins: `position` beats `orientation`, and warns which one was dropped", () => {
    const warn = warnSpy();
    const { container } = render(
      <LineChart data={many}>
        <YAxis orientation="left" position="right" />
      </LineChart>,
    );
    expect(axisNode(container)).toBeTruthy();
    expect(warn).toHaveBeenCalledWith(
      '[YAxis] "orientation" is deprecated and will be removed in 6.0.0. Use "position". ' +
        '"orientation" was ignored because "position" is set.',
    );
  });
});
