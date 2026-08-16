import { afterEach, describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { renderHook } from "@testing-library/react";
import { useResolvedRadiusOf } from "./use-resolved-radius";

/**
 * Stub `getComputedStyle` so the probe element's resolved `width` (which the hook
 * sets to `var(--radius)`) reports `value`. In a real browser the browser
 * evaluates the calc() to px; jsdom doesn't, so we stub the resolved width.
 */
function stubProbeWidth(value: string) {
  vi.spyOn(window, "getComputedStyle").mockReturnValue({
    width: value,
    getPropertyValue: () => "",
  } as unknown as CSSStyleDeclaration);
}

afterEach(() => vi.restoreAllMocks());

describe("useResolvedRadiusOf (#165)", () => {
  it("resolves --radius to a px number (rounded theme)", () => {
    stubProbeWidth("4px");
    const ref = createRef<HTMLDivElement>();
    (ref as { current: HTMLDivElement }).current = document.createElement("div");
    const { result } = renderHook(() => useResolvedRadiusOf(ref));
    expect(result.current).toBe(4);
  });

  it("resolves to 0 in a squared theme (high decoration)", () => {
    stubProbeWidth("0px");
    const ref = createRef<HTMLDivElement>();
    (ref as { current: HTMLDivElement }).current = document.createElement("div");
    const { result } = renderHook(() => useResolvedRadiusOf(ref));
    expect(result.current).toBe(0);
  });

  it("falls back to the default when the resolved width is not parseable", () => {
    stubProbeWidth("calc(0.25rem * 1)"); // unevaluated → NaN → default
    const ref = createRef<HTMLDivElement>();
    (ref as { current: HTMLDivElement }).current = document.createElement("div");
    const { result } = renderHook(() => useResolvedRadiusOf(ref));
    expect(result.current).toBe(4);
  });

  it("returns the default when the ref is unattached (SSR / pre-mount)", () => {
    stubProbeWidth("8px");
    const ref = createRef<HTMLDivElement>();
    const { result } = renderHook(() => useResolvedRadiusOf(ref));
    expect(result.current).toBe(4);
  });
});
