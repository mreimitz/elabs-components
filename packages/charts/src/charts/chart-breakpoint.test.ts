import { describe, expect, expectTypeOf, it } from "vitest";
import {
  breakpointForWidth,
  CHART_BREAKPOINT_THRESHOLDS,
  type ChartPlotHeight,
  DEFAULT_CHART_PLOT_HEIGHT,
  isResponsiveByBreakpoint,
  resolveDensityForBreakpoint,
  resolvePlotBoxStyle,
  resolveResponsive,
  type Responsive,
} from "./chart-breakpoint";

describe("breakpointForWidth (ADR 0039 §1)", () => {
  it("maps the acceptance widths to their tiers", () => {
    expect(breakpointForWidth(380)).toBe("narrow");
    expect(breakpointForWidth(600)).toBe("medium");
    expect(breakpointForWidth(900)).toBe("wide");
  });

  it("gives each boundary to the wider tier", () => {
    expect(CHART_BREAKPOINT_THRESHOLDS).toEqual({ narrow: 480, medium: 768 });
    expect(breakpointForWidth(479.9)).toBe("narrow");
    expect(breakpointForWidth(480)).toBe("medium");
    expect(breakpointForWidth(767.9)).toBe("medium");
    expect(breakpointForWidth(768)).toBe("wide");
  });

  it("treats an unmeasured width (0, negative, NaN, Infinity) as wide", () => {
    for (const w of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(breakpointForWidth(w)).toBe("wide");
    }
  });
});

describe("resolveResponsive (ADR 0039 §2)", () => {
  it("returns a plain value at every tier", () => {
    expect(resolveResponsive(3, "narrow")).toBe(3);
    expect(resolveResponsive({ aspect: 2 }, "narrow")).toEqual({ aspect: 2 });
    expect(resolveResponsive(undefined as number | undefined, "medium")).toBeUndefined();
  });

  it("cascades narrow → medium → base", () => {
    const v = { base: 3, medium: 2 };
    expect(resolveResponsive(v, "wide")).toBe(3);
    expect(resolveResponsive(v, "medium")).toBe(2);
    expect(resolveResponsive(v, "narrow")).toBe(2);
    expect(resolveResponsive({ base: 3, medium: 2, narrow: 1 }, "narrow")).toBe(1);
    expect(resolveResponsive({ base: 3, narrow: 1 }, "medium")).toBe(3);
  });

  it("treats undefined as unset and null as a value", () => {
    expect(resolveResponsive({ base: 3, narrow: undefined }, "narrow")).toBe(3);
    expect(resolveResponsive<number | null>({ base: 3, narrow: null }, "narrow")).toBeNull();
  });

  it("detects the per-tier form by its own `base` key only", () => {
    expect(isResponsiveByBreakpoint({ base: 1 })).toBe(true);
    expect(isResponsiveByBreakpoint({ aspect: 2 })).toBe(false);
    expect(isResponsiveByBreakpoint([1, 2] as unknown as number)).toBe(false);
    expect(isResponsiveByBreakpoint(null as unknown as number)).toBe(false);
  });

  it("types: a plot height is Responsive-compatible", () => {
    expectTypeOf(DEFAULT_CHART_PLOT_HEIGHT).toMatchTypeOf<Responsive<ChartPlotHeight>>();
  });
});

describe("resolveDensityForBreakpoint (narrow → sm coupling)", () => {
  it("caps md/lg to sm at narrow only", () => {
    expect(resolveDensityForBreakpoint("md", "narrow")).toBe("sm");
    expect(resolveDensityForBreakpoint("lg", "narrow")).toBe("sm");
    expect(resolveDensityForBreakpoint("md", "medium")).toBe("md");
    expect(resolveDensityForBreakpoint("md", "wide")).toBe("md");
  });

  it("never raises xs/sm", () => {
    expect(resolveDensityForBreakpoint("xs", "narrow")).toBe("xs");
    expect(resolveDensityForBreakpoint("sm", "wide")).toBe("sm");
  });

  it("lets an explicit narrow entry win (the per-chart escape hatch)", () => {
    expect(resolveDensityForBreakpoint({ base: "md", narrow: "md" }, "narrow")).toBe("md");
    expect(resolveDensityForBreakpoint({ base: "md", medium: "lg" }, "narrow")).toBe("sm");
  });
});

describe("resolvePlotBoxStyle (ADR 0039 §3 precedence)", () => {
  const d = DEFAULT_CHART_PLOT_HEIGHT;
  it("uses the family default: 2 : 1, and 1.25 : 1 at narrow", () => {
    expect(resolvePlotBoxStyle({ defaultPlotHeight: d }, "wide")).toEqual({ aspectRatio: "2 / 1" });
    expect(resolvePlotBoxStyle({ defaultPlotHeight: d }, "narrow")).toEqual({
      aspectRatio: "1.25 / 1",
    });
  });

  it("own plotHeight beats aspectRatio, frame and default", () => {
    expect(
      resolvePlotBoxStyle(
        { plotHeight: 240, aspectRatio: "3 / 1", defaultPlotHeight: d, framePlotHeight: 100 },
        "wide",
      ),
    ).toEqual({ height: 240 });
  });

  it("keeps an explicit aspectRatio verbatim and lets `auto` defer to the frame", () => {
    expect(resolvePlotBoxStyle({ aspectRatio: "16 / 9", defaultPlotHeight: d }, "wide")).toEqual({
      aspectRatio: "16 / 9",
    });
    expect(
      resolvePlotBoxStyle(
        { aspectRatio: "auto", defaultPlotHeight: d, framePlotHeight: 220 },
        "wide",
      ),
    ).toEqual({ height: 220 });
    expect(resolvePlotBoxStyle({ aspectRatio: "auto", defaultPlotHeight: d }, "wide")).toEqual({});
  });

  it("fills a tile body and resolves a responsive frame value at the chart's tier", () => {
    expect(resolvePlotBoxStyle({ defaultPlotHeight: d, framePlotHeight: "fill" }, "wide")).toEqual({
      height: "100%",
    });
    expect(
      resolvePlotBoxStyle(
        { defaultPlotHeight: d, framePlotHeight: { base: 300, narrow: { aspect: 1 } } },
        "narrow",
      ),
    ).toEqual({ aspectRatio: "1 / 1" });
  });

  it("ignores an invalid plot height and falls to the next rung", () => {
    expect(resolvePlotBoxStyle({ plotHeight: -5, defaultPlotHeight: d }, "wide")).toEqual({
      aspectRatio: "2 / 1",
    });
  });
});
