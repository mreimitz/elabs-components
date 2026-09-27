/**
 * chart-type-summary.test.ts (F6.2) — every `ChartType` gets a real label; an
 * unrecognised value gets the generic fallback, never a throw.
 */
import { describe, expect, it } from "vitest";
import { CHART_TYPE_SUMMARY_LABEL, chartTypeSummaryLabel } from "./chart-type-summary";
import { CHART_TYPES } from "./infer-chart-type";
import type { ChartType } from "./chart-spec";

describe("CHART_TYPE_SUMMARY_LABEL / chartTypeSummaryLabel", () => {
  it.each(CHART_TYPES as readonly ChartType[])('has a non-empty label for "%s"', (type) => {
    expect(typeof CHART_TYPE_SUMMARY_LABEL[type]).toBe("string");
    expect(CHART_TYPE_SUMMARY_LABEL[type].length).toBeGreaterThan(0);
    expect(chartTypeSummaryLabel(type)).toBe(CHART_TYPE_SUMMARY_LABEL[type]);
  });

  it("covers every ChartType union member (no type silently unlabelled)", () => {
    expect(Object.keys(CHART_TYPE_SUMMARY_LABEL).sort()).toEqual([...CHART_TYPES].sort());
  });

  it("falls back to the generic label for a value outside the union", () => {
    expect(chartTypeSummaryLabel("sankey-invented")).toBe("Chart");
    expect(chartTypeSummaryLabel("")).toBe("Chart");
  });
});
