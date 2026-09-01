import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { hasRenderableContent } from "./has-renderable-content";

describe("hasRenderableContent", () => {
  it("is false for every scalar falsy value", () => {
    expect(hasRenderableContent(undefined)).toBe(false);
    expect(hasRenderableContent(null)).toBe(false);
    expect(hasRenderableContent(false)).toBe(false);
    expect(hasRenderableContent("")).toBe(false);
    expect(hasRenderableContent(0)).toBe(false);
  });

  it("is true for a non-empty string or a truthy number", () => {
    expect(hasRenderableContent("Required.")).toBe(true);
    expect(hasRenderableContent(1)).toBe(true);
  });

  it("is false for an empty array — arrays are always truthy, which is exactly the bug this helper exists to avoid", () => {
    expect(hasRenderableContent([])).toBe(false);
  });

  it("is false for an array of only falsy children", () => {
    expect(hasRenderableContent([false, null, undefined])).toBe(false);
  });

  it("is false for an array of only empty strings — Children.toArray alone keeps '' and would still report content", () => {
    expect(hasRenderableContent(["", ""])).toBe(false);
  });

  it("is true for an array containing at least one renderable child", () => {
    expect(hasRenderableContent([false, "Required."])).toBe(true);
  });

  it("is true for a single React element", () => {
    expect(hasRenderableContent(createElement("span", null, "hi"))).toBe(true);
  });

  // [KNOWN LIMIT] — an element naming a component that will render `null` is
  // still an inert, truthy descriptor at this point; whether it renders
  // anything is not decidable before React actually renders it. Documented
  // limit, not a bug — see the JSDoc above `hasRenderableContent`.
  it("[KNOWN LIMIT] is true for an element whose component will render null — not knowable before render", () => {
    function RendersNull() {
      return null;
    }
    expect(hasRenderableContent(createElement(RendersNull))).toBe(true);
  });
});
