import { afterEach, describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { renderHook } from "@testing-library/react";
import { estimateTextWidth, useTextMeasurerOf } from "./use-text-measurer";

/**
 * Resolve the probe's font the way a browser would. jsdom returns empty strings
 * from `getComputedStyle` for anything a stylesheet would have supplied, so the
 * hook's own fallbacks are what a bare test exercises — stub it when the test is
 * about the resolved values rather than the fallbacks.
 */
function stubProbeFont(style: Partial<CSSStyleDeclaration>) {
  vi.spyOn(window, "getComputedStyle").mockReturnValue({
    fontSize: "",
    lineHeight: "",
    fontFamily: "",
    fontWeight: "",
    fontStyle: "",
    letterSpacing: "",
    ...style,
    getPropertyValue: () => "",
  } as unknown as CSSStyleDeclaration);
}

/** Same stub, but also records the classes each probe was measured with. */
function stubProbeFontRecordingClasses(style: Partial<CSSStyleDeclaration>): string[] {
  const seen: string[] = [];
  vi.spyOn(window, "getComputedStyle").mockImplementation((element: Element) => {
    seen.push(element.className);
    return {
      fontSize: "",
      lineHeight: "",
      fontFamily: "",
      fontWeight: "",
      fontStyle: "",
      letterSpacing: "",
      ...style,
      getPropertyValue: () => "",
    } as unknown as CSSStyleDeclaration;
  });
  return seen;
}

function attachedRef() {
  const ref = createRef<HTMLDivElement>();
  (ref as { current: HTMLDivElement }).current = document.createElement("div");
  return ref;
}

afterEach(() => vi.restoreAllMocks());

describe("estimateTextWidth", () => {
  it("is zero for the empty string", () => {
    expect(estimateTextWidth("", 12)).toBe(0);
  });

  it("charges narrow, default and wide glyphs differently", () => {
    const narrow = estimateTextWidth("iiii", 12);
    const normal = estimateTextWidth("nnnn", 12);
    const wide = estimateTextWidth("MMMM", 12);

    expect(narrow).toBeLessThan(normal);
    expect(normal).toBeLessThan(wide);
  });

  it("scales linearly with the font size", () => {
    expect(estimateTextWidth("Region", 24)).toBeCloseTo(estimateTextWidth("Region", 12) * 2, 5);
  });

  it("grows monotonically with the string", () => {
    expect(estimateTextWidth("Region", 12)).toBeGreaterThan(estimateTextWidth("Regio", 12));
  });

  // #412 review — a label painted at 0.08em tracking is ~1px per character
  // wider than the shaped run, and the gutter is only honest if that is in it.
  it("charges the letter spacing once per character", () => {
    expect(estimateTextWidth("Region", 12, 0.96)).toBeCloseTo(
      estimateTextWidth("Region", 12) + 6 * 0.96,
      5,
    );
  });
});

describe("useTextMeasurerOf", () => {
  it("returns finite widths under jsdom, where there is no 2d context", () => {
    const { result } = renderHook(() => useTextMeasurerOf(attachedRef()));

    const width = result.current.measure("Q1 Western Region");
    expect(Number.isFinite(width)).toBe(true);
    expect(width).toBeGreaterThan(0);
    expect(result.current.lineHeightPx).toBeGreaterThan(0);
    expect(result.current.fontSizePx).toBeGreaterThan(0);
  });

  it("falls back to the default font metrics when the ref is unattached", () => {
    const { result } = renderHook(() => useTextMeasurerOf(createRef<HTMLDivElement>()));

    expect(result.current.fontSizePx).toBe(12);
    expect(result.current.lineHeightPx).toBe(16);
  });

  it("reads the resolved font size and line height off the probe", () => {
    stubProbeFont({ fontSize: "15px", lineHeight: "20px", fontFamily: "Inter", fontWeight: "500" });
    const { result } = renderHook(() => useTextMeasurerOf(attachedRef()));

    expect(result.current.fontSizePx).toBe(15);
    expect(result.current.lineHeightPx).toBe(20);
  });

  it("derives a line height from the font size when it resolves to `normal`", () => {
    stubProbeFont({ fontSize: "16px", lineHeight: "normal" });
    const { result } = renderHook(() => useTextMeasurerOf(attachedRef()));

    expect(result.current.lineHeightPx).toBeGreaterThan(16);
  });

  // #412 review — `NetworkChart` paints its labels in `text-chart-source`, not
  // in the `text-meta` rung the probe used to hardcode.
  it("probes the type role the caller names", () => {
    const seen = stubProbeFontRecordingClasses({ fontSize: "12px", lineHeight: "16px" });
    renderHook(() => useTextMeasurerOf(attachedRef(), { className: "text-chart-source" }));

    expect(seen).toContain("text-chart-source");
    expect(seen.some((c) => c.includes("text-meta"))).toBe(false);
  });

  it("probes the meta rung when the caller names none", () => {
    const seen = stubProbeFontRecordingClasses({ fontSize: "12px", lineHeight: "16px" });
    renderHook(() => useTextMeasurerOf(attachedRef()));

    expect(seen.some((c) => c.includes("text-meta"))).toBe(true);
  });

  it("includes the resolved letter spacing in every measured width", () => {
    stubProbeFont({ fontSize: "12px", lineHeight: "16px", letterSpacing: "0.96px" });
    const tracked = renderHook(() => useTextMeasurerOf(attachedRef()));
    vi.restoreAllMocks();
    stubProbeFont({ fontSize: "12px", lineHeight: "16px", letterSpacing: "normal" });
    const untracked = renderHook(() => useTextMeasurerOf(attachedRef()));

    expect(tracked.result.current.letterSpacingPx).toBeCloseTo(0.96, 5);
    expect(untracked.result.current.letterSpacingPx).toBe(0);
    expect(tracked.result.current.measure("Northwest")).toBeCloseTo(
      untracked.result.current.measure("Northwest") + 9 * 0.96,
      5,
    );
  });

  it("measures wider text as wider, at whatever size resolves", () => {
    stubProbeFont({ fontSize: "15px", lineHeight: "20px" });
    const { result } = renderHook(() => useTextMeasurerOf(attachedRef()));

    expect(result.current.measure("Northwest Territories")).toBeGreaterThan(
      result.current.measure("Q1"),
    );
  });
});
