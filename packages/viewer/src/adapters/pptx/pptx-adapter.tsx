"use client";

/**
 * PowerPoint adapter — a deck becomes a slide outline you can page through.
 *
 * A `.pptx` is a zip of XML, so there is no PowerPoint library here: jszip opens
 * the container and the platform's own `DOMParser` reads the parts. What is
 * extracted, and why it is an outline rather than a reproduction of the slide
 * canvas, is argued in `pptx-model.ts`.
 *
 * The deck is one continuous column of slides, virtualized over the shell's
 * viewport — the same treatment the PDF pages get, for the same reason: reading
 * a deck end to end is scrolling, not clicking "next" 60 times. The slide number
 * follows the scroll, and the pager scrolls.
 */

import type { ProseHeadingLevel, ResolvedFileSource } from "@elabs-ai/components-ui";
import { cn, ProseHeading, useLocale } from "@elabs-ai/components-ui";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { MarkedText } from "../../components/marked-text";
import { ViewerError, toViewerError } from "../../core/errors";
import { toMarkRanges, type MarkRanges } from "../../core/highlight-marks";
import { spanAt, type TextIndex } from "../../core/text-index";
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
} from "../../core/types";
import { pptxManifest } from "./pptx-manifest";
import {
  notesTarget,
  orderSlidePaths,
  parseNotes,
  parseSlide,
  slidesToTextWithMap,
  PPTX_NOTES_LINE,
  PPTX_TITLE_LINE,
  type PptxRef,
  type PptxSlide,
} from "./pptx-model";

export interface PptxDocument extends AdapterDocument {
  kind: "pptx";
  slides: PptxSlide[];
  pageCount: number;
  /** Which slide and line each stretch of `text` came from. */
  textIndex?: TextIndex<PptxRef>;
}

/** Indent per outline level. Four rungs is as deep as a readable slide ever goes. */
const LEVEL_INDENT = ["ps-0", "ps-4", "ps-8", "ps-12"] as const;

/** The slide column's own cap, matching the `max-w-3xl` on the frame. */
const SLIDE_MAX_WIDTH = 768;

/** Space between two slides in the column, in CSS pixels. */
const SLIDE_GAP = 16;

/** Room reserved for a slide's speaker notes before they are measured. */
const NOTES_ESTIMATE = 72;

class PptxAdapter implements FileAdapter {
  async load(source: ResolvedFileSource, context: AdapterLoadContext): Promise<PptxDocument> {
    let buffer: ArrayBuffer;
    try {
      buffer = await source.bytes(context.signal);
    } catch (error) {
      throw toViewerError(error, "read-failed", { fileName: source.name });
    }

    // Dynamic: the ONLY edge to the optional peer (heavy-deps:check).
    const JSZip = (await import("jszip")).default;

    try {
      const zip = await JSZip.loadAsync(buffer);
      const parser = new DOMParser();
      const parse = (xml: string) => parser.parseFromString(xml, "application/xml");

      const slidePaths = orderSlidePaths(Object.keys(zip.files));
      if (slidePaths.length === 0) {
        throw new ViewerError("parse-failed", "The presentation contains no slides.", {
          fileName: source.name,
        });
      }

      const slides: PptxSlide[] = [];
      for (const [position, path] of slidePaths.entries()) {
        if (context.signal?.aborted) break;
        const xml = await zip.file(path)?.async("string");
        if (!xml) continue;
        const slide = parseSlide(parse(xml), position + 1);

        // Notes are best-effort: a deck with no notes part, or one whose
        // relationships do not resolve, is a complete deck — not a failure.
        const relsXml = await zip
          .file(`${dirOf(path)}/_rels/${baseOf(path)}.rels`)
          ?.async("string");
        const notesPath = relsXml ? notesTarget(parse(relsXml), path) : undefined;
        const notesXml = notesPath ? await zip.file(notesPath)?.async("string") : undefined;
        if (notesXml) slide.notes = parseNotes(parse(notesXml));

        slides.push(slide);
      }

      const textIndex = slidesToTextWithMap(slides);
      return {
        kind: "pptx",
        slides,
        pageCount: slides.length,
        text: textIndex.text,
        textIndex,
      };
    } catch (error) {
      throw toViewerError(error, "parse-failed", { fileName: source.name });
    }
  }
}

