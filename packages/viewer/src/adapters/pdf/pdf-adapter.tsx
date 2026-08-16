"use client";

/**
 * PDF adapter — the format nothing in this repo could open before.
 *
 * ## Why this one renders a canvas, and why that is not a rule break
 *
 * "Adapters emit data, never HTML" is about CHROME: an adapter may not smuggle
 * colours, fonts or borders past the token layer. A PDF page's pixels ARE the
 * document — a PDF is a description of marks on a page, and reproducing it is
 * the whole job. So the page is rasterized to a `<canvas>` in the file's own
 * colours, while everything AROUND it (the pager, the zoom control, the page
 * frame, the loading and error states) is brand-ui components on tokens.
 *
 * ## The text layer
 *
 * A canvas has no text, so a canvas-only PDF viewer is unusable: nothing to
 * select, copy, search or read aloud. pdf.js exposes the text with per-item
 * transforms, so we position transparent spans over the page. That is the same
 * approach pdf.js's own viewer takes, and it is what makes the page selectable
 * and reachable by a screen reader.
 *
 * ## Highlights are boxes, not marks
 *
 * Every other text adapter paints a `<mark>` around the cited characters. There
 * is no text to wrap here — the words are pixels — so a citation is a rectangle
 * over the raster, positioned from the page's own geometry (`pdf-text.ts`). The
 * same layer draws a `rect` address, which is why this is the one adapter that
 * can honour geometry a text pipeline never produced.
 *
 * ## The chrome is not here
 *
 * The pager and the zoom control used to live in this file, over `useState` no
 * one outside the canvas could reach. They are now shell parts over provider
 * state (ADR 0026): this renderer draws the page it is TOLD to, at the scale it
 * is told to, and reports back what a fit mode resolved to. It keeps its own
 * page only when mounted outside a provider.
 *
 * ## Pages scroll; they are not flipped
 *
 * The document is one continuous column of pages, virtualized over the shell's
 * viewport (`usePagedScroll`). A pager that replaced the canvas made a PDF the
 * only thing in the app you could not simply scroll, and it broke the two
 * gestures readers actually use — skimming, and dragging the scrollbar to
 * "about two thirds in". The page number is now a consequence of where the
 * reader is, and typing one is a scroll.
 */

import {
  cn,
  StatePanel,
  useLocale,
  type ResolvedFileSource,
} from "@qlik-coe-emea/qlabs-components-ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { toViewerError } from "../../core/errors";
import type { ResolvedHighlight } from "../../core/highlight";
import { toMarkRanges, type MarkRanges } from "../../core/highlight-marks";
import { createTextIndexBuilder, type TextIndex } from "../../core/text-index";
import { useScrollActiveHighlightIntoView } from "../../core/use-highlight-scroll";
import { usePageControl } from "../../core/use-page-control";
import { usePagedScroll } from "../../core/use-paged-scroll";
import { useViewportSize } from "../../core/use-viewport-size";
import type {
  AdapterDocument,
  AdapterLoadContext,
  AdapterModule,
  AdapterRendererProps,
  FileAdapter,
  PageSize,
} from "../../core/types";
import { DEFAULT_ZOOM } from "../../core/zoom";
import {
  openPdfDocument,
  type PdfDocument,
  type PdfPage,
  type PdfSession,
  type PdfTextItem,
} from "./pdf-engine";
import { pdfManifest } from "./pdf-manifest";
import {
  PDF_PAGE_SEPARATOR,
  pageOfHighlight,
  pageTextChunk,
  rangeBoxes,
  rectBoxes,
  type PdfHighlightBox,
  type PdfTextSpan,
} from "./pdf-text";

/**
 * Breathing room kept around a fitted page, in CSS pixels.
 *
 * Without it a fit-to-width page is exactly as wide as the viewport, and the
 * page frame's own 1px border tips it over into a horizontal scrollbar — which
 * narrows the viewport, which re-fits smaller, which removes the scrollbar.
 */
const FIT_GUTTER = 16;

/** Sanity bounds on a fitted scale, so a degenerate measurement cannot blank the page. */
const MIN_SCALE = 0.1;
const MAX_SCALE = 10;

