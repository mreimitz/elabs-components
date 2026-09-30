/**
 * radial-chart-sizing.test.tsx — the fixed-size vs. auto-measured branch
 * `PieChart` and `RingChart` share (RM-204 fix round, P2 item 7: this had no
 * unit test of its own — only indirect coverage through the pie/ring
 * family-level remount/focus regression tests).
 *
 * jsdom has no real layout, so the responsive branch is exercised the same
 * way `pie-chart.test.tsx` does: `./chart-parent-size` mocked to hand its
 * children a fixed size.
 */
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { RadialChartSizing, type RadialChartSizingProps } from "./radial-chart-sizing";

vi.mock("./chart-parent-size", () => ({
  ChartParentSize: ({
    children,
  }: {
    children: (size: { width: number; height: number }) => React.ReactNode;
  }) => children({ width: 240, height: 180 }),
}));

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const baseProps = {
  marginBox: { top: 10, right: 5, bottom: 10, left: 5 },
  marginStyle: undefined,
  descId: "desc-1",
} satisfies Partial<RadialChartSizingProps>;

describe("RadialChartSizing — fixed size branch", () => {
  it("shrinks fixedSize by the margin box before handing it to children", () => {
    const sizes: { width: number; height: number }[] = [];
    render(
      <RadialChartSizing {...baseProps} fixedSize={200} innerRef={() => {}}>
        {(size) => {
          sizes.push(size);
          return <svg data-testid="inner" />;
        }}
      </RadialChartSizing>,
    );
    // width: 200 - 5 - 5 = 190; height: 200 - 10 - 10 = 180
    expect(sizes).toEqual([{ width: 190, height: 180 }]);
  });

  it("sizes the root itself to the RAW fixedSize, not the shrunk plot size", () => {
    const { container } = render(
      <RadialChartSizing {...baseProps} fixedSize={200} innerRef={() => {}}>
        {() => <svg />}
      </RadialChartSizing>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe("200px");
    expect(root.style.height).toBe("200px");
  });

  it("ignores plotHeight — the fixed branch never sets an aspect ratio", () => {
    const { container } = render(
      <RadialChartSizing
        {...baseProps}
        fixedSize={200}
        plotHeight={{ aspect: 3 }}
        innerRef={() => {}}
      >
        {() => <svg />}
      </RadialChartSizing>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.aspectRatio).toBe("");
  });

  it("forwards innerRef to the rendered root DOM node", () => {
    const ref = createRef<HTMLDivElement>();
    const { container } = render(
      <RadialChartSizing {...baseProps} fixedSize={200} innerRef={ref}>
        {() => <svg />}
      </RadialChartSizing>,
    );
    expect(ref.current).toBe(container.firstElementChild);
  });

  it("statePanel replaces children entirely, at the same call site", () => {
    const { queryByTestId, getByTestId } = render(
      <RadialChartSizing
        {...baseProps}
        fixedSize={200}
        innerRef={() => {}}
        statePanel={<div data-testid="state-panel">Loading…</div>}
      >
        {() => <svg data-testid="inner" />}
      </RadialChartSizing>,
    );
    expect(getByTestId("state-panel")).toBeTruthy();
    expect(queryByTestId("inner")).toBeNull();
  });
});

describe("RadialChartSizing — responsive branch (no fixedSize)", () => {
  it("hands children the size ChartParentSize measured", () => {
    const sizes: { width: number; height: number }[] = [];
    render(
      <RadialChartSizing {...baseProps} innerRef={() => {}}>
        {(size) => {
          sizes.push(size);
          return <svg />;
        }}
      </RadialChartSizing>,
    );
    expect(sizes).toEqual([{ width: 240, height: 180 }]);
  });

  it("sets an aspect ratio from plotHeight — only this branch reads it", () => {
    const { container } = render(
      <RadialChartSizing {...baseProps} plotHeight={{ aspect: 3 }} innerRef={() => {}}>
        {() => <svg />}
      </RadialChartSizing>,
    );
    const root = container.firstElementChild as HTMLElement;
    // jsdom normalizes a bare number to an explicit "N / 1" ratio.
    expect(root.style.aspectRatio).toBe("3 / 1");
  });

  it("defaults to a 1:1 aspect ratio with no plotHeight given", () => {
    const { container } = render(
      <RadialChartSizing {...baseProps} innerRef={() => {}}>
        {() => <svg />}
      </RadialChartSizing>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.aspectRatio).toBe("1 / 1");
  });

  it("forwards innerRef to the rendered root DOM node", () => {
    const ref = createRef<HTMLDivElement>();
    const { container } = render(
      <RadialChartSizing {...baseProps} innerRef={ref}>
        {() => <svg />}
      </RadialChartSizing>,
    );
    expect(ref.current).toBe(container.firstElementChild);
  });

  it("statePanel replaces ChartParentSize entirely, at the same call site", () => {
    const { queryByTestId, getByTestId } = render(
      <RadialChartSizing
        {...baseProps}
        innerRef={() => {}}
        statePanel={<div data-testid="state-panel">Loading…</div>}
      >
        {() => <svg data-testid="inner" />}
      </RadialChartSizing>,
    );
    expect(getByTestId("state-panel")).toBeTruthy();
    expect(queryByTestId("inner")).toBeNull();
  });
});
