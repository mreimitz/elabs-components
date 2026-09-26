/**
 * TreemapChart — jsdom smoke tests
 *
 * TreemapChart uses ResizeObserver + getBoundingClientRect for measurement and
 * motion/react for animation. In jsdom, getBoundingClientRect always returns
 * zero dimensions, so the chart renders its outer container but holds the SVG
 * content behind a `w > 0 && h > 0` guard — nothing is painted. The real
 * layout math is unit-tested directly against `computeTreemapLayout` in
 * `treemap-layout.test.ts` (jsdom-free, real width/height). A full render +
 * interaction pass lives in the co-located Storybook story
 * (treemap-chart.stories.tsx), exercised by
 * `pnpm --filter @elabs-ai/components-docs test-storybook` in CI.
 *
 * This file therefore: (a) asserts the named export is a React component, and
 * (b) verifies the container mounts without throwing — including the dev-only
 * `validateTreemapData` throw path — following the same precedent used by
 * `funnel-chart.test.tsx`.
 */

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type * as MotionReact from "motion/react";
import { TreemapChart, type TreemapNode } from "./treemap-chart";
import { seriesPatternFills, seriesPatterns, stubHighDecoration } from "../high-decoration-fixture";

// Provide a ResizeObserver stub so the effect does not throw in jsdom.
beforeAll(() => {
  if (typeof window !== "undefined" && !window.ResizeObserver) {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

// Silence motion/react animation warnings in jsdom (no requestAnimationFrame).
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof MotionReact>();
  return {
    ...actual,
    animate: vi.fn(() => ({ stop: vi.fn() })),
  };
});

const whereTheWorkWent: TreemapNode = {
  name: "Work",
  children: [
    {
      name: "Platform",
      children: [
        { name: "CI", value: 40 },
        { name: "Infra", value: 30 },
        { name: "Release", value: 10 },
      ],
    },
    {
      name: "Product",
      children: [
        { name: "Onboarding", value: 25 },
        { name: "Billing", value: 15 },
        { name: "Search", value: 5 },
      ],
    },
  ],
};

describe("TreemapChart", () => {
  it("is exported as a function (forwardRef component)", () => {
    expect(typeof TreemapChart).toBe("object"); // forwardRef returns an object with $$typeof
    expect(TreemapChart).toBeTruthy();
  });

  it("mounts without throwing and renders the root data-slot", () => {
    const { container } = render(
      <div style={{ width: 640, height: 400 }}>
        <TreemapChart data={whereTheWorkWent} />
      </div>,
    );
    const chartRoot = container.querySelector('[data-slot="treemap-chart"]');
    expect(chartRoot).toBeInTheDocument();
  });

  it("accepts a forwarded ref", () => {
    const ref = { current: null as HTMLDivElement | null };
    render(
      <div style={{ width: 640, height: 400 }}>
        <TreemapChart data={whereTheWorkWent} ref={ref} />
      </div>,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it("adds role/aria-label/tabIndex when accessibleLabel is provided", () => {
    const { container } = render(
      <div style={{ width: 640, height: 400 }}>
        <TreemapChart
          accessibleDescription="Work is split across Platform and Product."
          accessibleLabel="Where the work went"
          data={whereTheWorkWent}
        />
      </div>,
    );
    const chartRoot = container.querySelector('[data-slot="treemap-chart"]') as HTMLElement;
    expect(chartRoot.getAttribute("role")).toBe("figure");
    expect(chartRoot.getAttribute("aria-label")).toBe("Where the work went");
    expect(chartRoot.getAttribute("tabindex")).toBe("0");
  });

  it("does NOT add role/aria-label when accessibleLabel is absent", () => {
    const { container } = render(
      <div style={{ width: 640, height: 400 }}>
        <TreemapChart data={whereTheWorkWent} />
      </div>,
    );
    const chartRoot = container.querySelector('[data-slot="treemap-chart"]') as HTMLElement;
    expect(chartRoot.getAttribute("role")).toBeNull();
    expect(chartRoot.getAttribute("aria-label")).toBeNull();
  });

  it("throws (dev-only) when a parent's explicit value does not equal the sum of its children", () => {
    const bad: TreemapNode = {
      name: "root",
      value: 999,
      children: [
        { name: "a", value: 10 },
        { name: "b", value: 20 },
      ],
    };
    expect(() =>
      render(
        <div style={{ width: 640, height: 400 }}>
          <TreemapChart data={bad} />
        </div>,
      ),
    ).toThrow(/value 999, but its children sum to 30/);
  });

  it("ellipsises a leaf label that is wider than its tile, never letting it clip", () => {
    const spy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 320,
      height: 320,
      left: 0,
      right: 560,
      toJSON: () => ({}),
      top: 0,
      width: 560,
      x: 0,
      y: 0,
    } as DOMRect);
    const { container } = render(
      <TreemapChart
        data={{
          name: "Work",
          children: [
            { name: "Wide", value: 90 },
            { name: "Considerably long name", value: 10 },
          ],
        }}
        depth={1}
        labelMinArea={0}
      />,
    );
    spy.mockRestore();
    const labels = Array.from(
      container.querySelectorAll('[data-slot="treemap-leaf-label"]'),
      (el) => el.textContent ?? "",
    );
    expect(labels).toContain("Wide");
    // The 10% sliver (~56px) cannot hold the full name — it is shortened, not clipped.
    const long = labels.find((text) => text.startsWith("Con"));
    expect(long?.endsWith("…")).toBe(true);
  });

  it("renders no group-zoom controls when drilldown is off (static chart)", () => {
    const { container } = render(
      <div style={{ width: 640, height: 400 }}>
        <TreemapChart data={whereTheWorkWent} />
      </div>,
    );
    expect(container.querySelector('[data-slot="treemap-zoom-layer"]')).toBeNull();
  });

  it("the Other tile's tooltip reports how many categories it folded (#247)", () => {
    const spy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 400,
      height: 400,
      left: 0,
      right: 640,
      toJSON: () => ({}),
      top: 0,
      width: 640,
      x: 0,
      y: 0,
    } as DOMRect);
    const { container } = render(
      <TreemapChart
        data={{
          name: "root",
          children: [
            {
              name: "Group",
              children: [
                { name: "Big", value: 90 },
                { name: "Tiny A", value: 1 },
                { name: "Tiny B", value: 1 },
                { name: "Tiny C", value: 1 },
              ],
            },
          ],
        }}
        otherThreshold={0.05}
      />,
    );
    const otherLeaf = Array.from(container.querySelectorAll("[data-treemap-leaf-id]")).find((el) =>
      el.getAttribute("data-treemap-leaf-id")?.startsWith("leaf:0:1"),
    ) as SVGRectElement | undefined;
    expect(otherLeaf).toBeDefined();
    fireEvent.mouseEnter(otherLeaf as SVGRectElement);
    expect(container.textContent ?? "").toContain("3 categories");
    spy.mockRestore();
  });

  describe("showValues (#247)", () => {
    const mockBox = (width: number, height: number) =>
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
        bottom: height,
        height,
        left: 0,
        right: width,
        toJSON: () => ({}),
        top: 0,
        width,
        x: 0,
        y: 0,
      } as DOMRect);

    const twoTiles: TreemapNode = {
      name: "Spend",
      children: [
        { name: "Cloud", value: 1500 },
        { name: "Tools", value: 400 },
      ],
    };

    const valueTexts = (container: HTMLElement) =>
      Array.from(
        container.querySelectorAll('[data-slot="treemap-leaf-value"]'),
        (el) => el.textContent ?? "",
      );

    it("prints no value by default", () => {
      const spy = mockBox(640, 400);
      const { container } = render(<TreemapChart data={twoTiles} depth={1} labelMinArea={0} />);
      spy.mockRestore();
      expect(container.querySelectorAll('[data-slot="treemap-leaf-label"]').length).toBe(2);
      expect(valueTexts(container)).toEqual([]);
    });

    it("prints each labelled tile's value under its name, in one notation for the set", () => {
      const spy = mockBox(640, 400);
      const { container } = render(
        <TreemapChart data={twoTiles} depth={1} labelMinArea={0} showValues />,
      );
      spy.mockRestore();
      // 400 would not compact on its own, so neither does 1500 — never "1.5K" beside "400".
      expect(valueTexts(container)).toEqual(["1,500", "400"]);
      const name = container.querySelector('[data-slot="treemap-leaf-label"]') as SVGTextElement;
      const value = container.querySelector('[data-slot="treemap-leaf-value"]') as SVGTextElement;
      expect(Number(value.getAttribute("y"))).toBeGreaterThan(Number(name.getAttribute("y")));
    });

    it("compacts the whole set when every value would compact", () => {
      const spy = mockBox(640, 400);
      const { container } = render(
        <TreemapChart
          data={{
            name: "Spend",
            children: [
              { name: "Cloud", value: 15000 },
              { name: "Tools", value: 4000 },
            ],
          }}
          depth={1}
          labelMinArea={0}
          showValues
        />,
      );
      spy.mockRestore();
      expect(valueTexts(container)).toEqual(["15K", "4K"]);
    });

    it("a tile too short for two lines keeps its name and drops the value", () => {
      const spy = mockBox(640, 30);
      const { container } = render(
        <TreemapChart data={twoTiles} depth={1} labelMinArea={0} showValues />,
      );
      spy.mockRestore();
      expect(container.querySelectorAll('[data-slot="treemap-leaf-label"]').length).toBe(2);
      expect(valueTexts(container)).toEqual([]);
    });

    it("never prints a value on a tile whose name is hidden", () => {
      const spy = mockBox(640, 400);
      const { container } = render(
        <TreemapChart data={twoTiles} depth={1} labelMinArea={10_000_000} showValues />,
      );
      spy.mockRestore();
      expect(container.querySelector('[data-slot="treemap-leaf-label"]')).toBeNull();
      expect(valueTexts(container)).toEqual([]);
    });
  });

  describe('labelOverflow="hide" (#280)', () => {
    const mockBox = (width: number, height: number) =>
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
        bottom: height,
        height,
        left: 0,
        right: width,
        toJSON: () => ({}),
        top: 0,
        width,
        x: 0,
        y: 0,
      } as DOMRect);

    const oneWideOneNarrow: TreemapNode = {
      name: "Work",
      children: [
        { name: "Wide", value: 90 },
        { name: "Considerably long name", value: 10 },
      ],
    };

    it("drops a name too long for its tile instead of ellipsising it", () => {
      const spy = mockBox(560, 320);
      const { container } = render(
        <TreemapChart data={oneWideOneNarrow} depth={1} labelMinArea={0} labelOverflow="hide" />,
      );
      spy.mockRestore();
      const labels = Array.from(
        container.querySelectorAll('[data-slot="treemap-leaf-label"]'),
        (el) => el.textContent ?? "",
      );
      expect(labels).toContain("Wide");
      expect(labels.some((text) => text.includes("…"))).toBe(false);
      expect(labels.some((text) => text.startsWith("Considerably"))).toBe(false);
    });

    it("drops the name too when its value does not fit, so the tile never carries a name with no fact", () => {
      const spy = mockBox(640, 400);
      const { container } = render(
        <TreemapChart
          data={{
            name: "Spend",
            children: [
              { name: "Cloud", value: 1_500_000 },
              { name: "A very long category name indeed", value: 400 },
            ],
          }}
          depth={1}
          labelMinArea={0}
          labelOverflow="hide"
          showValues
        />,
      );
      spy.mockRestore();
      const labels = Array.from(
        container.querySelectorAll('[data-slot="treemap-leaf-label"]'),
        (el) => el.textContent ?? "",
      );
      // The narrow tile's name would fit alone, but its value would not — "whole
      // fact or nothing" means both drop together, never a name with no value.
      expect(labels).toEqual(["Cloud"]);
    });
  });

  it("hideLeafLabel skips the native label for a matched leaf only", () => {
    const spy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 400,
      height: 400,
      left: 0,
      right: 640,
      toJSON: () => ({}),
      top: 0,
      width: 640,
      x: 0,
      y: 0,
    } as DOMRect);
    const { container } = render(
      <TreemapChart
        data={{
          name: "Spend",
          children: [
            { name: "Cloud", value: 300 },
            { name: "Tools", value: 100 },
          ],
        }}
        depth={1}
        hideLeafLabel={(leaf) => leaf.name === "Cloud"}
        labelMinArea={0}
      />,
    );
    spy.mockRestore();
    const labels = Array.from(
      container.querySelectorAll('[data-slot="treemap-leaf-label"]'),
      (el) => el.textContent ?? "",
    );
    expect(labels).toEqual(["Tools"]);
  });

  it("monoLeafColor/monoBandColor override the shared mono shade, everything else default", () => {
    const spy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 400,
      height: 400,
      left: 0,
      right: 640,
      toJSON: () => ({}),
      top: 0,
      width: 640,
      x: 0,
      y: 0,
    } as DOMRect);
    const { container } = render(
      <TreemapChart
        data={whereTheWorkWent}
        monoBandColor="var(--chart-mono-2)"
        monoLeafColor="var(--chart-mono-2)"
      />,
    );
    spy.mockRestore();
    const leaf = container.querySelector("[data-treemap-leaf-id]") as SVGRectElement;
    const band = container.querySelector('[data-slot="treemap-group"] rect') as SVGRectElement;
    expect(leaf.getAttribute("fill")).toBe("var(--chart-mono-2)");
    expect(band.getAttribute("fill")).toBe("var(--chart-mono-2)");
  });
});

