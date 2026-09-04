/**
 * FunnelChart — jsdom smoke tests
 *
 * FunnelChart uses ResizeObserver + getBoundingClientRect for measurement and
 * motion/react for animation. In jsdom, getBoundingClientRect always returns
 * zero dimensions, so the chart renders its outer container but holds the SVG
 * content behind a `W > 0 && H > 0` guard — nothing is painted. A full render
 * + interaction pass lives in the co-located Storybook story (funnel-chart.stories.tsx),
 * which is exercised by `pnpm --filter @elabs-ai/components-docs test-storybook` in CI.
 *
 * This file therefore: (a) asserts the named export is a React component, and
 * (b) verifies the container mounts without throwing, following the same
 * precedent used for @elabs-ai/components-editor (Monaco) and @elabs-ai/components-flow (React Flow).
 */

import { describe, expect, it, vi, beforeAll } from "vitest";
import { render } from "@testing-library/react";
import type * as MotionReact from "motion/react";
import { FunnelChart } from "./funnel-chart";

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
    // Keep useMotionValue/useTransform but suppress animate side-effects.
    animate: vi.fn(() => ({ stop: vi.fn() })),
  };
});

const sampleData = [
  { label: "Visitors", value: 12000 },
  { label: "Signups", value: 4800 },
  { label: "Activated", value: 2100 },
  { label: "Paid", value: 840 },
];

describe("FunnelChart", () => {
  it("is exported as a function (forwardRef component)", () => {
    expect(typeof FunnelChart).toBe("object"); // forwardRef returns an object with $$typeof
    expect(FunnelChart).toBeTruthy();
  });

  it("mounts without throwing and renders a container element", () => {
    const { container } = render(
      <div style={{ width: 560, height: 288 }}>
        <FunnelChart data={sampleData} />
      </div>,
    );
    // The outer container div is always rendered (guard is on the inner content).
    const chartRoot = container.querySelector(".relative.w-full.select-none");
    expect(chartRoot).toBeInTheDocument();
  });

  it("returns null for empty data without throwing", () => {
    const { container } = render(<FunnelChart data={[]} />);
    // Empty data → component returns null → nothing rendered inside.
    expect(container.firstChild).toBeNull();
  });

  it("accepts a forwarded ref", () => {
    const ref = { current: null as HTMLDivElement | null };
    render(
      <div style={{ width: 560, height: 288 }}>
        <FunnelChart data={sampleData} ref={ref} />
      </div>,
    );
    // jsdom doesn't call ResizeObserver callbacks, but the ref should still be
    // populated with the container div.
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it("adds role/aria-label/tabIndex when accessibleLabel is provided", () => {
    const { container } = render(
      <div style={{ width: 560, height: 288 }}>
        <FunnelChart
          data={sampleData}
          accessibleLabel="Sales funnel chart"
          accessibleDescription="Visitors 12,000 → Signups 4,800 → Activated 2,100 → Paid 840."
        />
      </div>,
    );
    const chartRoot = container.querySelector(".relative.w-full.select-none") as HTMLElement;
    expect(chartRoot.getAttribute("role")).toBe("figure");
    expect(chartRoot.getAttribute("aria-label")).toBe("Sales funnel chart");
    expect(chartRoot.getAttribute("tabindex")).toBe("0");
    const descSpan = chartRoot.querySelector("span.sr-only");
    expect(descSpan).toBeInTheDocument();
  });

  it("does NOT add role/aria-label when accessibleLabel is absent", () => {
    const { container } = render(
      <div style={{ width: 560, height: 288 }}>
        <FunnelChart data={sampleData} />
      </div>,
    );
    const chartRoot = container.querySelector(".relative.w-full.select-none") as HTMLElement;
    expect(chartRoot.getAttribute("role")).toBeNull();
    expect(chartRoot.getAttribute("aria-label")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// showConversion (RM-032) — full render, real getBoundingClientRect so the
// `W > 0 && H > 0` guard opens and the conversion layer + label overlays paint.
// ---------------------------------------------------------------------------
describe("FunnelChart showConversion", () => {
  function stubMeasurement() {
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
  }

  it("renders no conversion HaloText when unset (default) — unaffected", () => {
    stubMeasurement();
    const { container } = render(<FunnelChart data={sampleData} />);
    expect(container.querySelectorAll('[data-slot="halo-text"]')).toHaveLength(0);
  });

  it('"between" renders one HaloText per boundary, reconciling with the stage values', () => {
    stubMeasurement();
    const { container } = render(<FunnelChart data={sampleData} showConversion="between" />);
    const labels = container.querySelectorAll('[data-slot="halo-text"]');
    // 4 stages → 3 boundaries.
    expect(labels).toHaveLength(3);
    // 4800/12000=40%, 2100/4800=44%(rounded), 840/2100=40%.
    expect(Array.from(labels).map((el) => el.textContent)).toEqual(["40%", "44%", "40%"]);
  });

  it('"margin" also renders one HaloText per boundary, same reconciled values', () => {
    stubMeasurement();
    const { container } = render(<FunnelChart data={sampleData} showConversion="margin" />);
    const labels = container.querySelectorAll('[data-slot="halo-text"]');
    expect(labels).toHaveLength(3);
    expect(Array.from(labels).map((el) => el.textContent)).toEqual(["40%", "44%", "40%"]);
  });

  it("adds a native title tooltip with 'of previous stage' / 'of first stage' when set", () => {
    stubMeasurement();
    const { container } = render(<FunnelChart data={sampleData} showConversion="between" />);
    const overlays = container.querySelectorAll(".absolute.cursor-pointer");
    expect(overlays).toHaveLength(4);
    // Stage 0 has no previous stage — no title.
    expect(overlays[0]?.getAttribute("title")).toBeNull();
    // Stage 1: 4800/12000 of previous = 40%, 4800/12000 of first = 40%.
    expect(overlays[1]?.getAttribute("title")).toBe("40% of previous stage · 40% of first stage");
    // Stage 2: 2100/4800 of previous = 44%(rounded), 2100/12000 of first = 18%(rounded).
    expect(overlays[2]?.getAttribute("title")).toBe("44% of previous stage · 18% of first stage");
  });

  it("does NOT add a title tooltip when showConversion is unset (default, unaffected)", () => {
    stubMeasurement();
    const { container } = render(<FunnelChart data={sampleData} />);
    const overlays = container.querySelectorAll(".absolute.cursor-pointer");
    for (const overlay of overlays) {
      expect(overlay.getAttribute("title")).toBeNull();
    }
  });
});
