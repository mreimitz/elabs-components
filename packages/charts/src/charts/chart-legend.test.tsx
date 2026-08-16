/**
 * chart-legend.test.tsx — smoke test for the #394 density-role className fix.
 *
 * `ChartLegend`'s percentage span used the raw `text-xs` utility, which the
 * `data-density` type dial (#340) cannot reach — see
 * `.claude/rules/styling-and-tokens.md` "Type is a role, not a size". This
 * locks the swap to the `text-meta` role. No mocking needed: `ChartLegend` is
 * a plain DOM component with no visx/ResizeObserver dependency.
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChartLegend, type LegendItem } from "./chart-legend";

afterEach(cleanup);

const items: LegendItem[] = [
  { color: "var(--chart-1)", label: "Revenue", seriesIndex: 0, value: 21200, maxValue: 25000 },
];

describe("ChartLegend — density-role className (#394)", () => {
  it("renders the percentage with the text-meta role, not the raw text-xs utility", () => {
    const { container } = render(<ChartLegend items={items} showProgress title="Series" />);
    const percentage = container.querySelector('[aria-valuenow="21200"] span.col-start-3');
    expect(percentage).not.toBeNull();
    expect(percentage?.textContent).toBe("85%");
    expect(percentage).toHaveClass("text-meta");
    expect(percentage).not.toHaveClass("text-xs");
    // tabular-nums must survive the swap (brief: "preserve every other utility").
    expect(percentage).toHaveClass("tabular-nums");
  });
});
