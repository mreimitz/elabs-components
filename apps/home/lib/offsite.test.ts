import { describe, expect, it } from "vitest";
import { isOffsite, offsiteProps } from "./offsite";

describe("offsite", () => {
  it("treats other origins and Storybook as off-site", () => {
    expect(isOffsite("https://github.com/mreimitz/elabs-components")).toBe(true);
    expect(isOffsite("http://example.com")).toBe(true);
    expect(isOffsite("/storybook/")).toBe(true);
    expect(isOffsite("/storybook/?path=/docs/ui-button--docs")).toBe(true);
  });

  it("keeps the site's own pages in the current tab", () => {
    for (const href of ["/", "/start", "/components/maps/map-canvas", "#agents", "/#themes"]) {
      expect(isOffsite(href)).toBe(false);
      expect(offsiteProps(href)).toEqual({});
    }
  });

  it("opens off-site links in a new tab without handing over the opener", () => {
    expect(offsiteProps("/storybook/")).toEqual({ target: "_blank", rel: "noopener noreferrer" });
  });
});