/**
 * Pages whose text is extracted for the plain-text projection.
 *
 * Extraction costs one worker round-trip per page, so doing it for a 900-page
 * document at load time would stall the first paint for something most readers
 * never use. The pages a reader actually looks at get their text layer rendered
 * on demand regardless — this cap only bounds the eager `document.text`.
 */
export const PDF_TEXT_PAGE_LIMIT = 50;

export interface PdfViewerDocument extends AdapterDocument {
  kind: "pdf";
  /** The live pdf.js handle. Owned by the adapter — the renderer only reads it. */
  handle: PdfDocument;
  pageCount: number;
  /** Page number per stretch of the projection, so a citation can turn the page. */
  textIndex?: TextIndex<number>;
}

/** Vertical space between two pages in the scrolling column, in CSS pixels. */
const PAGE_GAP = 16;

/** The page frame's own 1px border, top and bottom — part of the reserved height. */
const PAGE_BORDER = 2;

/**
 * Height assumed for a page whose size was never measured, in CSS pixels.
 *
 * Only reached by a document with no extractable page at all; every real one
 * contributes at least page 1 to `pageSizes`. US Letter at 96dpi.
 */
const FALLBACK_PAGE_HEIGHT = 1056;

class PdfAdapter implements FileAdapter {
  #session?: PdfSession;

  async load(source: ResolvedFileSource, context: AdapterLoadContext): Promise<PdfViewerDocument> {
    let buffer: ArrayBuffer;
    try {
      buffer = await source.bytes(context.signal);
    } catch (error) {
      throw toViewerError(error, "read-failed", { fileName: source.name });
    }

    try {
      // pdf.js takes ownership of the buffer it is handed (it transfers it to
      // the worker), so the view is built here rather than reusing the source's
      // memoized copy in place.
      const session = await openPdfDocument(new Uint8Array(buffer), context.signal);
      this.#session = session;
      const handle = session.document;
      const { textIndex, pageSizes } = await extractText(handle, context.signal);
      return {
        kind: "pdf",
        handle,
        pageCount: handle.numPages,
        pageSizes,
        text: textIndex?.text,
        textIndex,
        // So a passage the shell cannot find in a 900-page report reads as "past
        // the pages we extracted" rather than "not in this document".
        textTruncated: handle.numPages > PDF_TEXT_PAGE_LIMIT || undefined,
      };
    } catch (error) {
      // A password-protected or corrupt file lands here; the engine failing to
      // resolve is caught upstream and becomes `parser-missing`.
      throw toViewerError(error, "parse-failed", { fileName: source.name });
    }
  }

  dispose(): void {
    // Tears down the worker and its transferred buffers. Skipping this leaks a
    // worker per document opened, which a file browser hits within minutes.
    // The teardown lives on the SESSION, not on the document — see `PdfSession`.
    void this.#session?.destroy();
    this.#session = undefined;
  }
}

/**
 * Best-effort plain text, plus the page each stretch of it came from — and each
 * page's size, which the same loop already has in hand.
 *
 * Never throws: a document whose text will not extract still renders — the
 * reader loses search and citations, not the file. Whatever was extracted before
 * the failure is kept, because half a projection still answers half the queries.
 *
 * The index is built with the SAME join rule the renderer re-applies per page
 * (`pageTextChunk`), so an offset in the projection and a box on the page can
 * never disagree about which item they mean.
 *
 * The sizes are collected here rather than in their own pass because this loop
 * has already paid for `getPage` — a second pass over a 900-page document would
 * be 900 worker round-trips for numbers we are holding.
 */
async function extractText(
  handle: PdfDocument,
  signal?: AbortSignal,
): Promise<{ textIndex?: TextIndex<number>; pageSizes?: PageSize[] }> {
  const pages = Math.min(handle.numPages, PDF_TEXT_PAGE_LIMIT);
  const builder = createTextIndexBuilder<number>({ separator: PDF_PAGE_SEPARATOR });
  const pageSizes: PageSize[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
      if (signal?.aborted) break;
      const page = await handle.getPage(pageNumber);
      const { width, height } = page.getViewport({ scale: 1 });
      pageSizes.push({ width, height });
      const content = await page.getTextContent();
      builder.push(pageTextChunk(content.items).text, pageNumber);
    }
  } catch {
    // Fall through: return what we have.
  }
  const index = builder.build();
  return {
    textIndex: index.text.length > 0 ? index : undefined,
    pageSizes: pageSizes.length > 0 ? pageSizes : undefined,
  };
}

