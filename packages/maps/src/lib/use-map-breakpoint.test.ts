import { describe, expect, it } from "vitest";

import {
  DEFAULT_MAP_HEIGHT,
  MAP_BREAKPOINT_THRESHOLDS,
  mapBreakpointForWidth,
  resolveMapHeightStyle,
  resolveMapResponsive,
} from "./use-map-breakpoint";

describe("map breakpoints (a documented copy of the charts tiers)", () => {
  it("uses the charts thresholds: narrow < 480, medium < 768", () => {
    expect(MAP_BREAKPOINT_THRESHOLDS).toEqual({ narrow: 480, medium: 768 });
    expect(mapBreakpointForWidth(348)).toBe("narrow");
    expect(mapBreakpointForWidth(479.5)).toBe("narrow");
    expect(mapBreakpointForWidth(480)).toBe("medium");
    expect(mapBreakpointForWidth(568)).toBe("medium");
    expect(mapBreakpointForWidth(768)).toBe("wide");
    expect(mapBreakpointForWidth(868)).toBe("wide");
  });

  it("treats an unmeasured width as wide", () => {
    expect(mapBreakpointForWidth(0)).toBe("wide");
    expect(mapBreakpointForWidth(Number.NaN)).toBe("wide");
  });

  it("resolves per-tier values desktop-first", () => {
    const value = { base: "a", medium: "b", narrow: "c" };
    expect(resolveMapResponsive(value, "wide")).toBe("a");
    expect(resolveMapResponsive(value, "medium")).toBe("b");
    expect(resolveMapResponsive(value, "narrow")).toBe("c");
    expect(resolveMapResponsive({ base: true, narrow: false }, "medium")).toBe(true);
    expect(resolveMapResponsive({ base: true, narrow: false }, "narrow")).toBe(false);
    expect(resolveMapResponsive(false, "narrow")).toBe(false);
  });

  it("defaults the height to 1.6 : 1, square at narrow", () => {
    expect(DEFAULT_MAP_HEIGHT).toEqual({ base: { aspect: 1.6 }, narrow: { aspect: 1 } });
    expect(resolveMapHeightStyle(undefined, "wide")).toEqual({ aspectRatio: "1.6 / 1" });
    expect(resolveMapHeightStyle(undefined, "narrow")).toEqual({ aspectRatio: "1 / 1" });
  });

  it("lets an explicit height win, per tier", () => {
    expect(resolveMapHeightStyle(420, "narrow")).toEqual({ height: 420 });
    expect(resolveMapHeightStyle({ base: { aspect: 2 }, narrow: 360 }, "wide")).toEqual({
      height: "auto",
      aspectRatio: "2 / 1",
    });
    expect(resolveMapHeightStyle({ base: { aspect: 2 }, narrow: 360 }, "narrow")).toEqual({
      height: 360,
    });
    // An invalid height falls back to the default instead of collapsing.
    expect(resolveMapHeightStyle(-5, "wide")).toEqual({ aspectRatio: "1.6 / 1" });
  });
});
