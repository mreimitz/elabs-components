import { afterEach, describe, expect, it, vi } from "vitest";

import { embedExportFonts } from "./export-fonts";

const SVG_NS = "http://www.w3.org/2000/svg";

/** A readable `@font-face` rule — jsdom has no `CSSFontFaceRule` of its own. */
class FakeFontFaceRule {
  style: {
    length: number;
    item: (i: number) => string;
    getPropertyValue: (name: string) => string;
  };
  constructor(descriptors: Record<string, string>) {
    const names = Object.keys(descriptors);
    this.style = {
      length: names.length,
      item: (i) => names[i]!,
      getPropertyValue: (name) => descriptors[name] ?? "",
    };
  }
}

function withStylesheets(rules: FakeFontFaceRule[]) {
  vi.stubGlobal("CSSFontFaceRule", FakeFontFaceRule);
  Object.defineProperty(document, "styleSheets", {
    configurable: true,
    get: () => [{ href: "https://fonts.test/css/site.css", cssRules: rules }],
  });
}

function stubFetch(ok = true) {
  const fetchMock = vi.fn(async (_url: string) => ({
    ok,
    blob: async () => new Blob(["font-bytes"], { type: "font/woff2" }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** A framed export: a root `<title>`, then text in `family`. */
function picture(text: string, { family = "Inter, sans-serif", italic = false } = {}) {
  const svg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
  const title = document.createElementNS(SVG_NS, "title");
  title.textContent = "Revenue";
  const label = document.createElementNS(SVG_NS, "text");
  label.setAttribute("font-family", family);
  if (italic) label.setAttribute("font-style", "italic");
  label.textContent = text;
  svg.append(title, label);
  return svg;
}

const embedded = (svg: SVGSVGElement) =>
  svg.querySelector('[data-slot="chart-export-fonts"] style')?.textContent ?? "";

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, "styleSheets");
});

describe("embedExportFonts", () => {
  it("embeds the faces the text needs, after the root <title>", async () => {
    withStylesheets([
      new FakeFontFaceRule({
        "font-family": '"Inter"',
        "font-weight": "100 900",
        src: 'url("../fonts/inter-latin.woff2") format("woff2")',
        "unicode-range": "U+0-FF, U+131",
      }),
      new FakeFontFaceRule({
        "font-family": '"Inter"',
        src: 'url("../fonts/inter-cyrillic.woff2")',
        "unicode-range": "U+400-45F",
      }),
      new FakeFontFaceRule({ "font-family": "Other", src: "url(other.woff2)" }),
    ]);
    const fetchMock = stubFetch();
    const svg = picture("Revenue 1,234");

    await embedExportFonts(svg);

    // Resolved against the stylesheet, not the page; only the Latin face.
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://fonts.test/fonts/inter-latin.woff2",
    ]);
    const css = embedded(svg);
    expect(css).toMatch(/^@font-face\{font-family:"Inter";font-weight:100 900;/);
    expect(css).toContain('src:url("data:font/woff2;base64,');
    expect(css).not.toContain("inter-cyrillic");
    expect([...svg.children].map((c) => c.localName)).toEqual(["title", "defs", "text"]);
  });

  it("leaves italic faces out unless the picture draws italic", async () => {
    const italicFace = new FakeFontFaceRule({
      "font-family": "Inter",
      "font-style": "italic",
      src: "url(/fonts/inter-italic-a.woff2)",
    });
    withStylesheets([italicFace]);
    const fetchMock = stubFetch();

    const upright = picture("Revenue");
    await embedExportFonts(upright);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(upright.querySelector("defs")).toBeNull();

    const slanted = picture("Revenue", { italic: true });
    await embedExportFonts(slanted);
    expect(embedded(slanted)).toContain("font-style:italic");
  });

  it("goes without a face that fails to load, and tries again next export", async () => {
    withStylesheets([
      new FakeFontFaceRule({ "font-family": "Inter", src: "url(/fonts/inter-retry.woff2)" }),
    ]);
    const failing = stubFetch(false);
    const first = picture("Revenue");
    await expect(embedExportFonts(first)).resolves.toBeUndefined();
    expect(first.querySelector("defs")).toBeNull();
    expect(failing).toHaveBeenCalledTimes(1);

    const working = stubFetch(true);
    const second = picture("Revenue");
    await embedExportFonts(second);
    expect(working).toHaveBeenCalledTimes(1);
    expect(embedded(second)).toContain("data:font/woff2");
  });

  it("fetches nothing for a picture in a family the page does not serve", async () => {
    withStylesheets([
      new FakeFontFaceRule({ "font-family": "Inter", src: "url(/fonts/inter-unused.woff2)" }),
    ]);
    const fetchMock = stubFetch();
    const svg = picture("Revenue", { family: "Georgia, serif" });
    await embedExportFonts(svg);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(svg.querySelector("defs")).toBeNull();
  });
});
