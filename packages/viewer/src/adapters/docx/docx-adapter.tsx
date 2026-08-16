"use client";

/**
 * Word adapter — a `.docx` becomes blocks, and blocks become brand-ui prose.
 *
 * mammoth does the hard part (unzipping OOXML, resolving styles, numbering,
 * images); `docx-model.ts` then parses its HTML into a model and discards the
 * markup, so nothing here writes `innerHTML`. That single decision is what makes
 * a Word document themeable, Trusted-Types-safe and free of a sanitizer
 * dependency — the reasoning lives in `docx-model.ts`.
 *
 * What a reader gets is the document's STRUCTURE in this system's typography:
 * real headings, real lists, a real `Table`, images with their own alt text. It
 * is not a pixel reproduction of Word's page layout — no page breaks, no columns,
 * no margins — and it does not pretend to be. For a byte-faithful rendering the
 * honest answer is to download the file, which the toolbar already offers.
 */

import type { ProseHeadingLevel, ResolvedFileSource } from "@elabs-ai/components-ui";
import {
  cn,
  ProseHeading,
  ProseLink,
  ProseList,
  ProseListItem,
  ProseText,
  StatePanel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useLocale,
} from "@elabs-ai/components-ui";

import { useMemo, useRef } from "react";

import { MarkedText } from "../../components/marked-text";
import { toViewerError } from "../../core/errors";
import { toMarkRanges, type MarkRanges } from "../../core/highlight-marks";
import type { TextIndex, TextSpan } from "../../core/text-index";
import { useScrollActiveHighlightIntoView } from "../../core/use-highlight-scroll";
import type {
  AdapterDocument,
  AdapterLoadContext,
  AdapterModule,
  AdapterRendererProps,
  FileAdapter,
} from "../../core/types";
import {
  blocksToTextWithMap,
  DOCX_CELL_SEPARATOR,
  DOCX_HEAD_ROW,
  DOCX_LIST_BULLET,
  htmlToBlocks,
  type DocxBlock,
  type DocxRef,
  type DocxRun,
} from "./docx-model";
import { docxManifest } from "./docx-manifest";

export interface DocxDocument extends AdapterDocument {
  kind: "docx";
  blocks: DocxBlock[];
  /** Non-fatal conversion notes mammoth reported (an unsupported style, a dropped field). */
  warnings: string[];
  /** Which block, item or row each stretch of `text` came from. */
  textIndex?: TextIndex<DocxRef>;
}

/**
 * Parse markup with the DOM the runtime already has.
 *
 * `DOMParser` is the browser's own parser and jsdom's in tests — it does NOT
 * execute anything it parses, which is why building the model from it is safe
 * even though the input is third-party markup.
 */
function parseMarkup(markup: string): Document {
  return new DOMParser().parseFromString(markup, "text/html");
}

