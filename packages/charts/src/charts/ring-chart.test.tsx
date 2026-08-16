/**
 * RingChart smoke test.
 *
 * RingChart relies on @visx/responsive (ParentSize — ResizeObserver),
 * motion/react (animated SVG paths), and @visx/shape arc generators. jsdom
 * lacks ResizeObserver and SVG layout, so we mock @visx/responsive to supply
 * a fixed 280×280 and mock motion/react to render plain DOM elements.
 *
 * Real render fidelity + a11y are covered by the co-located Storybook story
 * (same precedent as @qlik-coe-emea/qlabs-components-editor's CodeEditor tests and @qlik-coe-emea/qlabs-components-flow's node
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
import { Ring } from "./ring";
import { RingCenter } from "./ring-center";
import { RingChart } from "./ring-chart";

afterEach(cleanup);

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