describe("TreemapChart decoration pattern channel (ADR 0011, #257)", () => {
  afterEach(() => vi.restoreAllMocks());

  function renderSized(palette: "mono" | "categorical") {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 400,
      height: 400,
      left: 0,
      right: 640,
      toJSON: () => ({}),
      top: 0,
      width: 640,
      x: 0,
      y: 0,
    } as DOMRect);
    return render(<TreemapChart data={whereTheWorkWent} palette={palette} />);
  }

  it("textures leaves by group colour at high decoration, keeping title bands flat", () => {
    stubHighDecoration();
    const { container } = renderSized("categorical");
    const ids = seriesPatterns(container).map((pattern) => pattern.id);
    expect(ids).toHaveLength(2);
    const leafFills = seriesPatternFills(container, "[data-treemap-leaf-id]");
    expect(leafFills).toHaveLength(6);
    expect(new Set(leafFills.map((leaf) => leaf.getAttribute("fill")))).toEqual(
      new Set(ids.map((id) => `url(#${id})`)),
    );
    expect(seriesPatternFills(container, '[data-slot="treemap-group"] rect')).toHaveLength(0);
  });

  it("paints no pattern at low decoration", () => {
    const { container } = renderSized("categorical");
    expect(seriesPatterns(container)).toHaveLength(0);
  });
});

