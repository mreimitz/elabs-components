/**
 * Selection input contract (RM-073, #437): the pure resolver, the paint flags,
 * and the BarChart mark rendering — including the byte-identical opt-out.
 */

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@visx/responsive", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory is hoisted; lazy require avoids TDZ
  const React = require("react");
  return {
    ParentSize: ({
      children,
    }: {
      children: (size: { width: number; height: number }) => React.ReactNode;
    }) => React.createElement(React.Fragment, null, children({ width: 560, height: 288 })),
  };
});

import { Bar } from "./bar";
import { BarChart } from "./bar-chart";
import {
  EXCLUDED_MARK_OPACITY,
  markSelectionPaint,
  resolveMarkState,
  type SelectionState,
} from "./chart-selection";

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

afterEach(cleanup);

const data = [
  { region: "EMEA", sales: 12 },
  { region: "APAC", sales: 24 },
  { region: "AMER", sales: 8 },
];

const STATES: Record<string, SelectionState> = {
  EMEA: "selected",
  APAC: "associated",
  AMER: "excluded",
};
const byRegion = (category: string | number | Date) => STATES[String(category)] ?? "associated";

describe("resolveMarkState", () => {
  it("is undefined without a resolver or a category", () => {
    expect(resolveMarkState(undefined, { category: "EMEA" })).toBeUndefined();
    expect(
      resolveMarkState({ selectionStates: byRegion }, { category: undefined }),
    ).toBeUndefined();
  });

  it("passes category, series key and datum to the resolver", () => {
    const resolver = vi.fn(() => "excluded" as const);
    const datum = { region: "EMEA" };
    expect(
      resolveMarkState(
        { selectionStates: resolver },
        { category: "EMEA", datum, seriesKey: "sales" },
      ),
    ).toBe("excluded");
    expect(resolver).toHaveBeenCalledWith("EMEA", "sales", datum);
  });
});

describe("markSelectionPaint", () => {
  it("dims excluded only while dimExcluded is on, outlines selected", () => {
    expect(markSelectionPaint("excluded")).toMatchObject({ dimmed: true, outlined: false });
    expect(markSelectionPaint("excluded", false)).toMatchObject({
      "data-selection": "excluded",
      dimmed: false,
    });
    expect(markSelectionPaint("selected")).toMatchObject({ dimmed: false, outlined: true });
    expect(markSelectionPaint("associated")).toMatchObject({ dimmed: false, outlined: false });
    expect(markSelectionPaint(undefined)["data-selection"]).toBeUndefined();
  });
});

function renderBars(props: Partial<React.ComponentProps<typeof BarChart>> = {}) {
  return render(
    <BarChart animationDuration={0} data={data} xDataKey="region" {...props}>
      <Bar animate={false} dataKey="sales" />
    </BarChart>,
  );
}

describe("BarChart selectionStates", () => {
  it("renders byte-identical DOM when selectionStates is absent", () => {
    // `useId` differs per mount; everything else must match exactly.
    const normalise = (html: string) => html.replace(/_r_[a-z0-9]+_/g, "_r_");
    const plain = normalise(renderBars().container.innerHTML);
    cleanup();
    const withDim = normalise(renderBars({ dimExcluded: true }).container.innerHTML);
    expect(withDim).toBe(plain);
    expect(plain).not.toContain("data-selection");
  });

  it("paints each state with a non-hue channel", () => {
    const { container } = renderBars({ selectionStates: byRegion });
    const selected = container.querySelector('[data-selection="selected"]');
    const associated = container.querySelector('[data-selection="associated"]');
    const excluded = container.querySelector('[data-selection="excluded"]');

    expect(selected?.querySelector('[data-slot="bar-selection-outline"]')).not.toBeNull();
    expect(selected?.getAttribute("opacity")).toBeNull();
    expect(associated?.querySelector('[data-slot^="bar-selection-"]')).toBeNull();
    expect(excluded?.getAttribute("opacity")).toBe(String(EXCLUDED_MARK_OPACITY));
    expect(excluded?.querySelector('[data-slot="bar-selection-hatch"]')).not.toBeNull();
  });

  it("keeps the attribute but paints nothing with dimExcluded={false}", () => {
    const { container } = renderBars({ dimExcluded: false, selectionStates: byRegion });
    const excluded = container.querySelector('[data-selection="excluded"]');
    expect(excluded).not.toBeNull();
    expect(excluded?.getAttribute("opacity")).toBeNull();
    expect(excluded?.querySelector('[data-slot="bar-selection-hatch"]')).toBeNull();
  });
});
