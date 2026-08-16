"use client";

/**
 * Markdown adapter — a `.md` file read as a DOCUMENT, not as source.
 *
 * Renders through `streamdown`, the same markdown engine
 * `@elabs-ai/components-ai`'s `MarkdownView` and
 * `@elabs-ai/components-editor`'s preview use, mapped onto the same
 * `Prose*` primitives from `@elabs-ai/components-ui`. That is the
 * point: a README must not look like three different documents depending on
 * which pane it opened in. The element map below is deliberately a near-copy of
 * `MarkdownView`'s — the packages are siblings and may not import each other,
 * and the shared half that could move down (the `Prose*` set, the Streamdown
 * locale bridge) already has.
 *
 * What this does NOT do, on purpose:
 *
 * - **No plugins.** `@streamdown/code`, `/math`, `/cjk` and `/mermaid` are four
 *   more packages a consumer would have to install to open one file. Fenced code
 *   is rendered as an unhighlighted block by the element map below (Streamdown
 *   emits a bare `<code>` without the code plugin, so the `<pre>` is ours); a
 *   source file opened directly still gets Shiki from the `code` adapter, and a
 *   diagram fence reads as its own text rather than as a picture.
 * - **No streaming.** A file arrives settled or not at all, so `mode="static"`
 *   and `parseIncompleteMarkdown={false}` — the incomplete-token repair that
 *   makes Streamdown good at chat is only overhead for a file on disk.
 */

import {
  ProseBlockquote,
  ProseHeading,
  ProseInlineCode,
  ProseLink,
  ProseList,
  ProseListItem,
  ProseText,
  StatePanel,
  cn,
  useLocale,
  useStreamdownTranslations,
} from "@elabs-ai/components-ui";
import type { ProseHeadingLevel, ResolvedFileSource } from "@elabs-ai/components-ui";
import type { ComponentProps, ReactNode } from "react";
import { createContext, use, useMemo, useRef } from "react";
import type * as StreamdownExports from "streamdown";

import { toViewerError } from "../../core/errors";
import { toMarkRanges, type MarkRanges } from "../../core/highlight-marks";
import { useScrollActiveHighlightIntoView } from "../../core/use-highlight-scroll";
import type {
  AdapterDocument,
  AdapterLoadContext,
  AdapterModule,
  AdapterRendererProps,
  FileAdapter,
} from "../../core/types";
import { blockMark, blockMarkAttributes, type PositionedNode } from "./markdown-marks";
import { markdownManifest } from "./markdown-manifest";

/**
 * Characters kept before truncation. Markdown is parsed into an element tree,
 * which costs more than a `<pre>` — this sits between the code and plain-text
 * limits for that reason.
 */
export const MARKDOWN_CHARACTER_LIMIT = 1_000_000;

export interface MarkdownDocument extends AdapterDocument {
  kind: "markdown";
  text: string;
  /** Total characters in the file, when more than what is shown. */
  totalCharacters?: number;
}

// Type-only, so it erases: the runtime edge is the dynamic import below.
type StreamdownModule = typeof StreamdownExports;
type StreamdownComponents = NonNullable<
  ComponentProps<StreamdownModule["Streamdown"]>["components"]
>;

/**
 * The engine, resolved once per page.
 *
 * Loaded in `load()` rather than imported at the top of this module for the
 * reason every other adapter does it: `streamdown` is an OPTIONAL peer, and a
 * static edge would make this module unresolvable — not merely heavier — for a
 * consumer who never installs it. The renderer reads the same cached module,
 * which is guaranteed to be populated because a document only exists once
 * `load()` has resolved.
 */
let streamdown: StreamdownModule | undefined;

async function loadStreamdown(): Promise<StreamdownModule> {
  // Dynamic: the ONLY edge to the optional peer (heavy-deps:check).
  streamdown ??= await import("streamdown");
  return streamdown;
}

