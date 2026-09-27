/**
 * AreaBand + Grid highlight-line smoke tests.
 *
 * Mounted via a real `LineChart` (no `Line` child — `Line` calls
 * `getTotalLength()` on an SVG path, an API jsdom does not implement; see
 * `line-chart.test.tsx`). `AreaBand` and `Grid`'s highlight lines never touch
 * that API, so they render for real here — unlike most of this package's
 * container tests, this is genuine markup assertion, not a mocked shell.
 *
 * Real render, animation, interaction and a11y are covered by the Storybook
 * story (Charts/LineChart "WithReferenceBand") in a real browser via
 * `pnpm --filter @elabs-ai/components-docs test-storybook`.
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

import { AreaBand } from "./area-band";
import { Grid } from "./grid";
import { LineChart } from "./line-chart";

const bandData = [
  { week: 1, lo: 90, hi: 110 },
  { week: 2, lo: 85, hi: 130 },
  { week: 3, lo: 80, hi: 150 },
];

afterEach(cleanup);

describe("AreaBand", () => {
  it("renders a fill path between lowKey and highKey", () => {
    const { container } = render(
      <LineChart data={bandData} xDataKey="week" xScale="linear">
        <AreaBand highKey="hi" lowKey="lo" />
      </LineChart>,
    );
    const path = container.querySelector('[data-slot="area-band"] path');
    expect(path).toBeInTheDocument();
    expect(path).toHaveAttribute("fill", "var(--chart-ring-background)");
  });

  it("uses a custom fill/opacity when given", () => {
    const { container } = render(
      <LineChart data={bandData} xDataKey="week" xScale="linear">
        <AreaBand fill="var(--chart-2)" fillOpacity={0.2} highKey="hi" lowKey="lo" />
      </LineChart>,
    );
    const path = container.querySelector('[data-slot="area-band"] path');
    expect(path).toHaveAttribute("fill", "var(--chart-2)");
    expect(path).toHaveAttribute("fill-opacity", "0.2");
  });
});

describe("Grid highlightColumnValues / highlightRowLabel (#…)", () => {
  it("draws one vertical line per highlightColumnValues entry, with a label", () => {
    const { container } = render(
      <LineChart data={bandData} xDataKey="week" xScale="linear">
        <Grid
          highlightColumnLabel={(v) => (v === 2 ? "Today" : undefined)}
          highlightColumnValues={[2]}
        />
      </LineChart>,
    );
    const group = container.querySelector(".chart-grid-highlight-columns");
    expect(group?.querySelectorAll("line")).toHaveLength(1);
    expect(group?.textContent).toBe("Today");
  });

  it("draws a labelled horizontal reference line for highlightRowValues", () => {
    const { container } = render(
      <LineChart data={bandData} xDataKey="week" xScale="linear">
        <Grid
          highlightRowLabel={(v) => `Target ${v}`}
          highlightRowStrokeDasharray="2 3"
          highlightRowValues={[120]}
        />
      </LineChart>,
    );
    const group = container.querySelector(".chart-grid-highlight-rows");
    const line = group?.querySelector("line");
    expect(line).toHaveAttribute("stroke-dasharray", "2 3");
    expect(group?.textContent).toBe("Target 120");
  });

  it("omits the label when the callback returns undefined — no empty text node", () => {
    const { container } = render(
      <LineChart data={bandData} xDataKey="week" xScale="linear">
        <Grid highlightRowLabel={() => undefined} highlightRowValues={[120]} />
      </LineChart>,
    );
    const group = container.querySelector(".chart-grid-highlight-rows");
    expect(group?.querySelector("text")).not.toBeInTheDocument();
  });
});
