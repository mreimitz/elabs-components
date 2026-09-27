import { createElement, forwardRef, memo } from "react";
import { describe, expect, it } from "vitest";
import { isNamedChartChild } from "./pie-ring-engine";

describe("isNamedChartChild", () => {
  it("matches a plain function component by its function name", () => {
    function Ring() {
      return null;
    }
    expect(isNamedChartChild(createElement(Ring), "Ring")).toBe(true);
  });

  it("matches a memo-wrapped component by its displayName", () => {
    const PieCenter = memo(function PieCenterImpl() {
      return null;
    });
    PieCenter.displayName = "PieCenter";
    expect(isNamedChartChild(createElement(PieCenter), "PieCenter")).toBe(true);
  });

  it("matches a forwardRef component by its displayName", () => {
    const RingImpl = forwardRef(function RingImpl(_props, _ref) {
      return null;
    });
    RingImpl.displayName = "Ring";
    expect(isNamedChartChild(createElement(RingImpl), "Ring")).toBe(true);
  });

  it("matches on the function name when displayName is set to something else", () => {
    function Ring() {
      return null;
    }
    Ring.displayName = "BrandRing";
    expect(isNamedChartChild(createElement(Ring), "Ring")).toBe(true);
  });

  it("does not match a differently named component", () => {
    function PieSlice() {
      return null;
    }
    expect(isNamedChartChild(createElement(PieSlice), "PieCenter")).toBe(false);
  });

  it("does not match a host element (a string type)", () => {
    expect(isNamedChartChild(createElement("div"), "Ring")).toBe(false);
  });

  it("does not match a string, a fragment, or null", () => {
    expect(isNamedChartChild("text", "Ring")).toBe(false);
    expect(isNamedChartChild(null, "Ring")).toBe(false);
    expect(isNamedChartChild(undefined, "Ring")).toBe(false);
  });
});