/* -------------------------------------------------------------------------- */
/* Renderer                                                                    */
/* -------------------------------------------------------------------------- */

function PdfRenderer({
  document: doc,
  source,
  className,
  highlights,
  activeHighlightId,
  pageNumber: pageNumberProp,
  onPageChange,
  zoom = DEFAULT_ZOOM,
  onZoomResolved,
}: AdapterRendererProps) {
  const pdf = doc as PdfViewerDocument;

  const [pageNumber, goToPage] = usePageControl(pageNumberProp, onPageChange, pdf.pageCount);

  const listRef = useRef<HTMLDivElement>(null);
  const viewport = useViewportSize(listRef);

  /**
   * A page's size at scale 1.
   *
   * Falls back to the first page for anything past what the adapter measured
   * (`AdapterDocument.pageSizes` may be shorter than the page count). Uniform
   * page size is overwhelmingly the common case, and a wrong guess costs a
   * corrected scrollbar, not a wrong render.
   */
  const naturalAt = useCallback(
    (index: number): PageSize | undefined => pdf.pageSizes?.[index] ?? pdf.pageSizes?.[0],
    [pdf.pageSizes],
  );

  // A fit mode is a REQUEST the renderer resolves — it is the only party that
  // knows how wide its viewport is (`AdapterRendererProps.zoom`). Fitted to the
  // page the reader is ON, so a landscape page in a portrait document does not
  // re-fit the whole column.
  const natural = naturalAt(pageNumber - 1);
  const scale = useMemo(() => {
    if (typeof zoom === "number") return zoom;
    // Until the page and the pane have both been measured, 100% is a better
    // first frame than a guess that jumps.
    if (!natural || !viewport) return DEFAULT_ZOOM;
    const byWidth = (viewport.width - FIT_GUTTER) / natural.width;
    const fitted =
      zoom === "fit-width"
        ? byWidth
        : Math.min(byWidth, (viewport.height - FIT_GUTTER) / natural.height);
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, fitted));
  }, [zoom, natural, viewport]);

  // Report what the fit became, so the chrome can show a percentage and the
  // reader's next "zoom in" steps from what is on screen.
  useEffect(() => {
    onZoomResolved?.(scale);
  }, [scale, onZoomResolved]);

  const estimateSize = useCallback(
    (index: number) =>
      Math.round((naturalAt(index)?.height ?? FALLBACK_PAGE_HEIGHT) * scale) +
      PAGE_BORDER +
      PAGE_GAP,
    [naturalAt, scale],
  );

  const virtualizer = usePagedScroll({
    count: pdf.pageCount,
    listRef,
    pageNumber,
    goToPage,
    estimateSize,
    sizeKey: scale,
  });

  // LOCATE happened in the shell; the per-page views below do MAP and PAINT.
  // Computed once here because it is a function of the whole projection, not of
  // any one page.
  const marks = useMemo(() => toMarkRanges(highlights, pdf.text?.length ?? 0), [highlights, pdf]);

  // Scrolling to the cited page is the first half of "take me there"; the mark's
  // own `scrollIntoView`, inside the page view, is the second. Keyed on the page
  // NUMBER, so a reader who scrolls away while the same citation stays active is
  // not dragged back.
  const activePage = pageOfHighlight(
    highlights?.find((highlight) => highlight.id === activeHighlightId),
    pdf.textIndex,
  );
  useEffect(() => {
    if (activePage === undefined || activePage < 1 || activePage > pdf.pageCount) return;
    goToPage(activePage);
  }, [activePage, pdf.pageCount, goToPage]);

  return (
    // No viewport of its own: `FileViewerContent` is the one scroll boundary
    // (`viewer-components.md`), and this column is a child of it. The height is
    // the whole document's, so the scrollbar is honest from the first frame
    // rather than growing as pages arrive.
    <div
      ref={listRef}
      data-slot="pdf-pages"
      className={cn("relative w-full", className)}
      style={{ height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map((item) => (
        <div
          key={item.key}
          data-index={item.index}
          ref={virtualizer.measureElement}
          className="absolute inset-x-0 top-0"
          style={{
            paddingBottom: PAGE_GAP,
            transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)`,
          }}
        >
          <PdfPageView
            handle={pdf.handle}
            pageNumber={item.index + 1}
            natural={naturalAt(item.index)}
            scale={scale}
            alt={source.alt}
            highlights={highlights}
            activeHighlightId={activeHighlightId}
            marks={marks}
            pageStart={pdf.textIndex?.spans.find((span) => span.ref === item.index + 1)?.start}
          />
        </div>
      ))}
    </div>
  );
}

interface PdfPageViewProps {
  handle: PdfDocument;
  /** 1-based, as everything on the wire is. */
  pageNumber: number;
  /** This page at scale 1, when the adapter measured it. Reserves the box. */
  natural?: PageSize;
  scale: number;
  alt?: string;
  highlights?: readonly ResolvedHighlight[];
  activeHighlightId?: string | null;
  marks: MarkRanges;
  /** Where this page's text begins in the projection, if it was extracted. */
  pageStart?: number;
}

/**
 * One page: the raster, the transparent text over it, and any citation boxes.
 *
 * A component per page rather than one effect over the visible range, so that
 * mounting and unmounting IS the lifecycle — a page scrolled out of the window
 * cancels its own render task and releases its own pdf.js page, with no
 * bookkeeping to get wrong.
 */
function PdfPageView({
  handle,
  pageNumber,
  natural,
  scale,
  alt,
  highlights,
  activeHighlightId,
  marks,
  pageStart,
}: PdfPageViewProps) {
  const { t, formatNumber } = useLocale();

  const [size, setSize] = useState<{ width: number; height: number } | undefined>(
    natural && { width: natural.width * scale, height: natural.height * scale },
  );
  const [spans, setSpans] = useState<PdfTextSpan[]>([]);
  const [items, setItems] = useState<PdfTextItem[]>([]);
  const [failed, setFailed] = useState<string>();

  const pageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let task: ReturnType<PdfPage["render"]> | undefined;
    let page: PdfPage | undefined;

    void (async () => {
      try {
        page = await handle.getPage(pageNumber);
        if (cancelled) return;

        // Rasterize at the device pixel ratio, then present at CSS size — a 1:1
        // canvas is visibly soft on every retina display.
        const ratio = typeof window === "undefined" ? 1 : (window.devicePixelRatio ?? 1);
        const viewport = page.getViewport({ scale: scale * ratio });
        const cssViewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        setSize({ width: cssViewport.width, height: cssViewport.height });

        task = page.render({ canvasContext: context, viewport });
        await task.promise;
        if (cancelled) return;

        const content = await page.getTextContent();
        if (cancelled) return;
        setItems(content.items);
        setSpans(toTextSpans(content.items, cssViewport.height, scale));
        setFailed(undefined);
      } catch (error) {
        // A cancelled render is the normal outcome of scrolling quickly; only a
        // settled failure is news (loading-states.md).
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        if (/cancel/i.test(message)) return;
        setFailed(message);
      }
    })();

    return () => {
      cancelled = true;
      task?.cancel();
      page?.cleanup();
    };
  }, [handle, pageNumber, scale]);

  // MAP + PAINT. Turning the shell's offsets into rectangles needs this page's
  // own items, which the effect above already fetched for the text layer.
  const boxes = useMemo<PdfHighlightBox[]>(() => {
    if (!size) return [];
    // A `rect` address is already geometry — it only has to be on this page.
    // `page` defaults to 1 so a single-page citation needs no page number.
    const geometry = (highlights ?? []).filter(
      (highlight) =>
        highlight.status === "resolved" &&
        highlight.rects !== undefined &&
        (highlight.page ?? 1) === pageNumber,
    );
    return [
      ...(pageStart === undefined ? [] : rangeBoxes(spans, pageTextChunk(items), pageStart, marks)),
      ...rectBoxes(geometry, size),
    ];
  }, [size, highlights, pageNumber, pageStart, spans, items, marks]);

  // The boxes arrive a tick after the page does (the text content is fetched
  // asynchronously), so the scroll waits for them rather than for the id.
  useScrollActiveHighlightIntoView(pageRef, activeHighlightId, boxes);

  if (failed) {
    return (
      <div
        className="mx-auto flex w-fit items-center justify-center"
        style={size ? { width: size.width, height: size.height } : undefined}
      >
        <StatePanel
          kind="error"
          title={t("viewer.error.parseFailed")}
          description={t("viewer.pdf.pageFailed", {
            page: formatNumber(pageNumber),
          })}
        />
      </div>
    );
  }

  return (
    <div
      ref={pageRef}
      data-slot="pdf-page"
      data-page={pageNumber}
      className="border-border relative mx-auto w-fit border shadow-sm"
      style={size ? { width: size.width, height: size.height } : undefined}
    >
      <canvas
        ref={canvasRef}
        // The page's own description, so a screen reader gets what the document
        // is rather than "canvas". The text layer below carries the words
        // themselves. Every page names its own number, which is what makes a
        // continuous column navigable by heading-less landmark browsing.
        role="img"
        aria-label={alt ?? t("viewer.pdf.page", { page: formatNumber(pageNumber) })}
        className="block"
        style={size ? { width: size.width, height: size.height } : undefined}
      />
      {/* Transparent, selectable text over the raster. `select-text` and the
          transforms come from pdf.js's own item geometry. */}
      <div aria-hidden={spans.length === 0} className="absolute inset-0 select-text">
        {spans.map((span, index) => (
          <span
            key={index}
            className="absolute origin-top-left whitespace-pre text-transparent"
            style={{
              left: span.left,
              top: span.top,
              fontSize: span.fontSize,
              lineHeight: 1,
            }}
          >
            {span.text}
          </span>
        ))}
      </div>
      {/* Decorative: the words themselves are in the text layer above, and the
          shell's status line is what names the citation. A plate here would
          otherwise be read out as an unlabelled region.

          Translucent rather than a solid plate, because the "ink" it sits on is
          the raster below it — an opaque mark would delete the very sentence it
          is pointing at. The current box is not distinguished by colour alone
          (WCAG 1.4.1): it is also drawn twice as thick. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {boxes.map((box, index) => (
          <div
            key={index}
            data-slot="highlight-rect"
            // Presence form, matching every other painter's `data-active`.
            data-active={box.active ? "" : undefined}
            className={cn(
              "absolute rounded-xs",
              box.active
                ? "bg-highlight-active/30 border-highlight-active border-2"
                : "bg-highlight/35 border-highlight border",
            )}
            style={{
              left: box.left,
              top: box.top,
              width: box.width,
              height: box.height,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * pdf.js text geometry → CSS boxes.
 *
 * Item transforms are `[a, b, c, d, e, f]` in PDF user space, whose origin is
 * the BOTTOM-left of the page; CSS measures from the top. `d` carries the glyph
 * height, which is the font size once scaled.
 *
 * Whitespace-only items are dropped — they would be invisible clutter in the
 * text layer — so each span carries the index of the item it came from. That is
 * what lets a highlight box find its geometry after the filtering, without
 * either side counting positions.
 */
export function toTextSpans(
  items: { str: string; transform: number[]; width?: number }[],
  pageHeight: number,
  scale: number,
): PdfTextSpan[] {
  const spans: PdfTextSpan[] = [];
  items.forEach((item, index) => {
    if (!item.str.trim()) return;
    const [, , , d = 0, e = 0, f = 0] = item.transform;
    const fontSize = Math.abs(d) * scale;
    spans.push({
      text: item.str,
      left: e * scale,
      top: pageHeight - f * scale - fontSize,
      width: (item.width ?? 0) * scale,
      fontSize,
      item: index,
    });
  });
  return spans;
}

const adapterModule: AdapterModule = {
  manifest: pdfManifest,
  create: () => new PdfAdapter(),
  Renderer: PdfRenderer,
};

export default adapterModule;
