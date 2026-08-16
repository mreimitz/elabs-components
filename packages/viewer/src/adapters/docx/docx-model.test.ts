import { describe, expect, it } from "vitest";

import {
  blocksToText,
  blocksToTextWithMap,
  DOCX_HEAD_ROW,
  htmlToBlocks,
  safeHref,
  type DocxBlock,
} from "./docx-model";

const parse = (markup: string) => new DOMParser().parseFromString(markup, "text/html");
const blocks = (html: string) => htmlToBlocks(html, parse);

describe("safeHref", () => {
  it("keeps the schemes a browser should follow", () => {
    expect(safeHref("https://example.com/a")).toBe("https://example.com/a");
    expect(safeHref("mailto:ada@example.com")).toBe("mailto:ada@example.com");
    expect(safeHref("tel:+441234567890")).toBe("tel:+441234567890");
  });

  it("drops a javascript: URL — the reason links are filtered at all", () => {
    expect(safeHref("javascript:alert(1)")).toBeUndefined();
    expect(safeHref("JavaScript:alert(1)")).toBeUndefined();
  });

  it("drops an internal bookmark, which points at nothing on the host page", () => {
    expect(safeHref("#_Toc12345")).toBeUndefined();
  });

  it("drops an empty or missing href", () => {
    expect(safeHref(null)).toBeUndefined();
    expect(safeHref("")).toBeUndefined();
  });
});

describe("htmlToBlocks", () => {
  it("reads headings at their own level", () => {
    expect(blocks("<h1>Title</h1><h3>Sub</h3>")).toEqual<DocxBlock[]>([
      { type: "heading", level: 1, runs: [{ text: "Title" }] },
      { type: "heading", level: 3, runs: [{ text: "Sub" }] },
    ]);
  });

  it("keeps bold and italic as run styling, not as markup", () => {
    const [paragraph] = blocks(
      "<p>Revenue grew <strong>18%</strong> in a <em>flat</em> market.</p>",
    );
    expect(paragraph).toEqual<DocxBlock>({
      type: "paragraph",
      runs: [
        { text: "Revenue grew " },
        { text: "18%", bold: true },
        { text: " in a " },
        { text: "flat", italic: true },
        { text: " market." },
      ],
    });
  });

  it("merges adjacent runs that look the same", () => {
    const [paragraph] = blocks("<p><span>one </span><span>two</span></p>");
    expect(paragraph).toEqual<DocxBlock>({ type: "paragraph", runs: [{ text: "one two" }] });
  });

  it("carries a safe link on the run and leaves an unsafe one as plain text", () => {
    const [safe] = blocks('<p><a href="https://example.com">Report</a></p>');
    expect(safe).toEqual<DocxBlock>({
      type: "paragraph",
      runs: [{ text: "Report", href: "https://example.com/" }],
    });

    const [unsafe] = blocks('<p><a href="javascript:alert(1)">Click</a></p>');
    expect(unsafe).toEqual<DocxBlock>({ type: "paragraph", runs: [{ text: "Click" }] });
  });

  it("reads both list kinds and flattens a nested list into its own items", () => {
    expect(blocks("<ol><li>One<ul><li>Deeper</li></ul></li><li>Two</li></ol>")).toEqual<
      DocxBlock[]
    >([
      {
        type: "list",
        ordered: true,
        items: [[{ text: "OneDeeper" }], [{ text: "Deeper" }], [{ text: "Two" }]],
      },
    ]);
  });

  it("promotes the first row to a header only when the author marked one", () => {
    expect(blocks("<table><tr><th>Region</th></tr><tr><td>EMEA</td></tr></table>")).toEqual<
      DocxBlock[]
    >([{ type: "table", head: ["Region"], rows: [["EMEA"]] }]);

    // Word emits `<th>` only for a real header row; inventing one would claim
    // structure the document does not have.
    expect(blocks("<table><tr><td>Region</td></tr><tr><td>EMEA</td></tr></table>")).toEqual<
      DocxBlock[]
    >([{ type: "table", rows: [["Region"], ["EMEA"]] }]);
  });

  it("reads an image, and a paragraph that holds only an image IS the image", () => {
    expect(blocks('<p><img src="data:image/png;base64,AAA" alt="A chart" /></p>')).toEqual<
      DocxBlock[]
    >([{ type: "image", src: "data:image/png;base64,AAA", alt: "A chart" }]);
  });

  it("contributes only the TEXT of a tag it does not name — the parse is the allowlist", () => {
    // No `script` block, no markup: the element is not in the walk, so nothing
    // it holds can reach the DOM as anything but characters.
    expect(blocks("<div><p>Kept</p></div>")).toEqual<DocxBlock[]>([
      { type: "paragraph", runs: [{ text: "Kept" }] },
    ]);
    expect(blocks("<script>alert(1)</script>")).toEqual<DocxBlock[]>([]);
  });

  it("drops an empty paragraph rather than rendering a blank line", () => {
    expect(blocks("<p></p><p>   </p>")).toEqual<DocxBlock[]>([]);
  });
});

