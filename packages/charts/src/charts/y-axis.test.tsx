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

import { cleanup, render } from "@testing-library/react";
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
