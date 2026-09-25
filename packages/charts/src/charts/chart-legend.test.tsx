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
import userEvent from "@testing-library/user-event";
import { LocaleProvider } from "@elabs-ai/components-ui";
import { afterEach, describe, expect, it, vi } from "vitest";
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

describe("ChartLegend — layout prop (RM-118, sitting 3 bug fix)", () => {
  const twoItems: LegendItem[] = [
    { color: "var(--chart-1)", label: "Revenue", value: 100, key: "revenue" },
    { color: "var(--chart-2)", label: "Cost", value: 50, key: "cost" },
  ];

  it("defaults to stack — byte-identical to every caller before `layout` existed", () => {
    const { container } = render(<ChartLegend items={twoItems} />);
    const root = container.querySelector(".legend-container");
    expect(root?.className).toContain("flex-col");
    expect(root?.className).not.toContain("flex-row");
  });

  it('layout="row" wraps items left-to-right instead of stacking them', () => {
    const { container } = render(<ChartLegend items={twoItems} layout="row" />);
    const root = container.querySelector(".legend-container");
    expect(root?.className).toContain("flex-row");
    expect(root?.className).toContain("flex-wrap");
    expect(root?.className).not.toContain("flex-col");
  });

  it('layout="row" drops the w-full an interactive item otherwise gets, so items can sit side by side', () => {
    const { container } = render(
      <ChartLegend hiddenKeys={new Set()} items={twoItems} layout="row" onToggleKey={() => {}} />,
    );
    const buttons = container.querySelectorAll(".legend-container button");
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button.className).not.toContain("w-full");
    }
  });

  it('layout="stack" (default) keeps w-full on an interactive item', () => {
    const { container } = render(
      <ChartLegend hiddenKeys={new Set()} items={twoItems} onToggleKey={() => {}} />,
    );
    const button = container.querySelector(".legend-container button");
    expect(button?.className).toContain("w-full");
  });
});

describe("ChartLegend — export role (RM-127)", () => {
  it("names its root so the export layer roles its text as a legend, not a plain label", () => {
    // `measureChartExportLayer` (chart-frame/export-layer.tsx) walks up from a
    // text run to the nearest `data-slot` and maps a slot CONTAINING "legend"
    // to the `legend` role. A bare `<ChartLegend>` composed into a `ChartFrame`
    // used to have no slot at all, so its labels exported as plain chart labels
    // while the identical `useContainerLegend` legend exported correctly.
    const { container } = render(
      <LocaleProvider>
        <ChartLegend items={items} />
      </LocaleProvider>,
    );
    const root = container.querySelector<HTMLElement>("[data-slot='chart-legend']");
    expect(root).not.toBeNull();
    expect(root).toHaveClass("legend-container");
    // The label really does sit inside that slot — the walk finds it.
    expect(screen.getByText("Revenue").closest("[data-slot='chart-legend']")).toBe(root);
  });
});

describe("ChartLegend — hover-only keyboard path (#607)", () => {
  // Pie/Scatter/Treemap/Dumbbell (`useContainerLegend` capped at
  // `maxInteractive: "hover"`) pass `onHover` but never `onItemClick` or
  // `onToggleKey` — the exact shape that used to render an unfocusable
  // `<div>` with dead `onFocus`/`onBlur` handlers.
  const hoverOnlyItems: LegendItem[] = [
    { color: "var(--chart-1)", label: "Revenue", value: 100, key: "revenue" },
    { color: "var(--chart-2)", label: "Cost", value: 50, key: "cost" },
  ];

  it("renders a hover-only item as a real, focusable <button>, in tab order", () => {
    const { container } = render(<ChartLegend items={hoverOnlyItems} onHover={() => {}} />);
    const legendItems = container.querySelectorAll(".legend-container > *");
    expect(legendItems).toHaveLength(2);
    for (const el of legendItems) {
      expect(el.tagName).toBe("BUTTON");
      // A native <button> is keyboard-reachable with no explicit tabIndex —
      // and this is deliberately NOT a toggle (#607 "without making them
      // toggles"): no aria-pressed, no click wiring.
      expect(el).not.toHaveAttribute("aria-pressed");
    }
  });

  it("Tab reaches a hover-only legend item and focusing it fires the same onHover the mouse uses", async () => {
    const user = userEvent.setup();
    const onHover = vi.fn();
    render(<ChartLegend items={hoverOnlyItems} onHover={onHover} />);

    const revenueItem = screen.getByText("Revenue").closest("button");
    expect(revenueItem).not.toBeNull();

    await user.tab();
    expect(document.activeElement).toBe(revenueItem);
    // Same call `onMouseEnter` makes for this item (index 0) — focus drives
    // the identical highlight state hovering does.
    expect(onHover).toHaveBeenCalledWith(0);

    await user.tab();
    // Leaving the item blurs it, clearing the highlight — matching `onMouseLeave`.
    expect(onHover).toHaveBeenCalledWith(null);
  });

  it("stays a plain, non-focusable <div> when there is no onHover at all (nothing to highlight)", () => {
    const { container } = render(<ChartLegend items={hoverOnlyItems} />);
    const legendItems = container.querySelectorAll(".legend-container > *");
    for (const el of legendItems) {
      expect(el.tagName).toBe("DIV");
    }
  });
});

// F09 (RM-163): `NaN` is the "no value" sentinel a container legend passes.
// No variant turns it into a printed number, a NaN width or a made-up 0 %.
describe("ChartLegend — an item with no value (NaN)", () => {
  const noValue: LegendItem[] = [
    { color: "var(--chart-1)", label: "Revenue", value: 21200, maxValue: 25000 },
    { color: "var(--chart-2)", label: "Trend", value: Number.NaN, maxValue: 25000 },
  ];

  it("progress variant: no value, percentage, NaN width or aria-valuenow", () => {
    const { container } = render(<ChartLegend items={noValue} showProgress />);
    const bars = container.querySelectorAll('[role="progressbar"]');
    expect(bars).toHaveLength(2);
    const trend = bars[1]!;
    expect(trend.hasAttribute("aria-valuenow")).toBe(false);
    expect(trend.textContent).toBe("Trend");
    expect(trend.querySelector<HTMLElement>(".bg-legend-track > div")?.style.width).toBe("0%");
    expect(container.textContent).not.toContain("NaN");
  });

  it("hands renderItem a 0 percentage for it", () => {
    const seen: number[] = [];
    render(
      <ChartLegend
        items={noValue}
        renderItem={({ item, percentage }) => {
          seen.push(percentage);
          return item.label;
        }}
      />,
    );
    expect(seen).toEqual([84.8, 0]);
  });
});
