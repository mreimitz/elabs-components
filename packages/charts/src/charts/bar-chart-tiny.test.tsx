import type React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// A chat transcript renders charts into whatever the message column leaves. At
// 140×70 the fixed 40px margins alone exceed the box on the vertical axis, so
// this file's viewport is the regression: `bar-chart.test.tsx` mocks a roomy
// 560×288 and cannot see it.
vi.mock("@visx/responsive", async () => {
  const actual = await vi.importActual<typeof import("@visx/responsive")>("@visx/responsive");
  return {
    ...actual,
    ParentSize: ({
      children,
    }: {
      children: (size: { width: number; height: number }) => React.ReactNode;
    }) => <div>{children({ width: 140, height: 70 })}</div>,
  };
});

import { Bar } from "./bar";
import { BarChart } from "./bar-chart";
import { BarXAxis } from "./bar-x-axis";

const regionData = [
  { region: "Q1 Western Region", revenue: 14200 },
  { region: "Q2 Northern Region", revenue: 16800 },
  { region: "Q3 Southeastern Region", revenue: 12400 },
];

function renderTiny() {
  return render(
    <BarChart data={regionData} xDataKey="region">
      <Bar dataKey="revenue" fill="var(--chart-1)" />
      <BarXAxis />
    </BarChart>,
  );
}

describe("BarChart in a box smaller than its own margins", () => {
  it("still paints its bars", () => {
    const { container } = renderTiny();
    const bars = container.querySelectorAll("svg rect");
    expect(bars.length).toBeGreaterThan(0);
  });

  it("never emits a negative geometry attribute", () => {
    const { container } = renderTiny();
    for (const rect of container.querySelectorAll("svg rect")) {
      for (const attr of ["width", "height"] as const) {
        const raw = rect.getAttribute(attr);
        if (raw !== null) {
          expect(Number.parseFloat(raw)).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("hides the category axis rather than painting an illegible smear", () => {
    const { container } = renderTiny();
    expect(container.querySelector(".text-chart-label")).toBeNull();
    // …and the names it dropped are still readable by AT.
    expect(container.textContent).toContain("Q3 Southeastern Region");
  });
});