class DocxAdapter implements FileAdapter {
  async load(source: ResolvedFileSource, context: AdapterLoadContext): Promise<DocxDocument> {
    let buffer: ArrayBuffer;
    try {
      buffer = await source.bytes(context.signal);
    } catch (error) {
      throw toViewerError(error, "read-failed", { fileName: source.name });
    }

    // Dynamic: the ONLY edge to the optional peer (heavy-deps:check).
    const mammoth = await import("mammoth");

    try {
      const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
      const blocks = htmlToBlocks(result.value, parseMarkup);
      const textIndex = blocksToTextWithMap(blocks);
      return {
        kind: "docx",
        blocks,
        // mammoth's messages are about the CONVERSION, not about the file being
        // broken — a document that lost one custom style still reads fine, so
        // they are carried as notes rather than raised as a failure.
        warnings: result.messages.map((message) => message.message),
        text: textIndex.text,
        textIndex,
      };
    } catch (error) {
      throw toViewerError(error, "parse-failed", { fileName: source.name });
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Renderer                                                                    */
/* -------------------------------------------------------------------------- */

function Runs({ runs, marks, start }: { runs: DocxRun[]; marks: MarkRanges; start?: number }) {
  let offset = start;
  return (
    <>
      {runs.map((run, index) => {
        const from = offset;
        if (offset !== undefined) offset += run.text.length;
        // Runs are joined with nothing in the projection, so a run's offset is
        // simply the sum of the ones before it — the same accumulation the code
        // adapter does over syntax tokens.
        const content = <MarkedText text={run.text} marks={marks} start={from} />;
        const bolded = run.bold ? <strong>{content}</strong> : content;
        const styled = run.italic ? <em>{bolded}</em> : bolded;
        if (run.href) {
          return (
            <ProseLink key={index} href={run.href}>
              {styled}
            </ProseLink>
          );
        }
        return <span key={index}>{styled}</span>;
      })}
    </>
  );
}

/** Shared empty list, so a block with no spans does not remount on every render. */
const EMPTY_SPANS: readonly TextSpan<DocxRef>[] = [];

/** The projection offset of one row's `index`-th cell, given the row's own start. */
function cellStart(row: readonly string[], index: number, rowStart?: number): number | undefined {
  if (rowStart === undefined) return undefined;
  let offset = rowStart;
  for (let i = 0; i < index; i += 1) {
    offset += (row[i]?.length ?? 0) + DOCX_CELL_SEPARATOR.length;
  }
  return offset;
}

function Block({
  block,
  baseHeadingLevel,
  marks,
  spans,
}: {
  block: DocxBlock;
  baseHeadingLevel: number;
  marks: MarkRanges;
  /** The projection spans belonging to THIS block, in document order. */
  spans: readonly TextSpan<DocxRef>[];
}) {
  const startOf = (match: (ref: DocxRef) => boolean) =>
    spans.find((span) => match(span.ref))?.start;

  if (block.type === "heading") {
    return (
      // Offset, not absolute: Word's "Heading 1" is the top of THAT document,
      // not of the page showing it. Never past h6 — an h7 is not an element.
      <ProseHeading
        level={Math.min(6, Math.max(1, block.level + baseHeadingLevel - 1)) as ProseHeadingLevel}
      >
        <Runs runs={block.runs} marks={marks} start={startOf(() => true)} />
      </ProseHeading>
    );
  }
  if (block.type === "paragraph") {
    return (
      <ProseText className="whitespace-pre-wrap">
        <Runs runs={block.runs} marks={marks} start={startOf(() => true)} />
      </ProseText>
    );
  }
  if (block.type === "list") {
    return (
      <ProseList ordered={block.ordered}>
        {block.items.map((item, index) => {
          // The bullet is in the projection but not in the DOM — the list
          // element draws it — so an item's own text starts after it.
          const start = startOf((ref) => ref.item === index);
          return (
            <ProseListItem key={index}>
              <Runs
                runs={item}
                marks={marks}
                start={start === undefined ? undefined : start + DOCX_LIST_BULLET.length}
              />
            </ProseListItem>
          );
        })}
      </ProseList>
    );
  }
  if (block.type === "image") {
    return (
      <img
        src={block.src}
        // The document's own alt text when the author wrote one. An image with
        // none is decoration as far as the reader can tell, and a filename would
        // be noise, not a description.
        alt={block.alt ?? ""}
        {...(block.alt ? {} : { "aria-hidden": true })}
        className="my-2 block h-auto max-w-full rounded-md"
      />
    );
  }
  const headStart = startOf((ref) => ref.row === DOCX_HEAD_ROW);
  return (
    <Table className="my-2">
      {block.head && (
        <TableHeader>
          <TableRow>
            {block.head.map((cell, index) => (
              <TableHead key={index} scope="col">
                <MarkedText
                  text={cell}
                  marks={marks}
                  start={cellStart(block.head ?? [], index, headStart)}
                />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
      )}
      <TableBody>
        {block.rows.map((row, rowIndex) => {
          const rowStart = startOf((ref) => ref.row === rowIndex);
          return (
            <TableRow key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <TableCell key={cellIndex} className="whitespace-pre-wrap align-top">
                  <MarkedText
                    text={cell}
                    marks={marks}
                    start={cellStart(row, cellIndex, rowStart)}
                  />
                </TableCell>
              ))}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function DocxRenderer({
  document: doc,
  className,
  baseHeadingLevel = 2,
  highlights,
  activeHighlightId,
}: AdapterRendererProps) {
  const docx = doc as DocxDocument;
  const { t } = useLocale();
  const container = useRef<HTMLElement>(null);

  const marks = useMemo(
    () => toMarkRanges(highlights, docx.text?.length ?? 0),
    [highlights, docx.text],
  );
  // Grouped once per document rather than searched per block: a long report is
  // thousands of blocks, and a linear scan inside the render loop would make it
  // quadratic on every keystroke of a find-as-you-type.
  const spansByBlock = useMemo(() => {
    const map = new Map<number, TextSpan<DocxRef>[]>();
    for (const span of docx.textIndex?.spans ?? []) {
      const list = map.get(span.ref.block);
      if (list) list.push(span);
      else map.set(span.ref.block, [span]);
    }
    return map;
  }, [docx.textIndex]);

  useScrollActiveHighlightIntoView(container, activeHighlightId);

  if (docx.blocks.length === 0) {
    return (
      <div className={cn("flex min-h-full flex-col justify-center p-4", className)}>
        <StatePanel kind="empty" title={t("viewer.docx.empty")} />
      </div>
    );
  }

  return (
    // `max-w-prose` because this is genuine multi-sentence prose in a pane that
    // can be very wide — the one case styling-and-tokens.md says to cap the
    // measure. Centred so the column does not hug one edge. No `overflow-auto`:
    // `FileViewerContent` is the scroll boundary, and a second one clips the
    // last paragraph above the outer pane's padding.
    <article ref={container} className={cn("mx-auto max-w-prose space-y-2", className)}>
      {docx.blocks.map((block, index) => (
        <Block
          key={index}
          block={block}
          baseHeadingLevel={baseHeadingLevel}
          marks={marks}
          spans={spansByBlock.get(index) ?? EMPTY_SPANS}
        />
      ))}
    </article>
  );
}

const adapterModule: AdapterModule = {
  manifest: docxManifest,
  create: () => new DocxAdapter(),
  Renderer: DocxRenderer,
};

export default adapterModule;
