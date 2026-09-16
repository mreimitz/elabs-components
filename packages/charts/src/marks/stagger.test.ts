/**
 * #174 — `stagger()` must read the live `--t-chart-stagger-dot` token (via
 * `../charts/animation`'s SSR-safe reader) when no explicit `step` is given,
 * and fall back to `CHART_STAGGER_DOT_MS` when the token is absent/unparsable
 * or there is no `document`. Locks the token path so it cannot silently
 * revert to a hardcoded constant.
 */

import { afterEach, describe, expect, it } from "vitest";
import { CHART_STAGGER_BAR_MS, CHART_STAGGER_DOT_MS, stagger } from "./stagger";

describe("stagger", () => {
  const el = document.createElement("div");

  afterEach(() => {
    el.removeAttribute("style");
    el.remove();
    document.documentElement.style.removeProperty("--t-chart-stagger-dot");
  });

  it("falls back to CHART_STAGGER_DOT_MS when no token is set", () => {
    expect(stagger(2)).toBeCloseTo((2 * CHART_STAGGER_DOT_MS) / 1000);
  });

  it("reflects a --t-chart-stagger-dot override on the document root", () => {
    document.documentElement.style.setProperty("--t-chart-stagger-dot", "20ms");
    expect(stagger(2)).toBeCloseTo((2 * 20) / 1000);
  });

  it("an explicit step always wins over the token", () => {
    document.documentElement.style.setProperty("--t-chart-stagger-dot", "20ms");
    expect(stagger(2, 0, CHART_STAGGER_BAR_MS)).toBeCloseTo((2 * CHART_STAGGER_BAR_MS) / 1000);
  });

  it("clamps a negative index to 0", () => {
    expect(stagger(-5, 10, 12)).toBeCloseTo(10 / 1000);
  });

  it("adds the group base offset", () => {
    expect(stagger(3, 50, 12)).toBeCloseTo((50 + 3 * 12) / 1000);
  });
});
