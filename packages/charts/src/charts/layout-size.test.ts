import { afterEach, describe, expect, it, vi } from "vitest";
import { layoutSize } from "./layout-size";

afterEach(() => vi.restoreAllMocks());

describe("layoutSize", () => {
  it("reads the layout box, which a transform on an ancestor leaves alone", () => {
    const el = document.createElement("div");
    // Mid `zoom-in-95`: the viewport rect is scaled, the layout box is not.
    vi.spyOn(el, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 608, 380));
    vi.spyOn(el, "offsetWidth", "get").mockReturnValue(640);
    vi.spyOn(el, "offsetHeight", "get").mockReturnValue(400);
    expect(layoutSize(el)).toEqual({ width: 640, height: 400 });
  });

  it("keeps the used size's sub-pixel precision, which offsets round away", () => {
    const el = document.createElement("div");
    el.style.width = "601px";
    el.style.height = "300.5px";
    vi.spyOn(el, "offsetWidth", "get").mockReturnValue(601);
    vi.spyOn(el, "offsetHeight", "get").mockReturnValue(301);
    expect(layoutSize(el)).toEqual({ width: 601, height: 300.5 });
  });

  it("adds padding and border when the box is sized as a content box", () => {
    const el = document.createElement("div");
    el.style.cssText =
      "box-sizing: content-box; width: 200.25px; height: 100px; padding: 0 4px; border: 1px solid";
    vi.spyOn(el, "offsetWidth", "get").mockReturnValue(210);
    vi.spyOn(el, "offsetHeight", "get").mockReturnValue(102);
    expect(layoutSize(el)).toEqual({ width: 210.25, height: 102 });
  });

  it("falls back to the rect when the element has no layout box of its own", () => {
    // jsdom (offsets always 0) and SVG elements (no offsets at all).
    const div = document.createElement("div");
    vi.spyOn(div, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 320, 200));
    expect(layoutSize(div)).toEqual({ width: 320, height: 200 });
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 90, 30));
    expect(layoutSize(svg)).toEqual({ width: 90, height: 30 });
  });
});
