import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  _debugActiveThemeScopeCount,
  getThemeScope,
  useThemeScopeRevision,
} from "./_theme-scope-store";

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.body.innerHTML = "";
});

describe("getThemeScope", () => {
  it("resolves the nearest data-theme ancestor, falling back to <html>", () => {
    expect(getThemeScope(document.body)).toBe(document.documentElement);

    const scoped = document.createElement("div");
    scoped.setAttribute("data-theme", "dark");
    document.body.append(scoped);
    expect(getThemeScope(scoped)).toBe(scoped);
  });
});

describe("useThemeScopeRevision (perf review §3.3)", () => {
  it("bumps the revision when the scoped element's data-theme mutates", async () => {
    const { result } = renderHook(() => useThemeScopeRevision(document.documentElement));
    const before = result.current;

    document.documentElement.setAttribute("data-theme", "dark");

    await waitFor(() => expect(result.current).toBe(before + 1));
  });

  it("shares ONE MutationObserver across every subscriber of the same scope", async () => {
    const before = _debugActiveThemeScopeCount();
    const hookA = renderHook(() => useThemeScopeRevision(document.documentElement));
    const hookB = renderHook(() => useThemeScopeRevision(document.documentElement));
    const hookC = renderHook(() => useThemeScopeRevision(document.documentElement));

    // Three subscribers to the SAME scope element register as exactly one
    // tracked scope, not three — this is the fix: previously each caller
    // (CodeBlockContent, useReactiveCodePlugin) instantiated its own
    // MutationObserver on the same ancestor.
    expect(_debugActiveThemeScopeCount()).toBe(before + 1);

    document.documentElement.setAttribute("data-theme", "dark");

    // Every subscriber still gets notified through the single observer.
    await waitFor(() => expect(hookA.result.current).toBe(1));
    expect(hookB.result.current).toBe(1);
    expect(hookC.result.current).toBe(1);

    hookA.unmount();
    hookB.unmount();
    expect(_debugActiveThemeScopeCount()).toBe(before + 1); // still one listener left (hookC)
    hookC.unmount();
    expect(_debugActiveThemeScopeCount()).toBe(before); // the observer is disconnected once unused
  });

  it("scopes to the closest [data-theme] ancestor, not always <html>", async () => {
    const outer = document.createElement("div");
    outer.setAttribute("data-theme", "light");
    const inner = document.createElement("div");
    inner.setAttribute("data-theme", "dark");
    outer.append(inner);
    document.body.append(outer);

    const { result } = renderHook(() => useThemeScopeRevision(inner));
    const before = result.current;

    // A mutation on the OUTER (non-closest) ancestor must not affect a
    // consumer scoped to the inner region. There is nothing to `waitFor`
    // here (a NEGATIVE assertion), so flush the microtask queue directly.
    outer.setAttribute("data-theme", "light-updated");
    await Promise.resolve();
    expect(result.current).toBe(before);

    // A mutation on the actually-closest scope element does.
    inner.setAttribute("data-theme", "light");
    await waitFor(() => expect(result.current).toBe(before + 1));
  });
});
