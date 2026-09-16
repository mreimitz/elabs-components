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
import { fireEvent, render } from "@testing-library/react";
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