describe("blocksToText", () => {
  it("projects every block kind into searchable, copyable text", () => {
    const text = blocksToText(
      blocks(
        "<h1>Title</h1><p>Body</p><ul><li>One</li></ul>" +
          "<table><tr><th>Region</th></tr><tr><td>EMEA</td></tr></table>",
      ),
    );
    expect(text).toBe("Title\nBody\n• One\nRegion\nEMEA");
  });
});

describe("blocksToTextWithMap", () => {
  const HTML =
    "<h1>Title</h1><p>Body</p><ul><li>One</li><li>Two</li></ul>" +
    "<table><tr><th>Region</th><th>Revenue</th></tr><tr><td>EMEA</td><td>4.2M</td></tr></table>";

  it("produces the same text `blocksToText` always did", () => {
    // The wrapper is the projection, so a consumer's stored offsets keep
    // meaning what they meant before the index existed.
    const parsed = blocks(HTML);
    expect(blocksToTextWithMap(parsed).text).toBe(blocksToText(parsed));
  });

  it("names the block every stretch of the projection came from", () => {
    const { text, spans } = blocksToTextWithMap(blocks(HTML));
    expect(spans.map((span) => [text.slice(span.start, span.end), span.ref])).toEqual([
      ["Title", { block: 0 }],
      ["Body", { block: 1 }],
      ["• One", { block: 2, item: 0 }],
      ["• Two", { block: 2, item: 1 }],
      ["Region\tRevenue", { block: 3, row: DOCX_HEAD_ROW }],
      ["EMEA\t4.2M", { block: 3, row: 0 }],
    ]);
  });

  it("leaves the separators owned by nobody, so a mark cannot span a joint", () => {
    const { text, spans } = blocksToTextWithMap(blocks(HTML));
    const covered = new Set<number>();
    for (const span of spans) {
      for (let i = span.start; i < span.end; i += 1) covered.add(i);
    }
    const uncovered = [...text].map((char, i) => (covered.has(i) ? "" : char)).join("");
    expect(uncovered).toBe("\n".repeat(spans.length - 1));
  });

  it("skips a table with no rows rather than emitting an empty span", () => {
    const { spans } = blocksToTextWithMap([{ type: "table", rows: [] }]);
    expect(spans).toEqual([]);
  });

  it("contributes nothing for an image, which has no text to address", () => {
    const { text, spans } = blocksToTextWithMap([
      { type: "paragraph", runs: [{ text: "Before" }] },
      { type: "image", src: "data:image/png;base64,AA==", alt: "Chart" },
      { type: "paragraph", runs: [{ text: "After" }] },
    ]);
    expect(text).toBe("Before\nAfter");
    expect(spans.map((span) => span.ref)).toEqual([{ block: 0 }, { block: 2 }]);
  });
});