// Legend engine (RM-118): `legend` prop → `useContainerLegend` (palette
// "categorical") or `RampLegend` (palette "sequential"). Uses the same
// `getBoundingClientRect` stub as the decoration-pattern suite above so the
// layout actually computes real groups/leaves in jsdom.
describe("TreemapChart legend (RM-118)", () => {
  afterEach(() => vi.restoreAllMocks());

  function renderSized(props: Partial<React.ComponentProps<typeof TreemapChart>> = {}) {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 400,
      height: 400,
      left: 0,
      right: 640,
      toJSON: () => ({}),
      top: 0,
      width: 640,
      x: 0,
      y: 0,
    } as DOMRect);
    return render(<TreemapChart data={whereTheWorkWent} {...props} />);
  }

  it("an unset legend renders no legend, even with palette='categorical' (R1 default)", () => {
    const { container } = renderSized({ palette: "categorical" });
    expect(container.querySelector('[data-slot="container-legend-root"]')).toBeNull();
  });

  it("legend + palette='categorical' lists one row per top-level group, as plain rows (no toggle, R3)", () => {
    const { container } = renderSized({ legend: true, palette: "categorical" });
    const legend = container.querySelector(".legend-container");
    expect(legend?.textContent).toContain("Platform");
    expect(legend?.textContent).toContain("Product");
    // No TOGGLE affordance in this family (R3) — no `aria-pressed` button.
    // #607: the rows ARE real `<button>`s now (keyboard path to the hover
    // highlight), just not toggles.
    expect(container.querySelectorAll(".legend-container button[aria-pressed]")).toHaveLength(0);
  });

  it('an interactive: "toggle" request downgrades to hover — no aria-pressed buttons (no per-group hide)', () => {
    const { container } = renderSized({
      legend: { interactive: "toggle" },
      palette: "categorical",
    });
    expect(container.querySelector('[data-slot="container-legend-root"]')).not.toBeNull();
    expect(container.querySelectorAll(".legend-container button[aria-pressed]")).toHaveLength(0);
  });

  it("hovering a legend row dims every OTHER group's tiles, never the hovered one", () => {
    const { container } = renderSized({ legend: true, palette: "categorical" });
    // #607: hover-only rows are real focusable `<button>`s, not `<div>`s.
    const rows = container.querySelectorAll(".legend-container > button");
    expect(rows).toHaveLength(2);

    fireEvent.mouseEnter(rows[0] as Element);
    const groups = container.querySelectorAll('[data-slot="treemap-group"]');
    // The hovered group's own `<g>` gets no `opacity` attribute at all — only a
    // DIMMED one ever carries one, keeping the DOM byte-identical to before
    // RM-118 wherever nothing is dimmed.
    expect(groups[0]?.getAttribute("opacity")).toBeNull();
    expect(groups[1]?.getAttribute("opacity")).toBe("0.35");
    const leaves = container.querySelectorAll('[data-slot="treemap-leaf"]');
    expect(leaves.length).toBeGreaterThan(0);
    for (const leaf of leaves) {
      expect([null, "0.35"]).toContain(leaf.getAttribute("opacity"));
    }

    fireEvent.mouseLeave(rows[0] as Element);
    expect(groups[1]?.getAttribute("opacity")).toBeNull();
  });

  it("palette='sequential' renders RampLegend instead of the discrete container legend", () => {
    const { container } = renderSized({ legend: true, palette: "sequential" });
    expect(container.querySelector('[data-slot="ramp-legend"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="container-legend-root"]')).toBeNull();
  });

  it("palette='mono' (default) renders no legend at all — nothing to key", () => {
    const { container } = renderSized({ legend: true });
    expect(container.querySelector('[data-slot="container-legend-root"]')).toBeNull();
    expect(container.querySelector('[data-slot="ramp-legend"]')).toBeNull();
  });
});

