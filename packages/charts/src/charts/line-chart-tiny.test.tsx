/**
 * Regression test (#599): a narrow tile — e.g. the home tour's dashboard chart
 * at 390px, or any chat/dashboard column narrower than the chart's own fixed
 * margins — drives `innerHeight`/`innerWidth` negative before either
 * `time-series-chart-shell.tsx` or `grid.tsx`'s fade-mask `<rect>`s clamp it,
 * so React (and jsdom via `bar-chart-tiny.test.tsx`'s sibling pattern) logs
 * `<rect> attribute height: A negative value is not valid.`
 *
 * `LineChart`'s `DEFAULT_MARGIN` is 40px on every side, so a 140×70 viewport
 * (mirrors `bar-chart-tiny.test.tsx`) leaves innerHeight = 70 - 80 = -10 before
 * a clamp — same shape of bug, different chart family (time-series shell +
 * `Grid`, not `bar-chart.tsx`'s own bars).
 */

import type React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./chart-parent-size", async () => {
  const actual = await vi.importActual<typeof import("@visx/responsive")>("@visx/responsive");
  return {
    ...actual,
    ChartParentSize: ({
      children,
    }: {
      children: (size: { width: number; height: number }) => React.ReactNode;
    }) => <div>{children({ width: 140, height: 70 })}</div>,
  };
});

import { Grid } from "./grid";
import { LineChart } from "./line-chart";

const chartData = [
  { date: new Date("2024-01-01"), users: 1200 },
  { date: new Date("2024-02-01"), users: 1350 },
  { date: new Date("2024-03-01"), users: 1100 },
];

function renderTiny() {
  return render(
    // No `Line` child: it calls `getTotalLength()` on an SVG path, an API
    // jsdom does not implement (documented in line-chart.test.tsx). The
    // grid's fade-mask rects — this bug's actual site — render regardless.
    <LineChart data={chartData}>
      <Grid horizontal />
    </LineChart>,
  );
}

describe("LineChart in a box smaller than its own margins", () => {
  it("never emits a negative geometry attribute", () => {
    const { container } = renderTiny();
    const rects = container.querySelectorAll("svg rect");
    expect(rects.length).toBeGreaterThan(0);
    for (const rect of rects) {
      for (const attr of ["width", "height"] as const) {
        const raw = rect.getAttribute(attr);
        if (raw !== null) {
          expect(Number.parseFloat(raw)).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});
