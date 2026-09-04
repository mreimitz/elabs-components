/**
 * RingChart smoke test.
 *
 * RingChart relies on @visx/responsive (ParentSize — ResizeObserver),
 * motion/react (animated SVG paths), and @visx/shape arc generators. jsdom
 * lacks ResizeObserver and SVG layout, so we mock @visx/responsive to supply
 * a fixed 280×280 and mock motion/react to render plain DOM elements.
 *
 * Real render fidelity + a11y are covered by the co-located Storybook story
 * (same precedent as @elabs-ai/components-editor's CodeEditor tests and @elabs-ai/components-flow's node
 * tests).
 */

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Must hoist mocks before any imports that transitively use the mocked module.
vi.mock("@visx/responsive", () => ({
  ParentSize: ({
    children,
  }: {
    children: (size: { width: number; height: number }) => React.ReactNode;
  }) => <>{children({ width: 280, height: 280 })}</>,
}));

// The proxy stands in for every `motion.<tag>` and therefore receives arbitrary
// motion props; a named alias keeps the suppression on a stable line (Prettier
// reflows the destructuring pattern below).
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- proxy stand-in receives arbitrary motion props
type MotionProxyProps = any;

// motion/react uses browser animation APIs absent from jsdom — replace with
// plain DOM elements that honour the same props surface Ring relies on.
vi.mock("motion/react", () => ({
  motion: new Proxy(
    {},
    {
      get:
        (_target, tag: string) =>
        ({
          children,
          style,
          animate: _animate,
          transition: _transition,
          onMouseEnter,
          onMouseLeave,
          ...rest
        }: MotionProxyProps) =>
          React.createElement(tag, { style, onMouseEnter, onMouseLeave, ...rest }, children),
    },
  ),
  useTransform: (mv: { get: () => unknown }, fn: (v: unknown) => unknown) => ({
    get: () => fn(mv.get()),
  }),
  useMotionValue: (initial: unknown) => ({ get: () => initial, set: vi.fn() }),
  animate: vi.fn(),
}));

// useEnterComplete + useMountProgress interact with motion internals — stub
// them to immediately signal completion so Ring renders the static path branch.
vi.mock("./use-enter-complete", () => ({
  useEnterComplete: () => true,
}));
vi.mock("./use-mount-progress", () => ({
  useMountProgress: () => ({ get: () => 1 }),
}));

import React from "react";
import { computeRingTickSegments, Ring } from "./ring";
import { RingCenter } from "./ring-center";
import { RingChart } from "./ring-chart";

