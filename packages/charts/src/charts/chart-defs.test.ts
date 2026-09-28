import { createContext, createElement, forwardRef, Fragment, lazy, memo } from "react";
import { describe, expect, it } from "vitest";
import {
  getChartChildComponentName,
  isChartDefsComponent,
  isPostOverlayComponent,
} from "./chart-defs";

function Plain() {
  return null;
}

const MemoWithDisplayName = memo(function Inner() {
  return null;
});
(MemoWithDisplayName as unknown as { displayName?: string }).displayName = "MyGradientBand";

const MemoNoDisplayName = memo(function ChartMarkers() {
  return null;
});

const ForwardRefWithDisplayName = forwardRef(function Impl(_props, _ref) {
  return null;
});
(ForwardRefWithDisplayName as unknown as { displayName?: string }).displayName = "ChartBrush";

const LazyComponent = lazy(async () => ({ default: Plain }));

const GradientCtx = createContext(0);
(GradientCtx as unknown as { displayName?: string }).displayName = "GradientCtx";

describe("getChartChildComponentName (RM-204 fix round, item 3)", () => {
  it("names a plain function by its displayName, falling back to its function name", () => {
    const withDisplayName = function Impl() {
      return null;
    };
    (withDisplayName as unknown as { displayName?: string }).displayName = "ChartBrush";
    expect(getChartChildComponentName(createElement(withDisplayName))).toBe("ChartBrush");
    expect(getChartChildComponentName(createElement(Plain))).toBe("Plain");
  });

  it("names a memo() component by its displayName only", () => {
    expect(getChartChildComponentName(createElement(MemoWithDisplayName))).toBe("MyGradientBand");
  });

  it("a memo() component with no displayName has no name — its wrapped function's name is not read", () => {
    expect(getChartChildComponentName(createElement(MemoNoDisplayName))).toBe("");
  });

  it("names a forwardRef() component by its displayName only", () => {
    expect(getChartChildComponentName(createElement(ForwardRefWithDisplayName))).toBe("ChartBrush");
  });

  it("never names a Context element, even one carrying a displayName", () => {
    expect(getChartChildComponentName(createElement(GradientCtx, { value: 1 }))).toBe("");
  });

  it("never names a lazy() element", () => {
    expect(getChartChildComponentName(createElement(LazyComponent))).toBe("");
  });

  it("never names a Fragment", () => {
    expect(getChartChildComponentName(createElement(Fragment))).toBe("");
  });

  it("never names a host element", () => {
    expect(getChartChildComponentName(createElement("div"))).toBe("");
    expect(getChartChildComponentName(createElement("linearGradient"))).toBe("");
  });
});

describe("isChartDefsComponent / isPostOverlayComponent classify only what getChartChildComponentName names", () => {
  it("hoists a memo()-wrapped gradient by its displayName", () => {
    expect(isChartDefsComponent(createElement(MemoWithDisplayName))).toBe(true);
  });

  it("does not hoist a Context styled like a gradient", () => {
    expect(isChartDefsComponent(createElement(GradientCtx, { value: 1 }))).toBe(false);
  });

  it("paints a forwardRef()-wrapped brush post-overlay by its displayName", () => {
    expect(isPostOverlayComponent(createElement(ForwardRefWithDisplayName))).toBe(true);
  });

  it("does not paint a Context named like a brush post-overlay", () => {
    const ctx = createContext(0);
    (ctx as unknown as { displayName?: string }).displayName = "ChartBrush";
    expect(isPostOverlayComponent(createElement(ctx, { value: 1 }))).toBe(false);
  });

  it("a memo() component with no displayName is neither a def nor post-overlay component", () => {
    expect(isChartDefsComponent(createElement(MemoNoDisplayName))).toBe(false);
    expect(isPostOverlayComponent(createElement(MemoNoDisplayName))).toBe(false);
  });
});
