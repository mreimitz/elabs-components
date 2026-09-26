import { cleanup, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// See bar-chart.test.tsx: jsdom lacks ResizeObserver/real measurement.
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

import { Bar } from "./bar";
import { BarChart } from "./bar-chart";
import * as yAxisScales from "./y-axis-scales";

const minimalData = [
  { month: "Jan", value: 100 },
  { month: "Feb", value: 200 },
  { month: "Mar", value: 150 },
];

afterEach(cleanup);

describe("BarChart — series memoization is content-stable, not children-identity-keyed", () => {
  it("does not rebuild the vertical (line/bar) y-scale when a parent re-renders with an equal series", () => {
    // BarChart's own `lines`/`children` extraction runs before the horizontal
    // check; use the vertical path (default `isHorizontal` false) so the
    // `buildYScalesForLines` branch of `yScales` is exercised.
    const buildYScalesSpy = vi.spyOn(yAxisScales, "buildYScalesForLines");

    function Harness() {
      const [, setTick] = useState(0);
      return (
        <div>
          <button onClick={() => setTick((t) => t + 1)}>rerender</button>
          {/* A fresh <Bar> element every render — same content, new identity. */}
          <BarChart data={minimalData} xDataKey="month">
            <Bar dataKey="value" fill="var(--chart-1)" />
          </BarChart>
        </div>
      );
    }

    const { getByText } = render(<Harness />);
    const callsAfterMount = buildYScalesSpy.mock.calls.length;
    expect(callsAfterMount).toBeGreaterThan(0);

    // Re-render the parent (and thus BarChart, with brand-new `children`
    // element identity) several times without changing anything semantic.
    fireEvent.click(getByText("rerender"));
    fireEvent.click(getByText("rerender"));
    fireEvent.click(getByText("rerender"));

    expect(buildYScalesSpy.mock.calls.length).toBe(callsAfterMount);

    buildYScalesSpy.mockRestore();
  });
});