class MarkdownAdapter implements FileAdapter {
  async load(source: ResolvedFileSource, context: AdapterLoadContext): Promise<MarkdownDocument> {
    let raw: string;
    try {
      raw = await source.text(context.signal);
    } catch (error) {
      throw toViewerError(error, "read-failed", { fileName: source.name });
    }

    // Before returning: a document this adapter's Renderer cannot draw is a
    // failed load, not a blank pane. A missing peer surfaces from here as
    // `parser-missing` (see `parserMissingError`).
    await loadStreamdown();

    const truncated = raw.length > MARKDOWN_CHARACTER_LIMIT;
    return {
      kind: "markdown",
      text: truncated ? raw.slice(0, MARKDOWN_CHARACTER_LIMIT) : raw,
      totalCharacters: truncated ? raw.length : undefined,
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Renderer                                                                    */
/* -------------------------------------------------------------------------- */

/** Never past `h6`, whatever the offset — an `h7` is not an element. */
const clampHeadingLevel = (level: number): ProseHeadingLevel =>
  Math.min(6, Math.max(1, level)) as ProseHeadingLevel;

/* -------------------------------------------------------------------------- */
/* Highlight plates                                                            */
/* -------------------------------------------------------------------------- */

const EMPTY_MARKS: MarkRanges = { ranges: [], activeIndex: -1 };

/**
 * The marks, read by the block components.
 *
 * A context rather than a closure over `buildProseComponents`, so the element
 * map stays memoized on the heading offset alone: rebuilding it per keystroke
 * of a find-as-you-type would hand Streamdown a new `components` object every
 * time, which it treats as a reason to re-render every block in the file.
 */
const MarkContext = createContext<MarkRanges>(EMPTY_MARKS);

/** Set once a block has plated, so a nested one does not plate on top of it. */
const PlatedContext = createContext(false);

/**
 * The plate for one block, and a wrapper that stops its children plating again.
 *
 * A loose list item renders as `li > p`, and both nodes' source spans contain
 * the same mark — without the suppression the reader sees two stacked fills for
 * one citation.
 */
function usePlate(node: PositionedNode | undefined, className?: string) {
  const marks = use(MarkContext);
  const plated = use(PlatedContext);
  const mark = plated ? { marked: false, active: false } : blockMark(marks, node);
  return {
    props: blockMarkAttributes(mark, className),
    wrap: (children: ReactNode) =>
      mark.marked ? <PlatedContext value={true}>{children}</PlatedContext> : children,
  };
}

/*
 * The plating blocks are named components rather than inline arrows in the map
 * below: they call a hook, and a lowercase `p:` key is not a component name as
 * far as the rules-of-hooks lint can tell.
 */

const MarkdownParagraph: NonNullable<StreamdownComponents["p"]> = ({
  node,
  className,
  children,
  ...props
}) => {
  const plate = usePlate(node, className);
  return (
    <ProseText {...plate.props} {...props}>
      {plate.wrap(children)}
    </ProseText>
  );
};

const MarkdownListItem: NonNullable<StreamdownComponents["li"]> = ({
  node,
  className,
  children,
  ...props
}) => {
  const plate = usePlate(node, className);
  return (
    <ProseListItem {...plate.props} {...props}>
      {plate.wrap(children)}
    </ProseListItem>
  );
};

const MarkdownCode: NonNullable<StreamdownComponents["code"]> = ({
  node,
  className,
  children,
  ...props
}) => {
  const fence = /\blanguage-/.test(className ?? "");
  // The plate goes on the `<pre>` — the whole fence is what a citation points
  // at. Its own `bg-surface-muted` wins over the plate's fill (see
  // `blockMarkAttributes`), so the code keeps its ground and the rail is what
  // says it is cited.
  const plate = usePlate(
    fence ? node : undefined,
    "bg-surface-muted text-code overflow-x-auto rounded-md p-3 font-mono whitespace-pre",
  );
  // A fence needs its own `<pre>`. With no `@streamdown/code` plugin installed
  // Streamdown emits a BARE `<code data-block>` — no block wrapper — which the
  // surrounding prose's `whitespace-normal` then collapses into one run-on
  // line. The fence is unhighlighted here by design (see the module docblock);
  // it still has to read as a block of code.
  return fence ? (
    <pre {...plate.props}>
      <code className={className} {...props}>
        {plate.wrap(children)}
      </code>
    </pre>
  ) : (
    <ProseInlineCode className={className} {...props}>
      {children}
    </ProseInlineCode>
  );
};

/** Everything that does not depend on the heading offset. */
const SHARED_COMPONENTS: StreamdownComponents = {
  p: MarkdownParagraph,
  a: ({ node: _node, ...props }) => <ProseLink {...props} />,
  // `ref` is stripped: ProseList's intersection ref type (ul & ol) is narrower
  // than the per-element ref react-markdown passes.
  ul: ({ node: _node, ref: _ref, ...props }) => <ProseList {...props} />,
  ol: ({ node: _node, ref: _ref, ...props }) => <ProseList ordered {...props} />,
  li: MarkdownListItem,
  blockquote: ({ node: _node, ...props }) => <ProseBlockquote {...props} />,
  code: MarkdownCode,
};

/**
 * Map the markdown element tree onto the Prose primitives.
 *
 * Built per `baseHeadingLevel` (memoized by the renderer, not rebuilt each
 * render): the map is otherwise pure and Streamdown puts it into a context, so
 * a fresh object per render would re-render every block.
 *
 * The heading offset is the reason this takes an argument at all. A viewed file
 * carries its own heading tree, correct only relative to the page hosting it —
 * a README's `#` inside an app that already has an `<h1>` would otherwise put
 * two `h1`s in a screen reader's flat heading list. Same seam, same arithmetic
 * as `@elabs-ai/components-ai`'s `MarkdownView`.
 */
function buildProseComponents(baseHeadingLevel: ProseHeadingLevel): StreamdownComponents {
  const heading =
    (markdownLevel: number): StreamdownComponents["h1"] =>
    ({ node, className, children, ...props }) => {
      const plate = usePlate(node, className);
      return (
        <ProseHeading
          level={clampHeadingLevel(markdownLevel + baseHeadingLevel - 1)}
          {...plate.props}
          {...props}
        >
          {plate.wrap(children)}
        </ProseHeading>
      );
    };
  return {
    h1: heading(1),
    h2: heading(2),
    h3: heading(3),
    h4: heading(4),
    h5: heading(5),
    h6: heading(6),
    ...SHARED_COMPONENTS,
  };
}

function MarkdownRenderer({
  document: doc,
  className,
  baseHeadingLevel = 2,
  highlights,
  activeHighlightId,
}: AdapterRendererProps) {
  const markdown = doc as MarkdownDocument;
  const { t, formatNumber } = useLocale();
  const translations = useStreamdownTranslations();
  const components = useMemo(() => buildProseComponents(baseHeadingLevel), [baseHeadingLevel]);
  const container = useRef<HTMLDivElement>(null);
  const marks = useMemo(
    () => toMarkRanges(highlights, markdown.text.length),
    [highlights, markdown.text],
  );

  useScrollActiveHighlightIntoView(container, activeHighlightId);

  if (markdown.text.trim().length === 0) {
    return <StatePanel kind="empty" title={t("viewer.file.empty")} className={className} />;
  }

  const Streamdown = streamdown?.Streamdown;
  if (!Streamdown) return null;

  return (
    // No `overflow-auto` here: `FileViewerContent` is the scroll boundary, and
    // nesting a second one clips the last block above the outer pane's padding.
    <div ref={container} className={cn("flex flex-col gap-2", className)}>
      {markdown.totalCharacters !== undefined && (
        // Not an error — the file is fine, we are showing part of it.
        <p role="status" className="text-meta text-muted-foreground">
          {t("viewer.text.truncated", {
            shown: formatNumber(markdown.text.length),
            total: formatNumber(markdown.totalCharacters),
          })}
        </p>
      )}
      {/* `max-w-prose` because this is genuine long-form reading, not a label:
          a README run edge-to-edge across a wide pane loses the line. The pane's
          own padding is the page margin — the article adds none. */}
      <article className="mx-auto max-w-prose space-y-3">
        {/* `mode="static"` is what makes the plates addressable: it hands the
            whole file to ONE parse, so every node's `position.start.offset` is
            an offset into `document.text`. Splitting into blocks (streaming
            mode) would restart them per block. */}
        <MarkContext value={marks}>
          <Streamdown
            mode="static"
            parseIncompleteMarkdown={false}
            components={components}
            translations={translations}
          >
            {markdown.text}
          </Streamdown>
        </MarkContext>
      </article>
    </div>
  );
}

const adapterModule: AdapterModule = {
  manifest: markdownManifest,
  create: () => new MarkdownAdapter(),
  Renderer: MarkdownRenderer,
};

export default adapterModule;
