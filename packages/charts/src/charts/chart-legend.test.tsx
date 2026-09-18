/**
 * chart-legend.test.tsx — smoke test for the #394 density-role className fix.
 *
 * `ChartLegend`'s percentage span used the raw `text-xs` utility, which the
 * `data-density` type dial (#340) cannot reach — see
 * `.claude/rules/styling-and-tokens.md` "Type is a role, not a size". This
 * locks the swap to the `text-meta` role. No mocking needed: `ChartLegend` is
 * a plain DOM component with no visx/ResizeObserver dependency.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { LocaleProvider } from "@elabs-ai/components-ui";
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

describe("ChartLegend — locale-aware formatting (review: was host-locale-blind)", () => {
  it("formats the default value under the active LocaleProvider locale, not the host locale", () => {
    render(
      <LocaleProvider locale="de-DE">
        <ChartLegend items={[{ color: "var(--chart-1)", label: "Revenue", value: 21200 }]} />
      </LocaleProvider>,
    );
    // de-DE groups thousands with a period, never a comma.
    expect(screen.getByText("21.200")).toBeInTheDocument();
  });

  // RM-109 regression: `valueFormat` unset must still print plain grouped
  // digits, never compact notation — `ChartLegend` briefly regressed to
  // `useChartValueSetFormatter`'s own `"compact"` default ("21.2K"), caught
  // live by a validator, not by the de-DE test above (Intl's de-DE compact
  // and plain-grouped output for 21200 are textually identical — "21.200"
  // either way — so that test could not have caught this). en-US's compact
  // and plain forms visibly diverge ("21.2K" vs "21,200"), which is why this
  // is the regression test, not a duplicate of the de-DE one.
  it("formats an unset valueFormat as plain grouped digits, never compact (en-US)", () => {
    render(<ChartLegend items={[{ color: "var(--chart-1)", label: "Revenue", value: 21200 }]} />);
    expect(screen.getByText("21,200")).toBeInTheDocument();
    expect(screen.queryByText("21.2K")).not.toBeInTheDocument();
  });

  it("still honors an explicit caller-supplied formatValue over the locale default", () => {
    render(
      <ChartLegend
        formatValue={(v) => `$${v}`}
        items={[{ color: "var(--chart-1)", label: "Revenue", value: 42 }]}
      />,
    );
    expect(screen.getByText("$42")).toBeInTheDocument();
  });
});
