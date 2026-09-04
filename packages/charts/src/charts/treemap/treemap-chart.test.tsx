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

import { beforeAll, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type * as MotionReact from "motion/react";
import { TreemapChart, type TreemapNode } from "./treemap-chart";

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

  it("renders no group-zoom controls when drilldown is off (static chart)", () => {
    const { container } = render(
      <div style={{ width: 640, height: 400 }}>
        <TreemapChart data={whereTheWorkWent} />
      </div>,
    );
    expect(container.querySelector('[data-slot="treemap-zoom-layer"]')).toBeNull();
  });
});
