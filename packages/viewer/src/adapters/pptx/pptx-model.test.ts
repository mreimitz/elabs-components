import { describe, expect, it } from "vitest";

import {
  notesTarget,
  orderSlidePaths,
  parseNotes,
  parseSlide,
  resolveRelative,
  slideNumber,
  slidesToText,
  slidesToTextWithMap,
  PPTX_NOTES_LINE,
  PPTX_TITLE_LINE,
} from "./pptx-model";

const parse = (xml: string) => new DOMParser().parseFromString(xml, "application/xml");

const P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const A = "http://schemas.openxmlformats.org/drawingml/2006/main";

/** A slide document, written the way PowerPoint writes one. */
const slideXml = (body: string) => `<p:sld xmlns:p="${P}" xmlns:a="${A}">
  <p:cSld><p:spTree>${body}</p:spTree></p:cSld></p:sld>`;

const shape = (placeholder: string | undefined, paragraphs: string) => `<p:sp>
  <p:nvSpPr><p:nvPr>${placeholder ? `<p:ph type="${placeholder}"/>` : ""}</p:nvPr></p:nvSpPr>
  <p:txBody>${paragraphs}</p:txBody></p:sp>`;

const paragraph = (text: string, level?: number) =>
  `<a:p>${level ? `<a:pPr lvl="${String(level)}"/>` : ""}<a:r><a:t>${text}</a:t></a:r></a:p>`;

describe("orderSlidePaths", () => {
  it("orders slides numerically, not the way a zip lists them", () => {
    // "slide10" sorts before "slide2" as a string — the deck would read wrong.
    expect(
      orderSlidePaths(["ppt/slides/slide10.xml", "ppt/slides/slide2.xml", "ppt/slides/slide1.xml"]),
    ).toEqual(["ppt/slides/slide1.xml", "ppt/slides/slide2.xml", "ppt/slides/slide10.xml"]);
  });

  it("ignores every other part of the package", () => {
    expect(
      orderSlidePaths([
        "ppt/slides/slide1.xml",
        "ppt/slides/_rels/slide1.xml.rels",
        "ppt/slideLayouts/slideLayout1.xml",
        "ppt/notesSlides/notesSlide1.xml",
        "[Content_Types].xml",
      ]),
    ).toEqual(["ppt/slides/slide1.xml"]);
  });

  it("reads the slide number out of the part name", () => {
    expect(slideNumber("ppt/slides/slide7.xml")).toBe(7);
    expect(slideNumber("ppt/presentation.xml")).toBe(0);
  });
});

describe("resolveRelative", () => {
  it("walks `..` the way the package expects", () => {
    expect(resolveRelative("ppt/slides/slide1.xml", "../notesSlides/notesSlide1.xml")).toBe(
      "ppt/notesSlides/notesSlide1.xml",
    );
  });

  it("resolves a sibling part and an absolute one", () => {
    expect(resolveRelative("ppt/slides/slide1.xml", "slide2.xml")).toBe("ppt/slides/slide2.xml");
    expect(resolveRelative("ppt/slides/slide1.xml", "/ppt/presentation.xml")).toBe(
      "ppt/presentation.xml",
    );
  });
});