function dirOf(path: string): string {
  return path.slice(0, path.lastIndexOf("/"));
}

function baseOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/* -------------------------------------------------------------------------- */
/* Renderer                                                                    */
/* -------------------------------------------------------------------------- */

function PptxRenderer({
  document: doc,
  className,
  baseHeadingLevel = 2,
  highlights,
  activeHighlightId,
  pageNumber,
  onPageChange,
}: AdapterRendererProps) {
  const deck = doc as PptxDocument;
  // One pager for every paginated format, so a deck's slides and a PDF's pages
  // are driven by the same shell control (ADR 0026). 1-based on the wire; this
  // renderer's array is 0-based, and the conversion stays local.
  const [slideNumber, goToSlide] = usePageControl(pageNumber, onPageChange, deck.slides.length);
  const listRef = useRef<HTMLDivElement>(null);
  const viewport = useViewportSize(listRef);

  const marks = useMemo(
    () => toMarkRanges(highlights, deck.text?.length ?? 0),
    [highlights, deck.text],
  );

  // A slide frame is 16:9 inside a capped column, so its height follows from the
  // pane's width — no measurement of the slide itself is needed for the first
  // frame. `measureElement` corrects a slide whose outline overflows the ratio,
  // and whose notes are longer than the estimate.
  const frameWidth = Math.min(SLIDE_MAX_WIDTH, (viewport?.width ?? SLIDE_MAX_WIDTH) - SLIDE_GAP);
  const estimateSize = useCallback(
    (index: number) =>
      Math.round((frameWidth * 9) / 16) +
      SLIDE_GAP +
      (deck.slides[index]?.notes ? NOTES_ESTIMATE : 0),
    [frameWidth, deck.slides],
  );

  const virtualizer = usePagedScroll({
    count: deck.slides.length,
    listRef,
    pageNumber: slideNumber,
    goToPage: goToSlide,
    estimateSize,
    sizeKey: frameWidth,
  });

  // Where each line of the deck begins in the projection, keyed by slide. Built
  // once for the whole deck rather than per slide: several slides are on screen
  // at a time now, and one pass over the spans is cheaper than one pass per
  // visible slide on every scroll.
  const starts = useMemo(() => {
    const map = new Map<number, Map<number, number>>();
    for (const span of deck.textIndex?.spans ?? []) {
      const slide = map.get(span.ref.slide) ?? new Map<number, number>();
      slide.set(span.ref.line, span.start);
      map.set(span.ref.slide, slide);
    }
    return map;
  }, [deck.textIndex]);

  // Scrolling to the cited slide is this format's half of "take me there". Keyed
  // on the slide NUMBER, so a reader who scrolls away while the same citation is
  // still active is not dragged back (the same trade the PDF column makes).
  const activeSlide = useMemo(() => {
    const active = highlights?.find((highlight) => highlight.id === activeHighlightId);
    if (!active || active.status !== "resolved" || !active.range || !deck.textIndex) {
      return undefined;
    }
    return spanAt(deck.textIndex, active.range[0])?.ref.slide;
  }, [highlights, activeHighlightId, deck.textIndex]);
  useEffect(() => {
    if (activeSlide === undefined) return;
    const position = deck.slides.findIndex((candidate) => candidate.index === activeSlide);
    if (position >= 0) goToSlide(position + 1);
  }, [activeSlide, deck.slides, goToSlide]);

  // The mark only exists once the cited slide is mounted, so the scroll waits
  // for the slide as well as for the id.
  useScrollActiveHighlightIntoView(listRef, activeHighlightId, slideNumber);

  return (
    // No viewport of its own: the slide chrome moved to the shell (ADR 0026), so
    // there is no fixed control above a scrolling body and `FileViewerContent`
    // is the one scroll boundary (`viewer-components.md`).
    <div
      ref={listRef}
      data-slot="pptx-slides"
      className={cn("relative w-full", className)}
      style={{ height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map((item) => {
        const slide = deck.slides[item.index];
        if (!slide) return null;
        return (
          <div
            key={item.key}
            data-index={item.index}
            ref={virtualizer.measureElement}
            className="absolute inset-x-0 top-0"
            style={{
              paddingBottom: SLIDE_GAP,
              transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)`,
            }}
          >
            <PptxSlideView
              slide={slide}
              slideNumber={item.index + 1}
              baseHeadingLevel={baseHeadingLevel}
              marks={marks}
              starts={starts.get(slide.index)}
            />
          </div>
        );
      })}
    </div>
  );
}

interface PptxSlideViewProps {
  slide: PptxSlide;
  /** 1-based position in the deck, which is what the reader is shown. */
  slideNumber: number;
  baseHeadingLevel: ProseHeadingLevel;
  marks: MarkRanges;
  /** Where each of this slide's lines begins in the projection. */
  starts?: Map<number, number>;
}

/** One slide: the 16:9 frame, its outline, and any speaker notes beneath it. */
function PptxSlideView({
  slide,
  slideNumber,
  baseHeadingLevel,
  marks,
  starts,
}: PptxSlideViewProps) {
  const { t, formatNumber } = useLocale();
  const isEmpty = !slide.title && slide.lines.length === 0;

  return (
    <>
      {/* The slide surface: `bg-card` above the pane's ground, `aspect-video`
          so a deck still reads as a deck — this is the shape of the thing,
          which is the one part of the layout an outline can honestly keep. */}
      {/* A slide that overflows its 16:9 frame scrolls, and a scrollable
          region with no focusable content cannot be reached by keyboard
          (WCAG 2.1.1). `tabIndex={0}` makes the slide itself the stop that
          arrow keys and Page Up/Down drive. This is the one nested scroller the
          rule allows: a fixed-ratio frame whose content may not fit it. */}
      <section
        tabIndex={0}
        data-slot="pptx-slide"
        data-page={slideNumber}
        aria-label={t("viewer.pptx.slide", {
          slide: formatNumber(slideNumber),
        })}
        className="border-border bg-card focus-ring mx-auto flex aspect-video w-full max-w-3xl flex-col gap-3 overflow-auto rounded-md border p-6 shadow-sm"
      >
        {/* A slide title is the deck's top rung, so it sits at the host's base.
            The stand-in for an untitled slide is OUR text, not the deck's, so
            it is not in the projection and cannot be cited. */}
        <ProseHeading level={baseHeadingLevel}>
          {slide.title === undefined ? (
            t("viewer.pptx.untitled")
          ) : (
            <MarkedText text={slide.title} marks={marks} start={starts?.get(PPTX_TITLE_LINE)} />
          )}
        </ProseHeading>
        {isEmpty ? (
          <p className="text-muted-foreground text-body">{t("viewer.pptx.empty")}</p>
        ) : (
          <ul className="text-body space-y-1.5">
            {slide.lines.map((line, lineIndex) => (
              <li
                key={lineIndex}
                className={cn("whitespace-pre-wrap", LEVEL_INDENT[Math.min(line.level, 3)])}
              >
                <MarkedText text={line.text} marks={marks} start={starts?.get(lineIndex)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {slide.notes && (
        <section
          aria-label={t("viewer.pptx.notes")}
          className="mx-auto mt-3 w-full max-w-3xl space-y-1"
        >
          <h3 className="text-meta text-muted-foreground">{t("viewer.pptx.notes")}</h3>
          <p className="text-body text-muted-foreground whitespace-pre-wrap">
            <MarkedText text={slide.notes} marks={marks} start={starts?.get(PPTX_NOTES_LINE)} />
          </p>
        </section>
      )}
    </>
  );
}

const adapterModule: AdapterModule = {
  manifest: pptxManifest,
  create: () => new PptxAdapter(),
  Renderer: PptxRenderer,
};

export default adapterModule;
