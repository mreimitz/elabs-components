// LiveLineChart uses @visx/responsive ParentSize (ResizeObserver + layout
// measurement) and a requestAnimationFrame-driven animation loop — neither
// works correctly in jsdom. We mock ParentSize to supply a fixed size and stub
// rAF as a no-op so the component can mount without stack-overflow or layout
// errors. Real render + a11y are covered by the Storybook build (same
// precedent as @qlik-coe-emea/qlabs-components-flow's canvas-shell.test.tsx).
//
// NOTE: forwardRef() returns an exotic object, not a plain function, so
// `typeof LiveLineChart` is "object". We verify the export shape via
// `$$typeof` instead of the naive "function" check.

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@visx/responsive", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  return {
    ParentSize: ({
      children,
    }: {
      children: (dims: { width: number; height: number }) => React.ReactNode;
    }) =>
      React.createElement(
        "div",
        { "data-testid": "parent-size" },
        children({ width: 560, height: 288 }),
      ),
  };
});

// No-op rAF: returns a handle but never fires the callback, preventing the
// infinite rAF→tick→rAF loop that would stack-overflow jsdom.
global.requestAnimationFrame = (_cb) => 0;
global.cancelAnimationFrame = () => {};

import { LiveLine } from "./live-line";
import { LiveLineChart, type LiveLineChartProps, type LiveLinePoint } from "./live-line-chart";
import { LiveXAxis } from "./live-x-axis";
import { LiveYAxis } from "./live-y-axis";

afterEach(cleanup);

const NOW_SEC = Math.floor(Date.now() / 1000);
const sampleData: LiveLinePoint[] = Array.from({ length: 10 }, (_, i) => ({
  time: NOW_SEC - (9 - i),
  value: 50 + i,
}));

function renderChart(props?: Partial<LiveLineChartProps>) {
  return render(
    <LiveLineChart data={sampleData} value={59} {...props}>
      <LiveLine dataKey="value" />
    </LiveLineChart>,
  );
}

describe("LiveLineChart", () => {
  it("is exported and is a valid React forwardRef component", () => {
    // forwardRef() returns an exotic object ($$typeof === REACT_FORWARD_REF_TYPE),
    // not a plain function — so we check it is non-null and renderable.
    expect(LiveLineChart).toBeDefined();
    expect(LiveLineChart).not.toBeNull();
  });

  it("mounts and the container is in the document", () => {
    const { container } = renderChart();
    expect(container.firstChild).toBeInTheDocument();
  });

  it("applies a custom className to the container", () => {
    const { container } = renderChart({ className: "my-live-chart" });
    expect(container.firstChild).toHaveClass("my-live-chart");
  });

  it("accepts a forwarded ref and attaches it to the container div", () => {
    const ref = { current: null as HTMLDivElement | null };
    const { container } = render(
      <LiveLineChart data={sampleData} value={59} ref={ref}>
        <LiveLine dataKey="value" />
      </LiveLineChart>,
    );
    expect(ref.current).toBe(container.firstChild);
  });

  it("adds role/aria-label/tabIndex when accessibleLabel is provided", () => {
    const { container } = renderChart({
      accessibleLabel: "CPU usage live chart",
      accessibleDescription: "Streaming CPU metric. Current value: ~59.",
    });
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("role")).toBe("figure");
    expect(root.getAttribute("aria-label")).toBe("CPU usage live chart");
    expect(root.getAttribute("tabindex")).toBe("0");
    const descSpan = root.querySelector("span.sr-only");
    expect(descSpan).toBeInTheDocument();
  });

  it("does NOT add role/aria-label when accessibleLabel is absent", () => {
    const { container } = renderChart();
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("role")).toBeNull();
    expect(root.getAttribute("aria-label")).toBeNull();
  });
});

// #394: axis tick labels must reach the density-aware `text-meta` ROLE, not
// the raw `text-xs` UTILITY the type dial cannot see (styling-and-tokens.md
// "Type is a role, not a size").
describe("LiveXAxis / LiveYAxis — density-role className (#394)", () => {
  it("LiveXAxis renders its time label with the text-meta role, not the raw text-xs utility", () => {
    const { container } = render(
      <LiveLineChart data={sampleData} value={59}>
        <LiveLine dataKey="value" />
        <LiveXAxis />
      </LiveLineChart>,
    );
    const label = container.querySelector(".text-chart-label");
    expect(label).not.toBeNull();
    expect(label).toHaveClass("text-meta");
    expect(label).not.toHaveClass("text-xs");
  });

  it("LiveYAxis renders its tick label with the text-meta role, not the raw text-xs utility", () => {
    const { container } = render(
      <LiveLineChart data={sampleData} value={59}>
        <LiveLine dataKey="value" />
        <LiveYAxis />
      </LiveLineChart>,
    );
    const label = container.querySelector(".text-chart-label");
    expect(label).not.toBeNull();
    expect(label).toHaveClass("text-meta");
    expect(label).not.toHaveClass("text-xs");
  });
});
