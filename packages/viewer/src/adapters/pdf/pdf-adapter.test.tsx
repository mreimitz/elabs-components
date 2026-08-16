import { render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { ResolvedHighlight } from "../../core/highlight";
import { createTextIndexBuilder } from "../../core/text-index";
import type { AdapterRendererProps } from "../../core/types";
import adapterModule, { toTextSpans } from "./pdf-adapter";
import { openPdfDocument as openPdfDocumentImpl } from "./pdf-engine";
import type { PdfDocument, PdfPage, PdfSession, PdfTextItem } from "./pdf-engine";
import { PDF_PAGE_SEPARATOR, pageTextChunk } from "./pdf-text";

// The engine itself is exercised in the browser (the story opens a real PDF);
// here it is stubbed so the adapter's OWN contract — page count, text, dispose,
// error mapping — can be asserted without a worker or a canvas.
vi.mock("./pdf-engine", () => ({ openPdfDocument: vi.fn() }));
const openPdfDocument = vi.mocked(openPdfDocumentImpl);

/**
 * A stand-in for a pdf.js document.
 *
 * jsdom has no 2D canvas context, so the renderer's raster path bails early by
 * design — which is exactly what lets the page and zoom wiring be tested here.
 * The raster itself is verified in the browser, by the story.
 *
 * It carries NO `destroy` on purpose: the real `PDFDocumentProxy` has none
 * (pdf.js removed it in v5, and the worker belongs to the loading task). A stub
 * that offered one is precisely what let `dispose()` ship broken — it threw a
 * `TypeError` on every real unmount and leaked a worker per file opened, while
 * this suite stayed green.
 */
function fakeHandle(numPages = 3, pages: PdfTextItem[][] = []): PdfDocument {
  const pageFor = (pageNumber: number): PdfPage => ({
    getViewport: ({ scale }) => ({ width: 612 * scale, height: 792 * scale }),
    render: () => ({ promise: Promise.resolve(), cancel: () => undefined }),
    getTextContent: () => Promise.resolve({ items: pages[pageNumber - 1] ?? [] }),
    cleanup: () => undefined,
  });
  return {
    numPages,
    getPage: (pageNumber) => Promise.resolve(pageFor(pageNumber)),
  };
}

/** What `openPdfDocument` actually resolves to: the document plus its teardown. */
function fakeSession(document: PdfDocument): PdfSession {
  return { document, destroy: () => Promise.resolve() };
}

const SOURCE = {
  name: "report.pdf",
  mediaType: "application/pdf",
  category: "document",
  extension: "pdf",
  bytes: () => Promise.resolve(new ArrayBuffer(0)),
  text: () => Promise.resolve(""),
  url: () => Promise.resolve("blob:report"),
  revoke: () => undefined,
} as unknown as AdapterRendererProps["source"];

/** US Letter at 72dpi — what `fakeHandle`'s viewport reports at scale 1. */
const LETTER = { width: 612, height: 792 };

/** One page's slot in the scrolling column: the page, its border, and the gap. */
const SLOT_HEIGHT = 792 + 2 + 16;

function renderPdf(numPages = 3, props: Partial<AdapterRendererProps> = {}) {
  const document = {
    kind: "pdf" as const,
    handle: fakeHandle(numPages),
    pageCount: numPages,
    // What the loader captures while extracting text. Present here so the
    // column's reserved height is a real number rather than the fallback.
    pageSizes: Array.from({ length: numPages }, () => LETTER),
  };
  const { Renderer } = adapterModule;
  return render(<Renderer document={document} source={SOURCE} {...props} />);
}

/** Where the column was asked to scroll to, in CSS pixels. */
function scrolledTo(scrollTo: ReturnType<typeof vi.fn>): number | undefined {
  const last = scrollTo.mock.calls.at(-1)?.[0] as { top?: number } | undefined;
  return last?.top;
}

/** Every mounted page, in document order. */
const pages = () => globalThis.document.querySelectorAll('[data-slot="pdf-page"]');

// jsdom has no 2D context and logs a "Not implemented" stack every time one is
// asked for. Returning null is the same answer, without burying the run in noise
// — and it is the code path the renderer is written to survive.
let getContext: ReturnType<typeof vi.spyOn>;

// jsdom implements no scrolling whatsoever, so the programmatic scroll is the
// only observable half of "take me to page N" here. What the reader then sees —
// the pages that mount, the pager following the gesture back — is browser
// behaviour, and the story is what verifies it.
const scrollTo = vi.fn();

beforeAll(() => {
  getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext") as typeof getContext;
  getContext.mockReturnValue(null);
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    writable: true,
    value: scrollTo,
  });
});