describe("notesTarget", () => {
  const rels = (body: string) =>
    parse(
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${body}</Relationships>`,
    );
  const type = (name: string) =>
    `http://schemas.openxmlformats.org/officeDocument/2006/relationships/${name}`;

  it("follows the slide's own relationship rather than matching slide numbers", () => {
    // Slide 1 pointing at notesSlide4 is what a deck looks like after slides
    // have been deleted — matching by number would attach the wrong notes.
    const document = rels(
      `<Relationship Id="rId1" Type="${type("slideLayout")}" Target="../slideLayouts/slideLayout1.xml"/>
       <Relationship Id="rId2" Type="${type("notesSlide")}" Target="../notesSlides/notesSlide4.xml"/>`,
    );
    expect(notesTarget(document, "ppt/slides/slide1.xml")).toBe("ppt/notesSlides/notesSlide4.xml");
  });

  it("returns nothing for a slide with no notes", () => {
    const document = rels(
      `<Relationship Id="rId1" Type="${type("slideLayout")}" Target="../slideLayouts/slideLayout1.xml"/>`,
    );
    expect(notesTarget(document, "ppt/slides/slide1.xml")).toBeUndefined();
  });
});

describe("parseSlide", () => {
  it("separates the title placeholder from the body text", () => {
    const slide = parseSlide(
      parse(
        slideXml(
          shape("title", paragraph("Quarterly review")) +
            shape("body", paragraph("Revenue grew 18%") + paragraph("EMEA beat plan", 1)),
        ),
      ),
      1,
    );
    expect(slide.title).toBe("Quarterly review");
    expect(slide.lines).toEqual([
      { text: "Revenue grew 18%", level: 0 },
      { text: "EMEA beat plan", level: 1 },
    ]);
  });

  it("treats a centred title as a title", () => {
    const slide = parseSlide(parse(slideXml(shape("ctrTitle", paragraph("Cover")))), 1);
    expect(slide.title).toBe("Cover");
  });

  it("keeps a shape with no placeholder as body text", () => {
    const slide = parseSlide(parse(slideXml(shape(undefined, paragraph("A loose text box")))), 1);
    expect(slide.title).toBeUndefined();
    expect(slide.lines).toEqual([{ text: "A loose text box", level: 0 }]);
  });

  it("reads a table on the slide, one row per line", () => {
    const table = `<p:graphicFrame><a:graphic><a:graphicData><a:tbl>
      <a:tr><a:tc><a:txBody><a:p><a:r><a:t>Region</a:t></a:r></a:p></a:txBody></a:tc>
            <a:tc><a:txBody><a:p><a:r><a:t>Revenue</a:t></a:r></a:p></a:txBody></a:tc></a:tr>
    </a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
    const slide = parseSlide(parse(slideXml(table)), 2);
    expect(slide.lines).toEqual([{ text: "Region\tRevenue", level: 0 }]);
  });

  it("drops empty paragraphs — a blank placeholder is not a bullet", () => {
    const slide = parseSlide(parse(slideXml(shape("body", "<a:p/>" + paragraph("Real")))), 1);
    expect(slide.lines).toEqual([{ text: "Real", level: 0 }]);
  });

  it("returns an empty slide rather than throwing when there is no shape tree", () => {
    expect(parseSlide(parse(`<p:sld xmlns:p="${P}"/>`), 3)).toEqual({ index: 3, lines: [] });
  });
});

describe("parseNotes", () => {
  it("reads only the notes placeholder, not the copy of the slide beside it", () => {
    const notes = parseNotes(
      parse(
        `<p:notes xmlns:p="${P}" xmlns:a="${A}"><p:cSld><p:spTree>` +
          shape("sldImg", paragraph("Quarterly review")) +
          shape("body", paragraph("Open with the revenue number.")) +
          `</p:spTree></p:cSld></p:notes>`,
      ),
    );
    expect(notes).toBe("Open with the revenue number.");
  });

  it("returns nothing when the notes part holds no notes", () => {
    expect(parseNotes(parse(`<p:notes xmlns:p="${P}"/>`))).toBeUndefined();
  });
});

describe("slidesToText", () => {
  it("projects titles, lines and notes into one searchable string", () => {
    expect(
      slidesToText([
        { index: 1, title: "Quarterly review", lines: [{ text: "Revenue grew 18%", level: 0 }] },
        { index: 2, title: "Regions", lines: [], notes: "Hand over to Sam." },
      ]),
    ).toBe("Quarterly review\nRevenue grew 18%\n\nRegions\nHand over to Sam.");
  });
});

describe("slidesToTextWithMap", () => {
  it("maps every chunk back to the slide and line it came from", () => {
    const { text, spans } = slidesToTextWithMap([
      {
        index: 1,
        title: "Quarterly review",
        lines: [
          { text: "Revenue grew 18%", level: 0 },
          { text: "EMEA beat plan", level: 1 },
        ],
        notes: "Hand over to Sam.",
      },
      { index: 2, title: "Regions", lines: [] },
    ]);

    expect(spans.map((span) => [text.slice(span.start, span.end), span.ref])).toEqual([
      ["Quarterly review", { slide: 1, line: PPTX_TITLE_LINE }],
      ["Revenue grew 18%", { slide: 1, line: 0 }],
      ["EMEA beat plan", { slide: 1, line: 1 }],
      ["Hand over to Sam.", { slide: 1, line: PPTX_NOTES_LINE }],
      ["Regions", { slide: 2, line: PPTX_TITLE_LINE }],
    ]);
  });

  it("refs the slide's own number, not its position, so a gap cannot misattribute", () => {
    const { spans } = slidesToTextWithMap([{ index: 7, lines: [{ text: "Only line", level: 0 }] }]);
    expect(spans[0]?.ref).toEqual({ slide: 7, line: 0 });
  });

  it("is the one definition of the projection", () => {
    const slides = [{ index: 1, title: "A", lines: [], notes: "B" }];
    expect(slidesToText(slides)).toBe(slidesToTextWithMap(slides).text);
  });

  it("contributes nothing for a slide with no text at all", () => {
    const { text, spans } = slidesToTextWithMap([
      { index: 1, title: "A", lines: [] },
      { index: 2, lines: [] },
      { index: 3, title: "C", lines: [] },
    ]);
    expect(text).toBe("A\n\nC");
    expect(spans.map((span) => span.ref.slide)).toEqual([1, 3]);
  });
});
