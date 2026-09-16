/**
 * Selection input contract (RM-073, #437): the pure resolver, the paint flags,
 * and the BarChart mark rendering — including the byte-identical opt-out.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("react-use-measure", () => ({
  default: () => [() => undefined, { width: 560, height: 288 }],
}));

import { Bar } from "./bar";
import { BarChart } from "./bar-chart";
import { SELECTION_FIXTURES } from "./__baselines__/selection-opt-out/fixtures";
import {
  SELECTION_EXCLUDED_OPACITY,
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
  globalThis.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
  // jsdom has no SVG geometry; `<Line>`/`<Area>` measure their path length.
  Object.defineProperty(SVGElement.prototype, "getTotalLength", {
    configurable: true,
    value: () => 100,
  });
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
  it("paints each state with a non-hue channel", () => {
    const { container } = renderBars({ selectionStates: byRegion });
    const selected = container.querySelector('[data-selection="selected"]');
    const associated = container.querySelector('[data-selection="associated"]');
    const excluded = container.querySelector('[data-selection="excluded"]');

    expect(selected?.querySelector('[data-slot="bar-selection-outline"]')).not.toBeNull();
    expect(selected?.getAttribute("opacity")).toBeNull();
    expect(associated?.querySelector('[data-slot^="bar-selection-"]')).toBeNull();
    expect(excluded?.getAttribute("opacity")).toBe(String(SELECTION_EXCLUDED_OPACITY));
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

// ── Every family (RM-073) ────────────────────────────────────────────────────

/**
 * Resolves by category, falling back to the datum's region — Scatter's category
 * is its continuous x (`step`), so it keys on the datum instead.
 */
const byLabel = (
  category: string | number | Date,
  _seriesKey?: string,
  datum?: Record<string, unknown>,
): SelectionState =>
  STATES[String(category)] ??
  (datum?.region === undefined ? undefined : STATES[String(datum.region)]) ??
  "associated";

/** The excluded mark's non-hue channel slot per family. */
const CHANNEL: Record<string, string> = {
  "area-chart": "chart-selection-series-layer-hatch",
  "bar-chart": "bar-selection-hatch",
  "composed-chart": "chart-selection-series-layer-dash",
  "dumbbell-chart": "chart-selection-mark-dash",
  "heatmap-chart": "chart-selection-mark-hatch",
  "line-chart": "chart-selection-series-layer-dash",
  "pie-chart": "chart-selection-mark-hatch",
  "ring-chart": "chart-selection-mark-hatch",
  "scatter-chart": "chart-selection-mark-hollow",
  "treemap-chart": "chart-selection-mark-hatch",
  "unit-chart": "chart-selection-mark-hollow",
};

/** Families whose datapoint layer is exercised for the ", selected" suffix. */
const ANNOUNCED = new Set(["line-chart", "area-chart", "pie-chart", "ring-chart"]);

/**
 * `useId` output (`_r_4_`, React 19) depends on how many components mounted
 * before in the process, so it is the ONE thing normalised; every other byte
 * must match the baseline.
 */
const normaliseIds = (html: string) => html.replace(/_r_[a-z0-9]+_/g, "_r_");

const baseline = (name: string) =>
  readFileSync(join(__dirname, "__baselines__/selection-opt-out", `${name}.baseline.txt`), "utf8");

describe.each(SELECTION_FIXTURES)(
  "$name selectionStates",
  ({ measured, name, render: element }) => {
    beforeEach(() => {
      if (!measured) return;
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
        bottom: 300,
        height: 300,
        left: 0,
        right: 600,
        toJSON: () => ({}),
        top: 0,
        width: 600,
        x: 0,
        y: 0,
      } as DOMRect);
    });
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("renders the pre-RM-073 DOM (baseline generated at 9d119df6) without selectionStates", () => {
      const html = render(element({})).container.innerHTML;
      expect(normaliseIds(`${html}\n`)).toBe(normaliseIds(baseline(name)));
      expect(html).not.toContain("data-selection");
    });

    it("paints the three states apart without hue", () => {
      const { container } = render(element({ selectionStates: byLabel }));
      const excluded = container.querySelectorAll('[data-selection="excluded"]');
      const selected = container.querySelectorAll('[data-selection="selected"]');
      expect(container.querySelector('[data-selection="associated"]')).not.toBeNull();
      expect(excluded.length).toBeGreaterThan(0);
      expect(selected.length).toBeGreaterThan(0);
      for (const node of excluded) {
        const dimmed =
          node.getAttribute("opacity") === String(SELECTION_EXCLUDED_OPACITY) ||
          node.querySelector('[data-slot$="-veil"]') !== null;
        expect(dimmed).toBe(true);
        expect(node.querySelector(`[data-slot="${CHANNEL[name]}"]`)).not.toBeNull();
      }
      for (const node of selected) {
        expect(node.querySelector('[data-slot$="-outline"]')).not.toBeNull();
      }
    });

    it.runIf(ANNOUNCED.has(name))("announces selected and excluded datapoints by name", () => {
      const { container } = render(
        element({ onDatapointClick: () => {}, selectionStates: byLabel }),
      );
      const names = Array.from(container.querySelectorAll("button[aria-label]")).map((b) =>
        b.getAttribute("aria-label"),
      );
      expect(names.some((label) => label?.endsWith(", selected"))).toBe(true);
      expect(names.some((label) => label?.endsWith(", excluded"))).toBe(true);
    });
  },
);
