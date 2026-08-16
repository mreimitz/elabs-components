import { afterEach, describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { renderHook } from "@testing-library/react";
import { useHighDecorationOf } from "./use-high-decoration";

/** Stub `getComputedStyle` so `--decoration` returns `value` for any element. */
function stubDecoration(value: string) {
  vi.spyOn(window, "getComputedStyle").mockReturnValue({
    getPropertyValue: (prop: string) => (prop === "--decoration" ? value : ""),
  } as unknown as CSSStyleDeclaration);
}

afterEach(() => vi.restoreAllMocks());

describe("useHighDecorationOf (#164)", () => {
  it("is true when --decoration ≥ 8", () => {
    stubDecoration("10");
    const ref = createRef<HTMLDivElement>();
    // attach a real element so the effect reads it
    (ref as { current: HTMLDivElement }).current = document.createElement("div");
    const { result } = renderHook(() => useHighDecorationOf(ref));
    expect(result.current).toBe(true);
  });

  it("is false at low decoration (chromatic themes)", () => {
    stubDecoration("3");
    const ref = createRef<HTMLDivElement>();
    (ref as { current: HTMLDivElement }).current = document.createElement("div");
    const { result } = renderHook(() => useHighDecorationOf(ref));
    expect(result.current).toBe(false);
  });

  it("reads a provisional value from the theme root while the ref is unattached (#289)", () => {
    // Fixed-size charts attach the container ref a commit AFTER the child's
    // first layout effect; the provisional document-root read keeps the first
    // paint correct (no solid-fill flash) instead of returning false for a frame.
    stubDecoration("10");
    const ref = createRef<HTMLDivElement>();
    const { result } = renderHook(() => useHighDecorationOf(ref));
    expect(result.current).toBe(true);
  });

  it("stays false while the ref is unattached at low decoration", () => {
    stubDecoration("3");
    const ref = createRef<HTMLDivElement>();
    const { result } = renderHook(() => useHighDecorationOf(ref));
    expect(result.current).toBe(false);
  });

  it("is false when --decoration is absent/empty", () => {
    stubDecoration("");
    const ref = createRef<HTMLDivElement>();
    (ref as { current: HTMLDivElement }).current = document.createElement("div");
    const { result } = renderHook(() => useHighDecorationOf(ref));
    expect(result.current).toBe(false);
  });
});