// RM-184 — `useResolvedChartProps` + `chartStateGroup` adoption.
describe("TreemapChart — status and empty (RM-184)", () => {
  afterEach(() => vi.restoreAllMocks());

  function stubMeasuredSize() {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 400,
      height: 400,
      left: 0,
      right: 640,
      toJSON: () => ({}),
      top: 0,
      width: 640,
      x: 0,
      y: 0,
    } as DOMRect);
  }

  it("shows the loading skeleton when status is loading", () => {
    stubMeasuredSize();
    render(<TreemapChart data={whereTheWorkWent} status="loading" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows the empty state when there are no leaves and status is not loading", () => {
    stubMeasuredSize();
    render(<TreemapChart data={{ name: "Root", value: 0 }} />);
    const empty = screen.getByRole("status");
    expect(empty).toHaveAttribute("data-slot", "treemap-chart-empty");
  });

  // Wave-3 review F1: emptiness is a fact about the DATA, never about the measured layout. At
  // the default `depth: 2` a one-level hierarchy has no grandchildren, so the layout emits no
  // `leaves` — only two groups — yet it is plainly not empty (the defaults-golden fixture).
  it("draws a flat two-leaf hierarchy at the default depth as two tiles, never the empty panel", () => {
    stubMeasuredSize();
    const { container } = render(
      <TreemapChart
        data={{
          name: "Root",
          children: [
            { name: "A", value: 40 },
            { name: "B", value: 60 },
          ],
        }}
      />,
    );
    expect(container.querySelector('[data-slot="treemap-chart-empty"]')).toBeNull();
    expect(container.querySelectorAll('[data-slot="treemap-group"]')).toHaveLength(2);
  });

  it("an empty hierarchy (`children: []`) shows the empty panel, with no dev error", () => {
    stubMeasuredSize();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<TreemapChart data={{ name: "Root", children: [] }} />);
    expect(screen.getByRole("status")).toHaveAttribute("data-slot", "treemap-chart-empty");
    expect(errors).not.toHaveBeenCalled();
  });

  it("is empty before the first measurement too, when the data has nothing to plot", () => {
    // No size stub: jsdom measures 0 × 0, so the layout is still empty — the verdict is the data's.
    const { container } = render(
      <TreemapChart data={{ name: "Root", children: [{ name: "A", value: 0 }] }} />,
    );
    expect(container.querySelector('[data-slot="treemap-chart-empty"]')).not.toBeNull();
  });

  it("is NOT empty before the first measurement when the data has a positive leaf", () => {
    const { container } = render(<TreemapChart data={whereTheWorkWent} />);
    expect(container.querySelector('[data-slot="treemap-chart-empty"]')).toBeNull();
  });
});