/** Stub `getComputedStyle` so `--decoration` returns `value` for any element. */
function stubDecoration(value: string) {
  vi.spyOn(window, "getComputedStyle").mockReturnValue({
    getPropertyValue: (prop: string) => (prop === "--decoration" ? value : ""),
  } as unknown as CSSStyleDeclaration);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const sampleData = [
  { label: "Email", value: 42, maxValue: 100 },
  { label: "Social", value: 28, maxValue: 100 },
  { label: "Direct", value: 18, maxValue: 100 },
];

describe("RingChart", () => {
  it("is exported as a function (forwardRef component)", () => {
    expect(typeof RingChart).toBe("object"); // forwardRef returns an object with $$typeof
    expect(RingChart.displayName).toBe("RingChart");
  });

  it("mounts the container div in the document", () => {
    const { container } = render(
      <RingChart data={sampleData} size={280} strokeWidth={14}>
        {sampleData.map((item, i) => (
          <Ring index={i} key={item.label} />
        ))}
      </RingChart>,
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders with responsive sizing (ParentSize path)", () => {
    const { container } = render(
      <RingChart data={sampleData} strokeWidth={14}>
        {sampleData.map((item, i) => (
          <Ring index={i} key={item.label} />
        ))}
      </RingChart>,
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it("forwards a ref to the container div", () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <RingChart data={sampleData} size={280} ref={ref}>
        {sampleData.map((item, i) => (
          <Ring index={i} key={item.label} />
        ))}
      </RingChart>,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it("renders a RingCenter without errors", () => {
    const { getByText } = render(
      <RingChart data={sampleData} size={280}>
        {sampleData.map((item, i) => (
          <Ring index={i} key={item.label} />
        ))}
        <RingCenter defaultLabel="Channels" />
      </RingChart>,
    );
    // RingCenter shows the defaultLabel when nothing is hovered
    expect(getByText("Channels")).toBeInTheDocument();
  });

  it("merges a callback ref correctly", () => {
    let captured: HTMLDivElement | null = null;
    render(
      <RingChart
        data={sampleData}
        size={280}
        ref={(node) => {
          captured = node;
        }}
      >
        {sampleData.map((item, i) => (
          <Ring index={i} key={item.label} />
        ))}
      </RingChart>,
    );
    expect(captured).toBeInstanceOf(HTMLDivElement);
  });

  it("adds role/aria-label/tabIndex when accessibleLabel is provided (fixed size)", () => {
    const { container } = render(
      <RingChart
        data={sampleData}
        size={280}
        accessibleLabel="Channel performance ring chart"
        accessibleDescription="Email 42%, Social 28%, Direct 18%."
      >
        {sampleData.map((item, i) => (
          <Ring index={i} key={item.label} />
        ))}
      </RingChart>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("role")).toBe("figure");
    expect(root.getAttribute("aria-label")).toBe("Channel performance ring chart");
    expect(root.getAttribute("tabindex")).toBe("0");
    const descSpan = root.querySelector("span.sr-only");
    expect(descSpan).toBeInTheDocument();
    expect(descSpan?.textContent).toBe("Email 42%, Social 28%, Direct 18%.");
  });

  it("does NOT add role/aria-label when accessibleLabel is absent", () => {
    const { container } = render(
      <RingChart data={sampleData} size={280}>
        {sampleData.map((item, i) => (
          <Ring index={i} key={item.label} />
        ))}
      </RingChart>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("role")).toBeNull();
    expect(root.getAttribute("aria-label")).toBeNull();
    expect(root.getAttribute("tabindex")).toBeNull();
  });
});

// ── Tick ring at high decoration (#RM-030) ──────────────────────────────────

describe("computeRingTickSegments (pure — tick-count rounding)", () => {
  it("divides 100 ticks proportionally and reports zero remainder when shares round exactly", () => {
    // 42/88, 28/88, 18/88 round to 48/32/20, which already sums to 100.
    const { segments, totalTicks, remainder } = computeRingTickSegments(sampleData, () => "red");
    expect(segments.map((s) => s.tickCount)).toEqual([48, 32, 20]);
    expect(totalTicks).toBe(100);
    expect(remainder).toBe(0);
  });

  it("reports a positive remainder (unassigned ticks) when rounding undershoots 100", () => {
    // Three equal shares of 1/3 each round to 33, summing to 99 — 1 tick unassigned.
    const equalThirds = [
      { label: "A", value: 1, maxValue: 1 },
      { label: "B", value: 1, maxValue: 1 },
      { label: "C", value: 1, maxValue: 1 },
    ];
    const { segments, totalTicks, remainder } = computeRingTickSegments(equalThirds, () => "blue");
    expect(segments.map((s) => s.tickCount)).toEqual([33, 33, 33]);
    expect(totalTicks).toBe(99);
    expect(remainder).toBe(1);
  });

  it("assigns contiguous, non-overlapping tick ranges per segment", () => {
    const { segments } = computeRingTickSegments(sampleData, () => "red");
    expect(segments[0]).toMatchObject({ startTick: 0, endTick: 48 });
    expect(segments[1]).toMatchObject({ startTick: 48, endTick: 80 });
    expect(segments[2]).toMatchObject({ startTick: 80, endTick: 100 });
  });
});

describe("RingChart tick-ring rendering at high decoration (#RM-030)", () => {
  const equalThirds = [
    { label: "A", value: 1, maxValue: 1 },
    { label: "B", value: 1, maxValue: 1 },
    { label: "C", value: 1, maxValue: 1 },
  ];

  it("renders unchanged (no tick group, original smooth Ring arcs) below decoration 8 — default", () => {
    stubDecoration("3");
    const { container } = render(
      <RingChart data={sampleData} size={280} strokeWidth={14}>
        {sampleData.map((item, i) => (
          <Ring index={i} key={item.label} />
        ))}
      </RingChart>,
    );
    expect(container.querySelector("[data-tick-ring]")).toBeNull();
    expect(container.querySelectorAll("svg path").length).toBeGreaterThan(0);
  });

  it("renders unchanged when --decoration is absent (default, unchanged)", () => {
    const { container } = render(
      <RingChart data={sampleData} size={280} strokeWidth={14}>
        {sampleData.map((item, i) => (
          <Ring index={i} key={item.label} />
        ))}
      </RingChart>,
    );
    expect(container.querySelector("[data-tick-ring]")).toBeNull();
    expect(container.querySelectorAll("svg path").length).toBeGreaterThan(0);
  });

  it("renders exactly 100 ticks and REPLACES the smooth Ring arcs at decoration >= 8", () => {
    stubDecoration("10");
    const { container } = render(
      <RingChart data={sampleData} size={280} strokeWidth={14}>
        {sampleData.map((item, i) => (
          <Ring index={i} key={item.label} />
        ))}
      </RingChart>,
    );
    expect(container.querySelectorAll("[data-tick-ring-tick]").length).toBe(100);
    // Old smooth-arc <Ring> children are swapped out in tick mode — no leftover
    // background/progress paths should render alongside the tick group.
    expect(container.querySelectorAll("svg path").length).toBe(0);
  });

  it("gives each segment exactly round(share) ticks, matching the pure helper", () => {
    stubDecoration("10");
    const { container } = render(
      <RingChart data={sampleData} size={280} strokeWidth={14}>
        {sampleData.map((item, i) => (
          <Ring index={i} key={item.label} />
        ))}
      </RingChart>,
    );
    const { segments } = computeRingTickSegments(sampleData, () => "");
    const ticks = container.querySelectorAll("[data-tick-ring-tick]");
    expect(ticks.length).toBe(100);
    for (const segment of segments) {
      expect(segment.tickCount).toBe(segment.endTick - segment.startTick);
    }
    expect(segments.reduce((sum, s) => sum + s.tickCount, 0)).toBeLessThanOrEqual(100);
  });

  it("states the rounding remainder in the caption when shares don't sum exactly to 100", () => {
    stubDecoration("10");
    const { container } = render(
      <RingChart data={equalThirds} size={280} strokeWidth={14}>
        {equalThirds.map((item, i) => (
          <Ring index={i} key={item.label} />
        ))}
      </RingChart>,
    );
    const caption = container.querySelector("[data-tick-ring-caption]");
    expect(caption).toBeInTheDocument();
    expect(caption?.textContent).toBe(
      "100 ticks — segments round to 99 of 100 (1 tick unassigned).",
    );
  });

  it("draws a dot every 10th tick", () => {
    stubDecoration("10");
    const { container } = render(
      <RingChart data={sampleData} size={280} strokeWidth={14}>
        {sampleData.map((item, i) => (
          <Ring index={i} key={item.label} />
        ))}
      </RingChart>,
    );
    expect(container.querySelectorAll("[data-tick-ring-dot]").length).toBe(10);
  });

  it('draws dotted Leader lines to outside labels only when labels="outside"', () => {
    stubDecoration("10");
    const { container: withoutLabels } = render(
      <RingChart data={sampleData} size={280} strokeWidth={14}>
        {sampleData.map((item, i) => (
          <Ring index={i} key={item.label} />
        ))}
      </RingChart>,
    );
    expect(withoutLabels.querySelectorAll("[data-tick-ring-leader]").length).toBe(0);

    const { container: withLabels } = render(
      <RingChart data={sampleData} labels="outside" size={280} strokeWidth={14}>
        {sampleData.map((item, i) => (
          <Ring index={i} key={item.label} />
        ))}
      </RingChart>,
    );
    const leaders = withLabels.querySelectorAll("[data-tick-ring-leader]");
    expect(leaders.length).toBe(sampleData.length);
    expect(withLabels.textContent).toContain("Email 48%");
  });

  it("still renders RingCenter unchanged inside tick mode", () => {
    stubDecoration("10");
    const { getByText } = render(
      <RingChart data={sampleData} size={280} strokeWidth={14}>
        {sampleData.map((item, i) => (
          <Ring index={i} key={item.label} />
        ))}
        <RingCenter defaultLabel="Channels" />
      </RingChart>,
    );
    expect(getByText("Channels")).toBeInTheDocument();
  });
});
