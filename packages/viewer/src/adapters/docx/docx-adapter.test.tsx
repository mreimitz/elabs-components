import { normalizeFileSource } from "@elabs/components-ui";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ResolvedHighlight } from "../../core/highlight";
import { SAMPLE_DOCX_BASE64 } from "../office-fixture";
import docxModule, { type DocxDocument } from "./docx-adapter";

const MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function fixtureSource(name = "review.docx") {
  const bytes = Uint8Array.from(atob(SAMPLE_DOCX_BASE64), (char) => char.charCodeAt(0));
  return normalizeFileSource({
    kind: "buffer",
    buffer: bytes.buffer as ArrayBuffer,
    name,
    mediaType: MEDIA_TYPE,
  });
}

const load = () => docxModule.create().load(fixtureSource(), {}) as Promise<DocxDocument>;

describe("docx adapter — a real Word file through mammoth", () => {
  it("reads the document's structure, not a wall of text", async () => {
    const doc = await load();
    expect(doc.blocks).toContainEqual({
      type: "heading",
      level: 1,
      runs: [{ text: "Quarterly review" }],
    });
    expect(doc.blocks).toContainEqual({
      type: "list",
      ordered: false,
      items: [[{ text: "EMEA beat plan" }], [{ text: "APAC held flat" }]],
    });
    expect(doc.blocks.some((block) => block.type === "table")).toBe(true);
  });

  it("keeps Word's emphasis as run styling", async () => {
    const doc = await load();
    const paragraph = doc.blocks.find((block) => block.type === "paragraph");
    expect(paragraph).toEqual({
      type: "paragraph",
      runs: [
        { text: "Revenue grew " },
        { text: "18%", bold: true },
        { text: " against a " },
        { text: "flat", italic: true },
        { text: " market." },
      ],
    });
  });

  it("exposes a plain-text projection for search and copy", async () => {
    const doc = await load();
    expect(doc.text).toContain("Quarterly review");
    expect(doc.text).toContain("• EMEA beat plan");
  });

  it("reports a file that is not a Word document as parse-failed, not as a crash", async () => {
    const source = normalizeFileSource({
      kind: "text",
      text: "not a zip",
      name: "broken.docx",
      mediaType: MEDIA_TYPE,
    });
    await expect(docxModule.create().load(source, {})).rejects.toMatchObject({
      code: "parse-failed",
    });
  });
});

describe("docx renderer", () => {
  it("draws the document with real headings, lists and links", async () => {
    const doc = await load();
    render(<docxModule.Renderer document={doc} source={fixtureSource()} />);

    // Offset by the default base: Word's "Heading 1" is the top of THAT
    // document, so it renders at h2 and leaves the host page's h1 alone.
    expect(screen.getByRole("heading", { level: 2, name: "Quarterly review" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Regions" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "EMEA beat plan",
      "APAC held flat",
    ]);
    // A real anchor, so it is reachable by keyboard and by a links list.
    expect(screen.getByRole("link", { name: "Full report" })).toHaveAttribute(
      "href",
      "https://example.com/report",
    );
  });

  it("puts the document's own top heading where the host asks", async () => {
    const doc = await load();
    render(<docxModule.Renderer document={doc} source={fixtureSource()} baseHeadingLevel={1} />);
    expect(screen.getByRole("heading", { level: 1, name: "Quarterly review" })).toBeInTheDocument();
  });

  it("renders a Word table as a real table", async () => {
    const doc = await load();
    render(<docxModule.Renderer document={doc} source={fixtureSource()} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "4.2M" })).toBeInTheDocument();
  });

  it("says so when a document has no text, instead of rendering an empty pane", () => {
    const empty: DocxDocument = { kind: "docx", blocks: [], warnings: [], text: "" };
    render(<docxModule.Renderer document={empty} source={fixtureSource()} />);
    expect(screen.getByText("This document has no text")).toBeInTheDocument();
  });
});

describe("docx renderer — highlighting", () => {
  const cite = (id: string, range: [number, number], active = false): ResolvedHighlight => ({
    id,
    source: "citation",
    status: "resolved",
    address: { kind: "range", start: range[0], end: range[1] },
    active,
    range,
  });

  /** Offsets of a passage in the document's own projection. */
  const rangeOf = (doc: DocxDocument, passage: string): [number, number] => {
    const start = doc.text?.indexOf(passage) ?? -1;
    expect(start).toBeGreaterThanOrEqual(0);
    return [start, start + passage.length];
  };

  const renderWith = async (highlights: ResolvedHighlight[], activeHighlightId?: string) => {
    const doc = await load();
    const result = render(
      <docxModule.Renderer
        document={doc}
        source={fixtureSource()}
        highlights={highlights}
        activeHighlightId={activeHighlightId}
      />,
    );
    return { doc, ...result };
  };

  it("declares the address kinds it can actually honour", () => {
    expect(docxModule.manifest.capabilities?.highlight).toEqual(["quote", "range"]);
  });

  it("marks a passage inside a paragraph, in the block it came from", async () => {
    const doc = await load();
    const { container } = await renderWith([cite("a", rangeOf(doc, "against a"))]);
    const marks = Array.from(container.querySelectorAll("mark"));
    expect(marks.map((mark) => mark.textContent).join("")).toBe("against a");
    // The paragraph still reads whole — marking wraps, it does not replace.
    expect(container.textContent).toContain("Revenue grew 18% against a flat market.");
  });

  it("marks across run styling without flattening it", async () => {
    const doc = await load();
    const { container } = await renderWith([cite("a", rangeOf(doc, "grew 18% against"))]);
    const marks = Array.from(container.querySelectorAll("mark"));
    expect(marks.map((mark) => mark.textContent).join("")).toBe("grew 18% against");
    // The bold run is still bold underneath the mark.
    expect(container.querySelector("strong")?.textContent).toBe("18%");
  });

  it("marks a list item past its bullet, which is drawn by the list, not the text", async () => {
    const doc = await load();
    const { container } = await renderWith([cite("a", rangeOf(doc, "EMEA beat"))]);
    const mark = container.querySelector("mark");
    expect(mark?.textContent).toBe("EMEA beat");
    expect(mark?.closest("li")?.textContent).toBe("EMEA beat plan");
  });

  it("marks one table cell, not the whole row it shares a span with", async () => {
    const doc = await load();
    const { container } = await renderWith([cite("a", rangeOf(doc, "4.2M"))]);
    const marks = Array.from(container.querySelectorAll("mark"));
    expect(marks).toHaveLength(1);
    expect(marks[0]?.closest("td")?.textContent).toBe("4.2M");
  });

  it("flags the current passage for assistive tech, not by colour alone", async () => {
    const doc = await load();
    const { container } = await renderWith([cite("a", rangeOf(doc, "flat"), true)], "a");
    const active = container.querySelector('mark[data-active][data-slot="match-highlight-mark"]');
    expect(active?.getAttribute("aria-current")).toBe("true");
  });

  it("draws nothing when no highlight is passed", async () => {
    const { container } = await renderWith([]);
    expect(container.querySelectorAll("mark")).toHaveLength(0);
  });
});