beforeEach(() => {
  scrollTo.mockClear();
});

describe("pdf renderer — page and zoom are the shell's, not the adapter's", () => {
  it("names the page for assistive tech instead of exposing a bare canvas", async () => {
    renderPdf();
    expect(await screen.findByRole("img", { name: "Page 1" })).toBeInTheDocument();
  });

  it("stacks the pages — a document scrolls, it does not flip", async () => {
    // The headline of continuous scroll: page 2 is already there, one gesture
    // below page 1, rather than behind a "next" button that swaps the canvas.
    renderPdf(3);
    expect(await screen.findByRole("img", { name: "Page 1" })).toBeInTheDocument();
    expect(await screen.findByRole("img", { name: "Page 2" })).toBeInTheDocument();
  });

  it("reserves the whole document's height, so the scrollbar never lies", () => {
    // Sized from `pageSizes` rather than from what has rendered, so the thumb
    // does not shrink page by page as a long file streams in.
    const { container } = renderPdf(3);
    const column = container.querySelector('[data-slot="pdf-pages"]') as HTMLElement;
    expect(column.style.height).toBe(`${3 * SLOT_HEIGHT}px`);
  });

  it("mounts a window, not the document — a long file costs what is on screen", async () => {
    // 200 pages is 200 canvases and 200 rasterization jobs if the column is a
    // plain stack. The cost has to follow the viewport, not the page count.
    renderPdf(200);
    await screen.findByRole("img", { name: "Page 1" });
    expect(pages().length).toBeLessThan(10);
    expect(screen.queryByRole("img", { name: "Page 60" })).not.toBeInTheDocument();
  });

  it("draws no chrome of its own — the pager lives in the shell (ADR 0026)", () => {
    renderPdf();
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next page" })).not.toBeInTheDocument();
  });

  it("scrolls to the page the shell asked for, including on the very first frame", async () => {
    // A deep link mounts already pointing at page 3. Nothing has scrolled yet,
    // so the request has to survive mount rather than be answered with "you are
    // on page 1".
    renderPdf(3, { pageNumber: 3 });
    await waitFor(() => expect(scrolledTo(scrollTo)).toBe(2 * SLOT_HEIGHT));
  });

  it("clamps a page number past the end of the document", async () => {
    // A stale deep link ("page 9 of a 3-page file") lands on the last page
    // rather than scrolling past the end — the shell may be driven by a URL
    // nobody validated.
    renderPdf(3, { pageNumber: 9 });
    await waitFor(() => expect(scrolledTo(scrollTo)).toBe(2 * SLOT_HEIGHT));
  });

  it("pages itself when it is mounted outside a provider", async () => {
    // A `Renderer` used directly still has to be usable, so the page control is
    // the controlled/uncontrolled trio, not a required prop.
    const onPageChange = vi.fn();
    renderPdf(3, { onPageChange });
    expect(await screen.findByRole("img", { name: "Page 1" })).toBeInTheDocument();
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("reports the scale it resolved, so the shell can show a percentage", async () => {
    const onZoomResolved = vi.fn();
    renderPdf(1, { zoom: 2, onZoomResolved });
    await waitFor(() => expect(onZoomResolved).toHaveBeenCalledWith(2));
  });

  it("falls back to 100% while a fit mode has nothing to measure against", async () => {
    // jsdom reports every box as 0×0, which is exactly the "hidden element"
    // case the measurement guard exists for: a fit that cannot be computed must
    // not resolve to 0 and blank the page.
    const onZoomResolved = vi.fn();
    renderPdf(1, { zoom: "fit-width", onZoomResolved });
    await waitFor(() => expect(onZoomResolved).toHaveBeenCalledWith(1));
  });
});

describe("pdf adapter — load and dispose", () => {
  it("reports the page count and extracts text, then releases the worker", async () => {
    const handle = fakeHandle(4);
    const session = fakeSession(handle);
    const destroy = vi.spyOn(session, "destroy");
    vi.spyOn(handle, "getPage").mockResolvedValue({
      getViewport: ({ scale }) => ({ width: 612 * scale, height: 792 * scale }),
      render: () => ({ promise: Promise.resolve(), cancel: () => undefined }),
      getTextContent: () =>
        Promise.resolve({ items: [{ str: "Hello", transform: [], width: 0, height: 0 }] }),
      cleanup: () => undefined,
    });
    openPdfDocument.mockResolvedValue(session);

    const adapter = adapterModule.create();
    const document = await adapter.load(
      {
        name: "report.pdf",
        bytes: () => Promise.resolve(new ArrayBuffer(8)),
      } as unknown as AdapterRendererProps["source"],
      {},
    );

    expect(document.pageCount).toBe(4);
    expect(document.text).toContain("Hello");

    // A leaked pdf.js worker per opened document is minutes away from a
    // browsing session that grinds to a halt. The teardown must go through the
    // SESSION: the document proxy has no `destroy`, so reaching for one there
    // throws a TypeError inside an unmount and releases nothing.
    expect((handle as { destroy?: unknown }).destroy).toBeUndefined();
    expect(() => adapter.dispose?.()).not.toThrow();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("reports a corrupt file as parse-failed, not as a crash", async () => {
    openPdfDocument.mockRejectedValue(new Error("Invalid PDF structure."));
    const adapter = adapterModule.create();

    await expect(
      adapter.load(
        {
          name: "broken.pdf",
          bytes: () => Promise.resolve(new ArrayBuffer(8)),
        } as unknown as AdapterRendererProps["source"],
        {},
      ),
    ).rejects.toMatchObject({ code: "parse-failed" });
  });
});

describe("toTextSpans", () => {
  it("flips the PDF origin so text lands over the raster", () => {
    // PDF user space measures from the BOTTOM-left; CSS from the top. A glyph
    // 700 units up a 792-tall page sits 92 - fontSize from the top.
    const [span] = toTextSpans(
      [{ str: "Hello", transform: [12, 0, 0, 12, 72, 700], width: 30 }],
      792,
      1,
    );
    expect(span).toEqual({
      text: "Hello",
      left: 72,
      top: 792 - 700 - 12,
      width: 30,
      fontSize: 12,
      item: 0,
    });
  });

  it("scales geometry with the zoom level", () => {
    const [span] = toTextSpans(
      [{ str: "Hello", transform: [12, 0, 0, 12, 72, 700], width: 30 }],
      1584,
      2,
    );
    expect(span?.left).toBe(144);
    expect(span?.fontSize).toBe(24);
    expect(span?.width).toBe(60);
  });

  it("drops whitespace-only items — they would be invisible clutter in the DOM", () => {
    expect(toTextSpans([{ str: "   ", transform: [12, 0, 0, 12, 0, 0] }], 792, 1)).toEqual([]);
  });

  it("carries the item's original index, so a dropped item cannot shift the rest", () => {
    const spans = toTextSpans(
      [
        { str: " ", transform: [12, 0, 0, 12, 0, 0] },
        { str: "Hello", transform: [12, 0, 0, 12, 72, 700] },
      ],
      792,
      1,
    );
    // Position 0 in the rendered spans, but item 1 in the projection.
    expect(spans[0]?.item).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/* Highlights                                                                  */
/* -------------------------------------------------------------------------- */

const PAGE_ONE: PdfTextItem[] = [
  { str: "Alpha", transform: [12, 0, 0, 12, 72, 700], width: 40, height: 12 },
  { str: "Beta", transform: [12, 0, 0, 12, 72, 680], width: 32, height: 12 },
];
const PAGE_TWO: PdfTextItem[] = [
  { str: "Gamma", transform: [12, 0, 0, 12, 72, 700], width: 48, height: 12 },
];

/** The projection the loader would have built from those pages. */
function projection() {
  const builder = createTextIndexBuilder<number>({ separator: PDF_PAGE_SEPARATOR });
  builder.push(pageTextChunk(PAGE_ONE).text, 1);
  builder.push(pageTextChunk(PAGE_TWO).text, 2);
  return builder.build();
}

/**
 * The renderer under a stand-in for `FileViewerProvider`.
 *
 * Page state lives in the shell now, so "turns to the cited page" is only a
 * real assertion if something up here actually holds it. This harness is the
 * smallest thing that does what the provider does — hold the number, feed it
 * back down — plus a spy, so the request itself can be asserted as well as its
 * effect.
 */
function Harness({
  highlights,
  activeHighlightId,
  onPageChange,
}: {
  highlights: ResolvedHighlight[];
  activeHighlightId?: string;
  onPageChange?: (page: number) => void;
}) {
  // Built once: a fresh document identity per render would restart every effect
  // the renderer keys on `handle`.
  const [document] = useState(() => {
    const textIndex = projection();
    return {
      kind: "pdf" as const,
      handle: fakeHandle(2, [PAGE_ONE, PAGE_TWO]),
      pageCount: 2,
      text: textIndex.text,
      textIndex,
    };
  });
  const [page, setPage] = useState(1);
  const { Renderer } = adapterModule;
  return (
    <Renderer
      document={document}
      source={SOURCE}
      highlights={highlights}
      activeHighlightId={activeHighlightId}
      pageNumber={page}
      onPageChange={(next) => {
        setPage(next);
        onPageChange?.(next);
      }}
    />
  );
}

function renderHighlighted(
  highlights: ResolvedHighlight[],
  activeHighlightId?: string,
  onPageChange?: (page: number) => void,
) {
  return render(
    <Harness
      highlights={highlights}
      activeHighlightId={activeHighlightId}
      onPageChange={onPageChange}
    />,
  );
}

const boxes = () => globalThis.document.querySelectorAll('[data-slot="highlight-rect"]');

describe("pdf renderer — highlights", () => {
  // The raster path needs a 2D context to get as far as the text layer; jsdom
  // has none, so a bare object stands in for it. Nothing here draws pixels — it
  // is the geometry that is under test.
  beforeEach(() => {
    getContext.mockReturnValue({} as unknown as CanvasRenderingContext2D);
  });
  afterAll(() => {
    getContext.mockReturnValue(null);
  });

  it("paints a box over the passage a `range` address located", async () => {
    // "Beta" — the second item of page 1, at offsets 6–10.
    renderHighlighted([
      {
        id: "c1",
        source: "citation",
        status: "resolved",
        address: { kind: "range", start: 6, end: 10 },
        range: [6, 10],
        active: false,
      },
    ]);

    await waitFor(() => expect(boxes()).toHaveLength(1));
    // 792 - 680 - 12 from the top, at the item's own left edge and width.
    expect((boxes()[0] as HTMLElement).style.left).toBe("72px");
    expect((boxes()[0] as HTMLElement).style.width).toBe("32px");
  });

  it("paints a `rect` address with no text involved at all", async () => {
    renderHighlighted([
      {
        id: "c1",
        source: "citation",
        status: "resolved",
        address: { kind: "rect", page: 1, rects: [{ x: 0.5, y: 0.25, width: 0.25, height: 0.1 }] },
        rects: [{ x: 0.5, y: 0.25, width: 0.25, height: 0.1 }],
        page: 1,
        active: true,
      },
    ]);

    await waitFor(() => expect(boxes()).toHaveLength(1));
    const box = boxes()[0] as HTMLElement;
    // Fractions of the 612 × 792 page, so the same address survives a zoom.
    expect(box.style.left).toBe("306px");
    expect(box.style.top).toBe("198px");
    // Presence form, the same shape every other painter emits, so one selector
    // finds the current highlight regardless of who drew it.
    expect(box).toHaveAttribute("data-active", "");
  });

  it("keeps a rect on the page it belongs to", async () => {
    renderHighlighted([
      {
        id: "c1",
        source: "citation",
        status: "resolved",
        address: { kind: "rect", page: 2, rects: [{ x: 0, y: 0, width: 1, height: 0.1 }] },
        rects: [{ x: 0, y: 0, width: 1, height: 0.1 }],
        page: 2,
        active: false,
      },
    ]);

    await screen.findByRole("img", { name: "Page 1" });
    await waitFor(() => expect(boxes()).toHaveLength(1));
    // Both pages are mounted at once under continuous scroll, so "on page 2" is
    // a claim about WHERE the box is drawn — not about how few exist.
    expect(boxes()[0]?.closest('[data-slot="pdf-page"]')).toHaveAttribute("data-page", "2");
  });

  it("asks the shell to turn to the page the active citation is on", async () => {
    // "Gamma" lives on page 2, at offsets 12–17 of the projection.
    const onPageChange = vi.fn();
    renderHighlighted(
      [
        {
          id: "c1",
          source: "citation",
          status: "resolved",
          address: { kind: "range", start: 12, end: 17 },
          range: [12, 17],
          active: true,
        },
      ],
      "c1",
      onPageChange,
    );

    // The renderer no longer owns the pager, so "navigate first" is a REQUEST
    // it makes — and the mark only paints once the shell honours it.
    await waitFor(() => expect(onPageChange).toHaveBeenCalledWith(2));
    expect(await screen.findByRole("img", { name: "Page 2" })).toBeInTheDocument();
    await waitFor(() => expect(boxes()).toHaveLength(1));
  });

  it("keeps the boxes out of the accessibility tree — the text layer has the words", async () => {
    const { container } = renderHighlighted([
      {
        id: "c1",
        source: "citation",
        status: "resolved",
        address: { kind: "range", start: 0, end: 5 },
        range: [0, 5],
        active: false,
      },
    ]);

    await waitFor(() => expect(boxes()).toHaveLength(1));
    expect(container.querySelector('[aria-hidden="true"] [data-slot="highlight-rect"]')).not.toBe(
      null,
    );
  });
});
