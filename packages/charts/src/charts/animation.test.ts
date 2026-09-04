/**
 * RM-020 — the four chart motion tokens (`--chart-stagger-dot`,
 * `--chart-stagger-bar`, `--chart-enter`, `--chart-enter-slow`) read via
 * `getComputedStyle`, SSR-safe literal fallback.
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_CHART_ENTER_MS,
  DEFAULT_CHART_ENTER_SLOW_MS,
  DEFAULT_CHART_STAGGER_BAR_MS,
  DEFAULT_CHART_STAGGER_DOT_MS,
  getChartEnterMs,
  getChartEnterSlowMs,
  getChartStaggerBarMs,
  getChartStaggerDotMs,
  parseCssTimeToMs,
} from "./animation";

describe("parseCssTimeToMs", () => {
  it("parses a millisecond literal", () => {
    expect(parseCssTimeToMs("12ms")).toBe(12);
  });

  it("parses a second literal and converts to ms", () => {
    expect(parseCssTimeToMs("0.9s")).toBe(900);
    expect(parseCssTimeToMs("1.2s")).toBe(1200);
  });

  it("returns null for missing / empty / unparsable values", () => {
    expect(parseCssTimeToMs(undefined)).toBeNull();
    expect(parseCssTimeToMs(null)).toBeNull();
    expect(parseCssTimeToMs("")).toBeNull();
    expect(parseCssTimeToMs("auto")).toBeNull();
    expect(parseCssTimeToMs("12")).toBeNull(); // no unit
  });
});

describe("chart motion token readers (fallback path)", () => {
  it("fall back to the documented literals when the CSS variable is unset", () => {
    // jsdom's `document.documentElement` carries no `--chart-*` custom
    // properties unless a test sets them — this asserts the SSR-safe
    // fallback, which is the behaviour every existing chart gets today.
    expect(getChartStaggerDotMs()).toBe(DEFAULT_CHART_STAGGER_DOT_MS);
    expect(getChartStaggerBarMs()).toBe(DEFAULT_CHART_STAGGER_BAR_MS);
    expect(getChartEnterMs()).toBe(DEFAULT_CHART_ENTER_MS);
    expect(getChartEnterSlowMs()).toBe(DEFAULT_CHART_ENTER_SLOW_MS);
  });
});

describe("chart motion token readers (themed element)", () => {
  const el = document.createElement("div");

  afterEach(() => {
    el.removeAttribute("style");
    el.remove();
  });

  it("read an overridden token off a given element", () => {
    document.body.appendChild(el);
    el.style.setProperty("--t-chart-stagger-dot", "20ms");
    el.style.setProperty("--t-chart-stagger-bar", "150ms");
    el.style.setProperty("--t-chart-enter", "0.75s");
    el.style.setProperty("--t-chart-enter-slow", "1.5s");

    expect(getChartStaggerDotMs(el)).toBe(20);
    expect(getChartStaggerBarMs(el)).toBe(150);
    expect(getChartEnterMs(el)).toBe(750);
    expect(getChartEnterSlowMs(el)).toBe(1500);
  });
});
