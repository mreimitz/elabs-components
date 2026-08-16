"use client";

/**
 * MarkdownPreview — renders markdown to REAL @brand components (not default HTML).
 *
 * Built on Streamdown (the same react-markdown + remark engine @elabs-ai/components-ai uses), with
 * a branded `components` map: `#` → Heading, paragraph → Text, link → Link, list →
 * List, table → @elabs-ai/components-ui Table, `---` → Separator, blockquote → Blockquote, and the
 * `:::card`/`:::callout`/`::metric`/`:::timeline` directives → Card / Alert /
 * MetricBlock / Timeline. The directive plugins come from the SHARED
 * `buildMarkdownPlugins()` array, so the preview and the Milkdown editor parse the
 * brand dialect identically. Unknown directives render an explicit error block.
 *
 * Five production seams (#L1 / #L4 / #L18 / #L-wikilink / #L-transclusion):
 * - ```mermaid fences render through the branded `MermaidDiagram`;
 * - `resolveUrl` rewrites image/link targets (private-repo assets, relative paths);
 * - every block carries `data-sourcepos="start:end"` (1-based source lines), and an
 *   `annotations` prop washes changed blocks / marks removals — the "ghost diff";
 * - `resolveWikilink` rewrites `[[target]]` / `[[target|alias]]` /
 *   `[[target#anchor|alias]]` into normal mdast LINK nodes (Obsidian-vault style);
 * - `resolveTransclusion` embeds `![[target]]` / `![[target#section]]` as a
 *   visually-nested, labelled block (recursion capped at 3 levels).
 */
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  createContext,
  forwardRef,
  isValidElement,
  useContext,
  useMemo,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  Streamdown,
  defaultRehypePlugins,
  defaultRemarkPlugins,
  type Components,
} from "streamdown";
import type { PluggableList } from "unified";
import { visit } from "unist-util-visit";

import {
  BRAND_DIRECTIVE_ATTR,
  BRAND_DIRECTIVE_INLINE_TAG,
  BRAND_DIRECTIVE_PROP,
  BRAND_DIRECTIVE_TAG,
  buildMarkdownPlugins,
  type BrandDirectivePayload,
  type MarkdownDirectiveRenderer,
  type MarkdownExtensions,
  type MarkdownFenceRenderer,
} from "../lib/markdown/directives";
import {
  annotationForRange,
  removedMarkerAt,
  shiftAnnotations,
  type MarkdownAnnotation,
} from "../lib/markdown/diff";
import { parseFrontmatter } from "../lib/markdown/frontmatter";
import { CalcBlock, CalcInline, type EvaluateCalc } from "../calc-block";
import { MermaidDiagram } from "../mermaid-diagram";
import { MetricBlock } from "../metric-block";
import { Blockquote, Heading, Link, List, ListItem, Text, type HeadingLevel } from "../prose";
import { Timeline, type TimelineStatus } from "../timeline";
import { CodeFence, fenceLanguage } from "./code-fence";
import { parseMarkdownOutline } from "../markdown-outline";
import remarkMath from "remark-math";
import {
  Bibliography,
  CITE_TAG,
  CITE_PROP,
  CitationProvider,
  collectCitations,
  InlineCite,
  remarkBrandCitations,
  type CitationStyle,
  type CollectedCitations,
  type ResolveCitation,
} from "../markdown-academic/citations";
import {
  FOOTNOTE_ITEM_TAG,
  FOOTNOTE_LIST_TAG,
  FOOTNOTE_PROP,
  FOOTNOTE_REF_TAG,
  FootnoteItem,
  FootnoteList,
  FootnoteRef,
  remarkBrandFootnotes,
} from "../markdown-academic/footnotes";
import {
  MATH_BLOCK_TAG,
  MATH_INLINE_TAG,
  MATH_PROP,
  MathBlockTag,
  MathInlineTag,
  remarkBrandMath,
} from "../markdown-academic/math";
import { TableOfContents, TocProvider, useHeadingId } from "../markdown-academic/toc";
import {
  IterationDirective,
  specFromDirective,
  type EvaluateIteration,
  type InterpolateTemplate,
} from "../markdown-iteration";

// Streamdown's own default remark plugins (gfm etc.). The brand directive
// plugins are appended PER-INSTANCE inside the component, because the known
// directive-name set depends on the consumer's `extensions` (see the `plugins`
// memo below).
const baseRemarkPlugins = Object.values(defaultRemarkPlugins);

/**
 * Custom element for inline transclusion embeds (`![[target]]`). A SEPARATE tag
 * from the brand-directive tags so the sanitize schema stays narrow. The JSON
 * payload property is `data-transclusion` (hast: `dataTransclusion`).
 */
const BRAND_TRANSCLUSION_TAG = "brand-transclusion";
const BRAND_TRANSCLUSION_ATTR = "data-transclusion";
const BRAND_TRANSCLUSION_PROP = "dataTransclusion";

// Allow-list uses the hast PROPERTY name (camelCase), which is what survives
// Streamdown's sanitization — not the rendered `data-brand` attribute name.
// Both directive tags (block/leaf + inline) carry the same JSON payload property.
const allowedTags = {
  [BRAND_DIRECTIVE_TAG]: [BRAND_DIRECTIVE_PROP],
  [BRAND_DIRECTIVE_INLINE_TAG]: [BRAND_DIRECTIVE_PROP],
  [BRAND_TRANSCLUSION_TAG]: [BRAND_TRANSCLUSION_PROP],
  // Academic layer (footnotes / math / citations) — opt-in via props, but the
  // tags are always allow-listed (harmless when the feature is off).
  [FOOTNOTE_REF_TAG]: [FOOTNOTE_PROP],
  [FOOTNOTE_ITEM_TAG]: [FOOTNOTE_PROP],
  [FOOTNOTE_LIST_TAG]: [],
  [MATH_BLOCK_TAG]: [MATH_PROP],
  [MATH_INLINE_TAG]: [MATH_PROP],
  [CITE_TAG]: [CITE_PROP],
};

/** All academic custom tags + their payload props, for the sanitize schema. */
const ACADEMIC_TAGS = [
  FOOTNOTE_REF_TAG,
  FOOTNOTE_ITEM_TAG,
  FOOTNOTE_LIST_TAG,
  MATH_BLOCK_TAG,
  MATH_INLINE_TAG,
  CITE_TAG,
];
const ACADEMIC_TAG_ATTRS: Record<string, string[]> = {
  [FOOTNOTE_REF_TAG]: [FOOTNOTE_PROP],
  [FOOTNOTE_ITEM_TAG]: [FOOTNOTE_PROP],
  [FOOTNOTE_LIST_TAG]: [],
  [MATH_BLOCK_TAG]: [MATH_PROP],
  [MATH_INLINE_TAG]: [MATH_PROP],
  [CITE_TAG]: [CITE_PROP],
};

/**
 * Streamdown's default sanitize schema only lets http(s) image `src` through,
 * which kills the `resolveUrl` story (#L4): authenticated repo assets arrive
 * as `data:`/`blob:` URLs. Extend the SAME default pipeline (raw → sanitize →
 * harden) with those protocols — harden itself already validates them.
 */
const rehypePlugins = (() => {
  const defaults = defaultRehypePlugins as Record<string, unknown>;
  const sanitize = defaults.sanitize as [
    unknown,
    {
      protocols?: Record<string, unknown[]>;
      tagNames?: string[];
      attributes?: Record<string, unknown[]>;
    },
  ];
  const schema = sanitize[1] ?? {};
  const protocols = (schema.protocols ?? {}) as Record<string, unknown[]>;
  const extendedSanitize = [
    sanitize[0],
    {
      ...schema,
      protocols: { ...protocols, src: [...(protocols.src ?? ["http", "https"]), "data", "blob"] },
      // Custom rehypePlugins bypass Streamdown's `allowedTags` merge — so the brand-directive
      // tags, the transclusion tag, and their JSON payload properties all go into the schema here.
      tagNames: [
        ...(schema.tagNames ?? []),
        BRAND_DIRECTIVE_TAG,
        BRAND_DIRECTIVE_INLINE_TAG,
        BRAND_TRANSCLUSION_TAG,
        ...ACADEMIC_TAGS,
      ],
      attributes: {
        ...(schema.attributes ?? {}),
        [BRAND_DIRECTIVE_TAG]: [BRAND_DIRECTIVE_PROP],
        [BRAND_DIRECTIVE_INLINE_TAG]: [BRAND_DIRECTIVE_PROP],
        [BRAND_TRANSCLUSION_TAG]: [BRAND_TRANSCLUSION_PROP],
        ...ACADEMIC_TAG_ATTRS,
      },
    },
  ];
  return [defaults.raw, extendedSanitize, defaults.harden] as PluggableList;
})();

/** Treat the whole document as one block (keeps multi-line directives intact). */
const singleBlock = (md: string): string[] => [md];

/** react-markdown passes `node` to every component — strip it before spreading. */
type MdProps = { node?: unknown; children?: ReactNode } & Record<string, unknown>;

/* ------------------------------------------------------------------ */
/* Contexts (keep the `components` map static across renders)          */
/* ------------------------------------------------------------------ */

const AnnotationsContext = createContext<MarkdownAnnotation[]>([]);

/**
 * In-document search state (term + the active hit's line), threaded to the
 * blocks: the active block gets a primary wash; mermaid fences mark matching
 * nodes. Lines are 1-based relative to the STRIPPED markdown (the provider
 * shifts the public prop).
 */
interface SearchState {
  term?: string;
  activeLine?: number;
  /** Stripped source lines — used to hand the active line's text to diagrams. */
  lines: readonly string[];
}

const SearchContext = createContext<SearchState>({ lines: [] });

/**
 * Hover affordances beside headings (#L6 companion): a generic render-prop —
 * the preview knows nothing about what the action does (pinning, anchors,
 * copy-link…). Revealed on heading hover / focus, and kept visible while the
 * slot contains a pressed toggle (`aria-pressed="true"`).
 */
export interface MarkdownHeadingInfo {
  level: HeadingLevel;
  /** Plain text content of the heading. */
  text: string;
  /** 1-based start line in the frontmatter-STRIPPED source (= `data-sourcepos`). */
  line?: number;
}

const HeadingActionsContext = createContext<((heading: MarkdownHeadingInfo) => ReactNode) | null>(
  null,
);

/**
 * The resolved render registry for this preview instance: directive renderers by
 * name + fence renderers by language (the `extensions` prop, plus the calc fence
 * synthesized from `evaluate`). Consulted by `BrandDirective` /
 * `BrandInlineDirective` (directives) and `PreBlock` (fences).
 */
interface PreviewRegistry {
  directives: Map<string, MarkdownDirectiveRenderer>;
  fences: Map<string, MarkdownFenceRenderer>;
}

const EMPTY_REGISTRY: PreviewRegistry = { directives: new Map(), fences: new Map() };
const RegistryContext = createContext<PreviewRegistry>(EMPTY_REGISTRY);

/**
 * Consumer-supplied link-preview render slot. When supplied, every rendered `<a>`
 * is wrapped via this function; the consumer attaches its own hover card /
 * popover. The library never fetches — the consumer owns the preview content.
 * Default (not supplied) → the plain `Link` component.
 */
const LinkPreviewContext = createContext<((href: string, children: ReactNode) => ReactNode) | null>(
  null,
);

/**
 * Transclusion resolver — threaded into `TransclusionBlock` so recursive
 * `MarkdownPreview` renders can access the same hook without prop-drilling.
 */
const TransclusionResolverContext = createContext<
  ((target: string, opts: TransclusionResolveOptions) => string | null) | null
>(null);

/** Maximum nesting depth for `![[transclusion]]` embeds (prevents cycles). */
const TRANSCLUSION_MAX_DEPTH = 3;

/** Tracks the current embed depth; 0 = top-level document. */
const TransclusionDepthContext = createContext<number>(0);

/** Flatten a rendered heading's children to plain text (descends elements). */
function flattenNodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map((n) => flattenNodeText(n as ReactNode)).join("");
  if (isValidElement(node)) {
    return flattenNodeText((node.props as { children?: ReactNode }).children);
  }
  return "";
}

export type MarkdownUrlKind = "image" | "link";
type UrlResolver = (url: string, kind: MarkdownUrlKind) => string;

/**
 * URL rewriting must happen at the REMARK stage: Streamdown's sanitizer
 * (harden-react-markdown) runs on the hast and blocks unresolvable relative
 * URLs before any React component sees them — so the resolver maps them to
 * absolute (or protocol-carrying) URLs first.
 */
interface MdUrlNode {
  type: string;
  url?: string;
}

function remarkResolveUrls(resolve: UrlResolver) {
  // Unified plugin shape: an ATTACHER that returns the transformer.
  return function attacher() {
    return (tree: unknown) => {
      visit(tree as Parameters<typeof visit>[0], (node) => {
        const n = node as MdUrlNode;
        if (n.type === "image" || n.type === "imageReference") {
          if (typeof n.url === "string") n.url = resolve(n.url, "image");
        } else if (n.type === "link" || n.type === "definition") {
          if (typeof n.url === "string") n.url = resolve(n.url, "link");
        }
      });
    };
  };
}

/* ------------------------------------------------------------------ */
/* Wikilink resolver types (exported for consumers)                    */
/* ------------------------------------------------------------------ */

/**
 * Options passed to `resolveWikilink` for each wikilink found in the document.
 */
export interface WikilinkResolveOptions {
  /** The `#anchor` fragment, if present — e.g. `[[target#Section 1]]` → `"Section 1"`. */
  anchor?: string;
}

/**
 * Options passed to `resolveTransclusion` for each transclusion embed found.
 */
export interface TransclusionResolveOptions {
  /**
   * A `#section` heading, if present — e.g. `![[target#Introduction]]` → `"Introduction"`.
   * The consumer can use this to extract only that section from the document.
   */
  section?: string;
}

/* ------------------------------------------------------------------ */
/* remarkResolveWikilinks — `[[target]]` → mdast link node            */
/* ------------------------------------------------------------------ */

/**
 * Wikilink syntax supported:
 *   `[[target]]`                 → link text = target, href from resolveWikilink(target, {})
 *   `[[target|alias]]`           → link text = alias, href from resolveWikilink(target, {})
 *   `[[target#anchor]]`          → link text = target, href from resolveWikilink(target, { anchor })
 *   `[[target#anchor|alias]]`    → link text = alias, href from resolveWikilink(target, { anchor })
 *   (Obsidian style: anchor is on the TARGET side, before the `|` separator)
 *
 * Unresolvable wikilinks (hook returns null) render as plain text `[[original]]`.
 * The produced link flows through the existing `a:` renderer (resolveUrl + renderLinkPreview apply).
 */
function remarkResolveWikilinks(
  resolve: (target: string, opts: WikilinkResolveOptions) => string | null,
) {
  // Match `[[...]]` but NOT `![[...]]` (transclusion is handled separately).
  // Lookbehind `(?<!!)` ensures we don't consume transclusion prefixes.
  const WIKILINK_RE = /(?<!!)\[\[([^\]]+)\]\]/g;

  return function attacher() {
    return (tree: unknown) => {
      visit(tree as Parameters<typeof visit>[0], "text", (node, index, parent) => {
        const n = node as { type: string; value: string };
        const p = parent as { children?: unknown[] } | undefined;
        if (!p?.children || index == null || typeof n.value !== "string") return;

        const text = n.value;
        // Fast path: no wikilinks in this text node.
        if (!text.includes("[[")) return;

        const newChildren: unknown[] = [];
        let lastIndex = 0;
        WIKILINK_RE.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = WIKILINK_RE.exec(text)) !== null) {
          // Text before this wikilink.
          if (match.index > lastIndex) {
            newChildren.push({ type: "text", value: text.slice(lastIndex, match.index) });
          }

          const inner = match[1]!;
          // Split on FIRST `|` for alias — anchor lives on the target side (before `|`).
          const pipeIdx = inner.indexOf("|");
          const targetPart = pipeIdx !== -1 ? inner.slice(0, pipeIdx) : inner;
          const alias = pipeIdx !== -1 ? inner.slice(pipeIdx + 1) : undefined;

          // Split target on FIRST `#` for anchor.
          const hashIdx = targetPart.indexOf("#");
          const target = hashIdx !== -1 ? targetPart.slice(0, hashIdx) : targetPart;
          const anchor = hashIdx !== -1 ? targetPart.slice(hashIdx + 1) : undefined;

          const opts: WikilinkResolveOptions = anchor ? { anchor } : {};
          const href = resolve(target.trim(), opts);
          const linkText = alias?.trim() || target.trim();

          if (href === null) {
            // Unresolvable → plain text, preserving the original `[[…]]` literal.
            newChildren.push({ type: "text", value: match[0] });
          } else {
            // A normal mdast link — flows through the existing `a:` renderer.
            newChildren.push({
              type: "link",
              url: href,
              title: null,
              children: [{ type: "text", value: linkText }],
            });
          }

          lastIndex = match.index + match[0].length;
        }

        // Remaining text after the last wikilink.
        if (lastIndex < text.length) {
          newChildren.push({ type: "text", value: text.slice(lastIndex) });
        }

        // Only splice if we actually found wikilinks.
        if (newChildren.length > 0) {
          p.children.splice(index, 1, ...newChildren);
          // Return the next index to skip past the newly inserted nodes.
          return index + newChildren.length;
        }
      });
    };
  };
}

/* ------------------------------------------------------------------ */
/* remarkResolveTransclusions — `![[target]]` → brand-transclusion    */
/* ------------------------------------------------------------------ */

interface TransclusionPayload {
  target: string;
  section?: string;
}

/**
 * Rewrites standalone `![[target]]` / `![[target#section]]` lines into a custom
 * `<brand-transclusion>` element carrying a JSON payload. The React component
 * (`TransclusionBlock`) resolves + renders the content recursively, with a
 * depth cap to prevent infinite loops.
 *
 * "Standalone" means the wikilink embed appears as its own paragraph (the most
 * common Obsidian authoring pattern). Embeds mid-sentence are also caught via
 * the text-node transform but are treated as paragraph-level blocks by inserting
 * a paragraph wrapper — this keeps valid mdast structure.
 */
function remarkResolveTransclusions() {
  // A STANDALONE transclusion: a paragraph whose only content is `![[target]]`
  // (the Obsidian authoring pattern). Transclusion is a BLOCK embed, so we
  // rewrite the whole PARAGRAPH (not an inline text node — a figure inside <p>
  // would be invalid HTML) and use `data.hName`/`hProperties` (the same reliable
  // mechanism the brand directives use) rather than a raw `html` node, which does
  // not round-trip through Streamdown's rehype pipeline.
  const STANDALONE_RE = /^!\[\[([^\]]+)\]\]$/;

  return function attacher() {
    return (tree: unknown) => {
      visit(tree as Parameters<typeof visit>[0], "paragraph", (node) => {
        const n = node as {
          children?: { type: string; value?: string }[];
          data?: { hName?: string; hProperties?: Record<string, unknown> };
        };
        if (!n.children || n.children.length !== 1) return;
        const child = n.children[0]!;
        if (child.type !== "text" || typeof child.value !== "string") return;

        const match = child.value.trim().match(STANDALONE_RE);
        if (!match) return;

        const inner = match[1]!;
        const hashIdx = inner.indexOf("#");
        const target = (hashIdx !== -1 ? inner.slice(0, hashIdx) : inner).trim();
        const section = hashIdx !== -1 ? inner.slice(hashIdx + 1).trim() : undefined;
        const payload: TransclusionPayload = section ? { target, section } : { target };

        const data = n.data ?? (n.data = {});
        data.hName = BRAND_TRANSCLUSION_TAG;
        data.hProperties = { [BRAND_TRANSCLUSION_PROP]: JSON.stringify(payload) };
        n.children = []; // consumed into the payload; TransclusionBlock renders it
      });
    };
  };
}

interface SourcePos {
  start: number;
  end: number;
}

/** Does a DESCENDANT list item already contain this line? (innermost li wins) */
function nestedItemContains(node: unknown, line: number): boolean {
  const kids = (node as { children?: unknown[] } | undefined)?.children ?? [];
  for (const kid of kids) {
    const el = kid as { tagName?: string };
    if (el.tagName === "li") {
      const pos = getSourcePos(kid);
      if (pos && line >= pos.start && line <= pos.end) return true;
    }
    if (nestedItemContains(kid, line)) return true;
  }
  return false;
}

function getSourcePos(node: unknown): SourcePos | undefined {
  const pos = (
    node as { position?: { start?: { line?: number }; end?: { line?: number } } } | undefined
  )?.position;
  if (typeof pos?.start?.line !== "number") return undefined;
  return { start: pos.start.line, end: pos.end?.line ?? pos.start.line };
}

function RemovedMarker({ count }: { count: number }) {
  return (
    <div
      role="note"
      aria-label={`${count} ${count === 1 ? "line" : "lines"} removed here`}
      className="flex items-center gap-2 text-meta text-destructive-text"
    >
      <span aria-hidden="true" className="font-mono">
        −
      </span>
      <span aria-hidden="true" className="flex-1 border-t border-dashed border-destructive/40" />
      <span>
        {count} {count === 1 ? "line" : "lines"} removed
      </span>
      <span aria-hidden="true" className="flex-1 border-t border-dashed border-destructive/40" />
    </div>
  );
}

/**
 * Wrap a block renderer with the sourcepos + annotation layer: stamps
 * `data-sourcepos`, washes added/modified blocks (accent rail + tint), washes
 * the active search hit's block (primary tint), and renders the
 * removed-content marker anchored to this block.
 *
 * `searchWash: false` opts a block out of the active-search wash — `pre`
 * fences (incl. mermaid) carry their own treatment.
 */
function annotated(render: (props: MdProps) => ReactNode, searchWash = true) {
  return function AnnotatedBlock(props: MdProps) {
    const annotations = useContext(AnnotationsContext);
    const search = useContext(SearchContext);
    const pos = getSourcePos(props.node);
    const enriched = pos ? { ...props, "data-sourcepos": `${pos.start}:${pos.end}` } : props;

    const wash =
      pos && annotations.length > 0
        ? annotationForRange(annotations, pos.start, pos.end)
        : undefined;
    const removed =
      pos && annotations.length > 0 ? removedMarkerAt(annotations, pos.start) : undefined;
    const activeSearch =
      searchWash &&
      pos != null &&
      search.activeLine != null &&
      search.activeLine >= pos.start &&
      search.activeLine <= pos.end;

    let content = render(enriched);
    if (!wash && !removed && !activeSearch) return content;

    if (wash) {
      content = (
        <div
          data-annotation={wash.kind}
          className="border-s-2 border-s-success bg-success/10 py-1.5 pe-2 ps-3"
        >
          {content}
        </div>
      );
    }
    if (activeSearch) {
      content = (
        <div data-search-active="" className="-mx-2 rounded-md bg-primary/10 px-2 py-1">
          {content}
        </div>
      );
    }
    return (
      <>
        {removed ? <RemovedMarker count={removed.removedCount ?? 1} /> : null}
        {content}
      </>
    );
  };
}

function heading(level: HeadingLevel) {
  return function HeadingMd({ node: _n, children, ...rest }: MdProps) {
    const headingActions = useContext(HeadingActionsContext);
    const start = (rest["data-sourcepos"] as string | undefined)?.split(":")[0];
    const line = start ? Number(start) : undefined;
    // Stable slug id (only when TOC is enabled) so `::toc` anchors resolve.
    const headingId = useHeadingId(line);
    const slot = headingActions?.({
      level,
      text: flattenNodeText(children),
      line,
    });
    return (
      <Heading
        level={level}
        id={headingId}
        {...(rest as HTMLAttributes<HTMLHeadingElement>)}
        className={cn(
          slot ? "group/heading" : undefined,
          headingId ? "scroll-mt-4" : undefined,
          rest.className as string | undefined,
        )}
      >
        {children}
        {slot ? (
          <span
            // GitHub-anchor grammar: revealed on hover/focus; stays visible
            // while a contained toggle is pressed (a pinned section keeps its pin).
            className="ms-1.5 inline-flex align-middle opacity-0 transition-opacity duration-fast ease-standard focus-within:opacity-100 group-hover/heading:opacity-100 has-[[aria-pressed=true]]:opacity-100 motion-reduce:transition-none"
          >
            {slot}
          </span>
        ) : null}
      </Heading>
    );
  };
}

const CALLOUT_VARIANT: Record<string, "default" | "info" | "success" | "warning" | "destructive"> =
  {
    info: "info",
    note: "info",
    tip: "success",
    success: "success",
    warning: "warning",
    caution: "warning",
    danger: "destructive",
    error: "destructive",
    destructive: "destructive",
  };

const TIMELINE_STATUS: Record<string, TimelineStatus> = {
  done: "done",
  complete: "done",
  completed: "done",
  active: "active",
  current: "active",
  pending: "pending",
  todo: "pending",
};

function UnknownBlock({ name }: { name: string }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Unknown block: {name}</AlertTitle>
      <AlertDescription>
        No renderer is mapped for <code>:::{name}</code>. Add it to the brand directive registry, or
        fix the directive name.
      </AlertDescription>
    </Alert>
  );
}

/** Parse the JSON payload off a `<brand-directive*>` element's props. */
function readDirectivePayload(rest: MdProps): BrandDirectivePayload | "malformed" | null {
  const raw =
    (rest[BRAND_DIRECTIVE_ATTR] as string | undefined) ?? (rest.dataBrand as string | undefined);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BrandDirectivePayload;
  } catch {
    return "malformed";
  }
}

function BrandDirective({ node: _n, children, ...rest }: MdProps) {
  const registry = useContext(RegistryContext);
  const payload = readDirectivePayload(rest);
  if (payload === null) return null;
  if (payload === "malformed") return <UnknownBlock name="malformed" />;

  if (!payload.known) return <UnknownBlock name={payload.name} />;

  const attrs = payload.attributes ?? {};
  switch (payload.name) {
    case "card":
      return (
        <Card>
          {attrs.title ? (
            <CardHeader>
              <CardTitle>{attrs.title}</CardTitle>
            </CardHeader>
          ) : null}
          <CardContent className={cn(!attrs.title && "pt-6")}>{children}</CardContent>
        </Card>
      );
    case "callout":
      return (
        <Alert variant={CALLOUT_VARIANT[attrs.type ?? ""] ?? "default"}>
          {/* Callout title is a label, NOT a document section heading — a callout is
              inserted INTO the content flow, so an <h5> (AlertTitle's default for a
              standalone banner) would break the document heading outline. Render the
              same visual as a non-heading <div> instead (see #21). */}
          {attrs.title ? (
            <div className="mb-1 font-medium leading-none tracking-tight">{attrs.title}</div>
          ) : null}
          <AlertDescription>{children}</AlertDescription>
        </Alert>
      );
    case "metric":
      return (
        <MetricBlock
          label={attrs.label ?? ""}
          value={attrs.value ?? ""}
          description={attrs.description}
          delta={attrs.delta}
          deltaDirection={
            attrs.delta?.startsWith("+") ? "up" : attrs.delta?.startsWith("-") ? "down" : "neutral"
          }
        />
      );
    case "timeline":
      return (
        <Timeline
          items={(payload.items ?? []).map((it) => ({
            title: it.title,
            status: TIMELINE_STATUS[it.status] ?? "pending",
          }))}
        />
      );
    default: {
      // Not a built-in → a consumer-registered directive (`extensions`). The
      // name reached `known: true` only because it was registered, so a renderer
      // should exist; if somehow missing, surface the unknown-block error.
      const renderer = registry.directives.get(payload.name);
      if (renderer && (!renderer.kinds || renderer.kinds.includes(payload.kind))) {
        return (
          <>
            {renderer.render({
              name: payload.name,
              kind: payload.kind,
              attributes: attrs,
              children,
              textValue: payload.label,
              rawBody: payload.body,
            })}
          </>
        );
      }
      return <UnknownBlock name={payload.name} />;
    }
  }
}

/**
 * Inline (`:name[label]{attrs}`) directives. Rendered via a SEPARATE tag so it
 * stays in the text flow (no block wrapper / annotation layer). Only registered
 * inline names reach here (unregistered ones were restored to literal text by
 * the parser); a registered name with no inline renderer falls back to its label.
 */
function BrandInlineDirective({ node: _n, children, ...rest }: MdProps) {
  const registry = useContext(RegistryContext);
  const payload = readDirectivePayload(rest);
  if (payload === null || payload === "malformed") return <>{children}</>;

  const renderer = registry.directives.get(payload.name);
  if (!renderer || (renderer.kinds && !renderer.kinds.includes("inline"))) {
    return <>{children}</>;
  }
  return (
    <>
      {renderer.render({
        name: payload.name,
        kind: "inline",
        attributes: payload.attributes ?? {},
        children,
        textValue: payload.label,
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Mermaid fences + resolved images/links                              */
/* ------------------------------------------------------------------ */

/** Flatten react-markdown `children` (string | array) into the raw fence text. */
function fenceText(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map((c) => fenceText(c as ReactNode)).join("");
  return "";
}

function isMermaidCodeElement(child: unknown): child is ReactElement<{
  className?: string;
  children?: ReactNode;
}> {
  return (
    isValidElement(child) &&
    /\blanguage-mermaid\b/.test((child.props as { className?: string } | null)?.className ?? "")
  );
}

function PreBlock({ node, children, ...rest }: MdProps) {
  const search = useContext(SearchContext);
  const registry = useContext(RegistryContext);
  const pos = getSourcePos(node);
  const activeInBlock =
    pos != null &&
    search.activeLine != null &&
    search.activeLine >= pos.start &&
    search.activeLine <= pos.end;

  const list = Array.isArray(children) ? children : [children];
  // Mermaid stays a PRIVILEGED built-in: it carries search-highlight + active-line
  // coupling that the generic `{ source, lang }` fence contract deliberately omits.
  const mermaidChild = list.find(isMermaidCodeElement);
  if (mermaidChild) {
    const chart = fenceText((mermaidChild.props as { children?: ReactNode }).children).replace(
      /\n$/,
      "",
    );
    return (
      <MermaidDiagram
        chart={chart}
        // The diagram must stay addressable by source line (outline/search jumps).
        data-sourcepos={pos ? `${pos.start}:${pos.end}` : undefined}
        highlightTerm={search.term}
        activeText={
          activeInBlock && search.activeLine != null
            ? search.lines[search.activeLine - 1]
            : undefined
        }
      />
    );
  }
  // Registered fences (the seam): calc is registered from the `evaluate` prop;
  // consumers register their own via `extensions.fences`. The library renders the
  // result; the consumer's renderer owns any domain hook. Stamp `data-sourcepos`
  // so the block stays addressable by outline/search jumps.
  const codeEl = list.find(isValidElement) as
    | ReactElement<{ className?: string; children?: ReactNode }>
    | undefined;
  const fenceLang = fenceLanguage(codeEl?.props.className);
  const fenceRenderer = fenceLang ? registry.fences.get(fenceLang) : undefined;
  if (fenceLang && fenceRenderer && codeEl) {
    const source = fenceText(codeEl.props.children).replace(/\n$/, "");
    const rendered = fenceRenderer.render({ source, lang: fenceLang });
    return pos ? <div data-sourcepos={`${pos.start}:${pos.end}`}>{rendered}</div> : <>{rendered}</>;
  }
  // Non-mermaid, unregistered fences: tokenized highlighting + language chip + hover copy.
  // The fence keeps its source-line address (`data-sourcepos` arrives via
  // `rest` onto the wrapper) and the active-search wash on the inner pre.
  const codeText = fenceText(codeEl ? codeEl.props.children : (children as ReactNode)).replace(
    /\n$/,
    "",
  );
  return (
    <CodeFence
      {...(rest as HTMLAttributes<HTMLElement>)}
      codeText={codeText}
      language={fenceLang}
      searchActive={activeInBlock}
    >
      {children}
    </CodeFence>
  );
}

function ImageMd({ node: _n, src, alt, ...rest }: MdProps) {
  return (
    <img
      src={src as string}
      alt={(alt as string) ?? ""}
      loading="lazy"
      className="max-w-full rounded-md border border-border"
      {...(rest as HTMLAttributes<HTMLImageElement>)}
    />
  );
}

function LinkMd({ node: _n, href, children, ...rest }: MdProps) {
  const renderLinkPreview = useContext(LinkPreviewContext);
  const anchor = (
    <Link href={href as string} {...(rest as HTMLAttributes<HTMLAnchorElement>)}>
      {children}
    </Link>
  );
  if (renderLinkPreview && typeof href === "string") {
    return <>{renderLinkPreview(href, anchor)}</>;
  }
  return anchor;
}

/**
 * Renders a `![[target]]` / `![[target#section]]` transclusion embed.
 *
 * - Reads the payload from the `data-transclusion` attribute (JSON).
 * - Calls `resolveTransclusion(target, { section })` to get markdown text.
 * - If null → renders the literal `![[target]]` as plain text.
 * - If at the depth cap → renders a "transclusion too deep" notice.
 * - Otherwise → recursively renders the returned markdown via `MarkdownPreview`
 *   inside a visually-nested, semantically-labelled block.
 *
 * The block uses a quiet inset separation: border-start rail + muted ground
 * (no redundant border over the fill; satisfies the separation grammar).
 */
function TransclusionBlock({ node: _n, ...rest }: MdProps) {
  const resolveTransclusion = useContext(TransclusionResolverContext);
  const depth = useContext(TransclusionDepthContext);
  const linkPreview = useContext(LinkPreviewContext);

  // Parse the JSON payload from the hast attribute.
  const rawAttr =
    (rest[BRAND_TRANSCLUSION_ATTR] as string | undefined) ??
    (rest.dataTransclusion as string | undefined);

  if (!rawAttr || !resolveTransclusion) {
    // No resolver or malformed — render as literal fallback.
    return (
      <span>{rawAttr ? `![[${(JSON.parse(rawAttr) as TransclusionPayload).target}]]` : null}</span>
    );
  }

  let payload: TransclusionPayload;
  try {
    payload = JSON.parse(rawAttr) as TransclusionPayload;
  } catch {
    return null;
  }

  const { target, section } = payload;
  const label = section ? `${target}#${section}` : target;

  if (depth >= TRANSCLUSION_MAX_DEPTH) {
    return (
      <figure
        aria-label={`Embedded: ${label}`}
        className="my-3 rounded-md border-s-2 border-s-muted bg-muted/40 px-4 py-3"
        data-testid="transclusion-block"
        data-transclusion-depth={depth}
      >
        <figcaption className="mb-1 text-meta text-muted-foreground">{label}</figcaption>
        <p className="text-meta text-muted-foreground italic">
          Transclusion too deep — embed skipped.
        </p>
      </figure>
    );
  }

  const content = resolveTransclusion(target, section ? { section } : {});

  if (content === null) {
    // Unresolvable → plain text, never a broken element.
    return <span>{`![[${label}]]`}</span>;
  }

  // Recursive render: inner MarkdownPreview reads depth+1 from context.
  // We thread the SAME linkPreview context so consumer hooks propagate.
  // NOTE: We render a plain MarkdownPreview without frontmatter strip by default.
  // We must not import MarkdownPreview here (circular ref) — instead we render the
  // Streamdown directly with the same plugin set. We solve this by rendering a
  // lightweight recursive wrapper that bypasses the outer forwardRef. We achieve
  // this by reading the current plugin array from the outer `plugins` memo (not
  // possible here) — so instead we compose a separate inner pipeline with the same
  // base plugins. The new contexts (depth + resolver + linkPreview) are provided by
  // the outer MarkdownPreview render tree and inherited by RecursiveTransclusion.
  return (
    <TransclusionDepthContext.Provider value={depth + 1}>
      <LinkPreviewContext.Provider value={linkPreview}>
        <RecursiveTransclusionContent target={target} label={label} content={content} />
      </LinkPreviewContext.Provider>
    </TransclusionDepthContext.Provider>
  );
}

/** Inner render for a resolved transclusion — used by TransclusionBlock. */
function RecursiveTransclusionContent({
  target: _target,
  label,
  content,
}: {
  target: string;
  label: string;
  content: string;
}) {
  const plugins = useMemo<PluggableList>(() => {
    return [...baseRemarkPlugins, ...buildMarkdownPlugins()];
  }, []);

  return (
    <figure
      aria-label={`Embedded: ${label}`}
      className="my-3 rounded-md border-s-2 border-s-muted bg-muted/40 px-4 py-2"
      data-testid="transclusion-block"
    >
      <figcaption className="mb-1.5 text-meta text-muted-foreground">{label}</figcaption>
      <div className="text-body text-foreground">
        <Streamdown
          parseMarkdownIntoBlocksFn={singleBlock}
          remarkPlugins={plugins}
          rehypePlugins={rehypePlugins}
          allowedTags={allowedTags}
          components={components}
        >
          {content}
        </Streamdown>
      </div>
    </figure>
  );
}

const components = {
  h1: annotated(heading(1)),
  h2: annotated(heading(2)),
  h3: annotated(heading(3)),
  h4: annotated(heading(4)),
  h5: annotated(heading(5)),
  h6: annotated(heading(6)),
  p: annotated(({ node: _n, ...p }: MdProps) => (
    <Text {...(p as HTMLAttributes<HTMLParagraphElement>)} />
  )),
  a: LinkMd,
  img: ImageMd,
  // Lists wash at ITEM granularity (a whole-list wash drowns the page), so the
  // ul/ol wrappers opt out of the search wash and the li carries it inline
  // (no wrapper div — that would break list semantics).
  ul: annotated(
    ({ node: _n, ...p }: MdProps) => <List {...(p as HTMLAttributes<HTMLElement>)} />,
    false,
  ),
  ol: annotated(
    ({ node: _n, ...p }: MdProps) => <List ordered {...(p as HTMLAttributes<HTMLElement>)} />,
    false,
  ),
  li: function ListItemMd({ node, ...p }: MdProps) {
    const search = useContext(SearchContext);
    const pos = getSourcePos(node);
    const active =
      pos != null &&
      search.activeLine != null &&
      search.activeLine >= pos.start &&
      search.activeLine <= pos.end &&
      !nestedItemContains(node, search.activeLine);
    return (
      <ListItem
        data-sourcepos={pos ? `${pos.start}:${pos.end}` : undefined}
        data-search-active={active ? "" : undefined}
        {...(p as HTMLAttributes<HTMLLIElement>)}
        className={cn(active && "-mx-1 rounded-sm bg-primary/10 px-1", p.className as string)}
      />
    );
  },
  blockquote: annotated(({ node: _n, ...p }: MdProps) => (
    <Blockquote {...(p as HTMLAttributes<HTMLQuoteElement>)} />
  )),
  hr: annotated(() => <Separator className="my-4" />),
  pre: annotated(PreBlock, false),
  table: annotated(({ node: _n, ...p }: MdProps) => (
    <Table {...(p as HTMLAttributes<HTMLTableElement>)} />
  )),
  thead: ({ node: _n, ...p }: MdProps) => <TableHeader {...(p as object)} />,
  tbody: ({ node: _n, ...p }: MdProps) => <TableBody {...(p as object)} />,
  tr: ({ node: _n, ...p }: MdProps) => <TableRow {...(p as object)} />,
  th: ({ node: _n, ...p }: MdProps) => <TableHead {...(p as object)} />,
  td: ({ node: _n, ...p }: MdProps) => <TableCell {...(p as object)} />,
  [BRAND_DIRECTIVE_TAG]: annotated(BrandDirective),
  // Inline directives render un-`annotated` (no block wrapper) to stay in the text flow.
  [BRAND_DIRECTIVE_INLINE_TAG]: BrandInlineDirective,
  // Transclusion embeds (`![[target]]`) — resolved + recursively rendered by TransclusionBlock.
  [BRAND_TRANSCLUSION_TAG]: TransclusionBlock,
  // Academic layer — footnotes, math, citations (inline tags stay in the text flow;
  // the footnote section is a generated block).
  [FOOTNOTE_REF_TAG]: FootnoteRef,
  [FOOTNOTE_ITEM_TAG]: FootnoteItem,
  [FOOTNOTE_LIST_TAG]: ({ node: _n, children, ...rest }: MdProps) => (
    <FootnoteList {...(rest as HTMLAttributes<HTMLElement>)}>{children}</FootnoteList>
  ),
  [MATH_INLINE_TAG]: MathInlineTag,
  [MATH_BLOCK_TAG]: MathBlockTag,
  [CITE_TAG]: InlineCite,
} as unknown as Components;

export interface MarkdownPreviewProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Markdown source. */
  children: string;
  /** Strip a leading YAML frontmatter block before rendering. Default true. */
  stripFrontmatter?: boolean;
  /**
   * Ghost-diff annotations (#L18) — typically from `computeMarkdownAnnotations`.
   * Lines are 1-based relative to the FULL `children` source (frontmatter
   * included); the preview shifts them when `stripFrontmatter` removes lines.
   */
  annotations?: MarkdownAnnotation[];
  /**
   * Rewrite image/link URLs (#L4) — e.g. resolve repo-relative paths or swap
   * private-repo asset URLs for authenticated blob URLs. Synchronous by design:
   * async consumers cache upstream and re-render when the URL is ready.
   */
  resolveUrl?: (url: string, kind: MarkdownUrlKind) => string;
  /**
   * In-document search term (≥2 chars): mermaid diagrams mark matching nodes.
   * Pair with an app-side text highlighter (CSS Custom Highlight API) for the
   * prose occurrences.
   */
  searchTerm?: string;
  /**
   * 1-based line of the ACTIVE search hit, relative to the FULL `children`
   * source (same convention as `annotations`). Its block gets a primary wash;
   * in a mermaid fence the matching node gets the active stroke.
   */
  activeSearchLine?: number;
  /**
   * Render hover affordances beside each heading (pin/anchor/copy-link…).
   * Presentational slot — revealed on heading hover/focus and kept visible
   * while it contains a pressed toggle. `line` is in frontmatter-STRIPPED
   * coordinates (the same space as `data-sourcepos` / `parseMarkdownOutline`).
   */
  headingActions?: (heading: MarkdownHeadingInfo) => ReactNode;
  /**
   * Evaluate a ```calc fence to a `CalcSheet` (the library renders, the app
   * computes — mirrors `resolveUrl`). With no `evaluate`, a ```calc fence renders
   * as a normal code block; the math engine stays in the consumer.
   *
   * Sugar over `extensions.fences`: it registers a built-in `calc` fence renderer.
   * Register your own `calc` fence via `extensions` to override it.
   */
  evaluate?: EvaluateCalc;
  /**
   * Extend the markdown dialect without forking the engine: register custom
   * `:::`/`::`/`:` directive renderers and ```lang fence renderers. Registered
   * directive names are also fed to the parser (so `:entity[…]` is recognized
   * while an unregistered prose colon stays literal). Domain logic stays in the
   * consumer's renderer (the library renders; the app computes).
   */
  extensions?: MarkdownExtensions;
  /**
   * Resolve an Obsidian-style wikilink (`[[target]]`, `[[target|alias]]`,
   * `[[target#anchor]]`, `[[target#anchor|alias]]`) to a URL.
   *
   * - Return a string href to produce a real `<a>` (flows through `resolveUrl`
   *   and `renderLinkPreview` like any other link).
   * - Return `null` to leave the wikilink as literal plain text `[[target]]`
   *   (graceful — never a broken link).
   *
   * Supported forms:
   * - `[[target]]` → `resolveWikilink("target", {})`
   * - `[[target|alias]]` → `resolveWikilink("target", {})`, link text = alias
   * - `[[target#anchor]]` → `resolveWikilink("target", { anchor: "anchor" })`
   * - `[[target#anchor|alias]]` → `resolveWikilink("target", { anchor: "anchor" })`, text = alias
   */
  resolveWikilink?: (target: string, opts: WikilinkResolveOptions) => string | null;
  /**
   * Resolve an Obsidian-style transclusion embed (`![[target]]`,
   * `![[target#section]]`) to the markdown TEXT to embed.
   *
   * - Return the markdown string to embed; it will be recursively rendered as a
   *   visually-nested, AT-labelled block (depth cap: 3 levels).
   * - Return `null` to leave the embed as literal plain text `![[target]]`.
   *
   * The library never fetches — the consumer owns the vault index and resolution.
   */
  resolveTransclusion?: (target: string, opts: TransclusionResolveOptions) => string | null;
  /**
   * Wrap every rendered `<a>` to attach a hover/inline link preview (e.g. a
   * `@elabs-ai/components-ui` HoverCard showing metadata). The library does NOT fetch; the
   * consumer owns the preview content.
   *
   * Return `children` unchanged if the href should not trigger a preview.
   * Default (not supplied) → the plain `Link` component.
   */
  renderLinkPreview?: (href: string, children: ReactNode) => ReactNode;
  /**
   * Branded GFM footnotes (`[^1]` … `[^1]: definition`) — quiet superscript refs
   * + a footnote section at the document end with working same-page back-refs.
   * Default `false` (footnotes parse but render with the plain GFM treatment).
   */
  footnotes?: boolean;
  /**
   * Math via `remark-math` + KaTeX — `$inline$` and `$$block$$` (on their own
   * lines). KaTeX runs untrusted-safe (`trust:false`, bounded macro expansion);
   * MathML is emitted for assistive tech. **The consumer must load KaTeX CSS once**
   * (`import "katex/dist/katex.min.css"`). Default `false`.
   */
  math?: boolean;
  /**
   * Resolve a Pandoc / Better-BibTeX citation key (`[@smith2020]`,
   * `[@a; @b]`, `[@a, p. 5]`, `[-@a]`) to {@link CitationData}, or `null` when
   * unknown. The BibTeX/CSL database + any CSL formatting live in the app — the
   * library renders inline cites + the `::bibliography` / `::references` block with
   * consistent numbering. Setting this enables citations (the same way `evaluate`
   * enables calc).
   */
  resolveCitation?: ResolveCitation;
  /** Inline citation style: `"numeric"` `[1]` (default) or `"author-year"` `(Smith 2020)`. */
  citationStyle?: CitationStyle;
  /**
   * Enable the generated `::toc` block (a quiet in-flow table of contents) and
   * stamp stable slug `id`s on headings so the anchors resolve. Reuses the same
   * heading extractor as `DocumentOutline`. Default `false`.
   */
  toc?: boolean;
  /**
   * Resolve a `:::iterate` / `:::pivot` block's {@link IterationSpec} (parsed from
   * the directive's attributes + body template) to its data. The data source +
   * any query live in the app — the library renders the repeated/cross-tabbed
   * cells. Setting this enables the `iterate` + `pivot` directives (the way
   * `evaluate` enables calc).
   */
  evaluateIteration?: EvaluateIteration;
  /**
   * Fill a `:::iterate` cell template with its row/cell context. Default: a
   * minimal `{{path}}` substitution — pass your own engine for anything richer.
   */
  interpolate?: InterpolateTemplate;
}

export const MarkdownPreview = forwardRef<HTMLDivElement, MarkdownPreviewProps>(
  function MarkdownPreview(
    {
      children,
      stripFrontmatter = true,
      annotations,
      resolveUrl,
      searchTerm,
      activeSearchLine,
      headingActions,
      evaluate,
      extensions,
      resolveWikilink,
      resolveTransclusion,
      renderLinkPreview,
      footnotes,
      math,
      resolveCitation,
      citationStyle = "numeric",
      toc,
      evaluateIteration,
      interpolate,
      className,
      ...props
    },
    ref,
  ) {
    const markdown = stripFrontmatter ? parseFrontmatter(children).content : children;
    const fmOffset = stripFrontmatter
      ? children.split("\n").length - markdown.split("\n").length
      : 0;

    const shifted = useMemo(() => {
      if (!annotations?.length) return [];
      return fmOffset ? shiftAnnotations(annotations, fmOffset) : annotations;
    }, [annotations, fmOffset]);

    const search = useMemo<SearchState>(() => {
      const term = searchTerm?.trim();
      const activeLine =
        activeSearchLine != null && activeSearchLine - fmOffset >= 1
          ? activeSearchLine - fmOffset
          : undefined;
      return {
        term: term && term.length >= 2 ? term : undefined,
        activeLine,
        lines: markdown.split("\n"),
      };
    }, [searchTerm, activeSearchLine, fmOffset, markdown]);

    // Citation numbering authority — a single pre-pass so inline `[1]` and the
    // bibliography agree (only when a resolver is supplied).
    const citations = useMemo<CollectedCitations | null>(() => {
      if (!resolveCitation) return null;
      return collectCitations(markdown, resolveCitation);
    }, [markdown, resolveCitation]);

    // Heading outline for the `::toc` block + heading-id stamping (only when on).
    const outline = useMemo(() => (toc ? parseMarkdownOutline(markdown) : null), [toc, markdown]);

    // Resolve the render registry (directives + fences) for this instance. The
    // `evaluate` prop is sugar that registers the built-in `calc` fence.
    const registry = useMemo<PreviewRegistry>(() => {
      const directives = new Map<string, MarkdownDirectiveRenderer>();
      for (const d of extensions?.directives ?? []) directives.set(d.name, d);
      const fences = new Map<string, MarkdownFenceRenderer>();
      for (const f of extensions?.fences ?? []) fences.set(f.lang, f);
      // `::toc` + `::bibliography` / `::references` — internal directives whose
      // renderers read the outline / citation context (provided below).
      if (toc) {
        directives.set("toc", {
          name: "toc",
          kinds: ["leaf", "container"],
          render: ({ attributes }) => <TableOfContents title={attributes.title || undefined} />,
        });
      }
      if (resolveCitation) {
        const renderBibliography: MarkdownDirectiveRenderer["render"] = ({ attributes }) => (
          <Bibliography title={attributes.title || undefined} />
        );
        directives.set("bibliography", {
          name: "bibliography",
          kinds: ["leaf", "container"],
          render: renderBibliography,
        });
        directives.set("references", {
          name: "references",
          kinds: ["leaf", "container"],
          render: renderBibliography,
        });
      }
      if (evaluateIteration) {
        // `:::iterate` / `:::pivot` — the body is the per-cell TEMPLATE (captured
        // raw via `rawBodyNames`); cells render through a nested `MarkdownPreview`
        // that inherits the dialect features (depth-capped against runaway loops).
        const iterationDirective = (name: "iterate" | "pivot"): MarkdownDirectiveRenderer => ({
          name,
          kinds: ["container"],
          render: ({ attributes, rawBody }) => (
            <IterationDirective
              spec={specFromDirective(name, attributes, rawBody)}
              evaluate={evaluateIteration}
              interpolate={interpolate}
              // Cells render through a nested preview that inherits the dialect
              // features. Extracted to `IterationCell` so `MarkdownPreview` isn't
              // referenced inside its own initializer (TS2786 / forwardRef cycle).
              renderCell={(md) => (
                <IterationCell
                  markdown={md}
                  config={{
                    evaluateIteration,
                    interpolate,
                    evaluate,
                    extensions,
                    footnotes,
                    math,
                    resolveCitation,
                    citationStyle,
                  }}
                />
              )}
            />
          ),
        });
        directives.set("iterate", iterationDirective("iterate"));
        directives.set("pivot", iterationDirective("pivot"));
      }
      if (evaluate && !fences.has("calc")) {
        fences.set("calc", {
          lang: "calc",
          render: ({ source }) => <CalcBlock source={source} evaluate={evaluate} />,
        });
      }
      if (evaluate && !directives.has("calc")) {
        directives.set("calc", {
          name: "calc",
          kinds: ["inline"],
          // `textValue` is the verbatim expression (markdown chars preserved);
          // fall back to the rendered label only if positions were unavailable.
          render: ({ textValue, children }) => (
            <CalcInline source={textValue ?? flattenNodeText(children)} evaluate={evaluate} />
          ),
        });
      }
      return { directives, fences };
    }, [
      extensions,
      evaluate,
      toc,
      resolveCitation,
      citationStyle,
      evaluateIteration,
      interpolate,
      footnotes,
      math,
    ]);

    // Stable key over the registered directive NAMES (space-joined): the parser only
    // needs the known-set, so the plugin array rebuilds on name changes, not on a
    // new `extensions` identity each render.
    // `calc` joins the set when `evaluate` is supplied (so `:calc[…]` parses);
    // `toc` / `bibliography` / `references` join when those features are enabled.
    const directiveNamesKey = [
      ...(extensions?.directives ?? []).map((d) => d.name),
      ...(evaluate ? ["calc"] : []),
      ...(toc ? ["toc"] : []),
      ...(resolveCitation ? ["bibliography", "references"] : []),
      ...(evaluateIteration ? ["iterate", "pivot"] : []),
    ].join(" ");

    const plugins = useMemo<PluggableList>(() => {
      const directiveNames = directiveNamesKey ? directiveNamesKey.split(" ") : [];
      // `:::iterate`/`:::pivot` bodies are captured RAW (as templates) rather than
      // pre-rendered — so they don't render their `{{token}}` source before interpolation.
      const rawBodyNames = evaluateIteration ? ["iterate", "pivot"] : [];
      let list: PluggableList = [
        ...baseRemarkPlugins,
        ...buildMarkdownPlugins({ directiveNames, rawBodyNames }),
      ];
      // Academic transforms run after the directive pipeline. `remarkMath` must
      // precede `remarkBrandMath` (it produces the math nodes the latter rewrites).
      if (math) list = [...list, remarkMath, remarkBrandMath];
      if (footnotes) list = [...list, remarkBrandFootnotes];
      if (resolveCitation) list = [...list, remarkBrandCitations];
      // Wikilinks and transclusions are added BEFORE resolveUrl so any href they
      // produce (wikilinks) flows through the URL resolver as a normal link would.
      // Transclusion embeds produce raw HTML nodes (not mdast links) so order
      // relative to resolveUrl is irrelevant, but we keep them together for clarity.
      if (resolveWikilink) list = [...list, remarkResolveWikilinks(resolveWikilink)];
      if (resolveTransclusion) list = [...list, remarkResolveTransclusions()];
      if (resolveUrl) list = [...list, remarkResolveUrls(resolveUrl)];
      return list;
      // `directiveNamesKey` already folds in `calc`/`toc`/`bibliography` when those
      // are set, so the plugin array tracks them without depending on identities.
    }, [
      resolveUrl,
      resolveWikilink,
      resolveTransclusion,
      directiveNamesKey,
      math,
      footnotes,
      resolveCitation,
      evaluateIteration,
    ]);

    const streamdown = (
      <Streamdown
        // Render as ONE block. Streamdown's default block-splitter (a streaming
        // optimization) severs a multi-line `:::` container directive from its
        // child content (e.g. a `:::timeline` from its list), so the directive
        // arrives empty. The preview re-renders the whole doc anyway, so a single
        // block is both correct and fine for authoring-sized documents.
        parseMarkdownIntoBlocksFn={singleBlock}
        remarkPlugins={plugins}
        rehypePlugins={rehypePlugins}
        allowedTags={allowedTags}
        components={components}
      >
        {markdown}
      </Streamdown>
    );
    // Academic contexts wrap the renderer only when their feature is on, so inline
    // cites + the bibliography share numbering and `::toc` reads the heading slugs.
    const withCitations = citations ? (
      <CitationProvider order={citations.order} byKey={citations.byKey} style={citationStyle}>
        {streamdown}
      </CitationProvider>
    ) : (
      streamdown
    );
    const body = outline ? (
      <TocProvider items={outline}>{withCitations}</TocProvider>
    ) : (
      withCitations
    );

    return (
      <div
        ref={ref}
        data-testid="markdown-preview"
        // Reading rhythm (proximity grammar): headings carry 2–2.5× the space
        // ABOVE vs below — uniform block spacing reads like a teleprinter. The
        // `!` beats Streamdown's internal space-y sibling rule.
        className={cn(
          "text-body text-foreground [&_pre]:my-3",
          "[&_h1]:!mt-10 [&_h2]:!mt-9 [&_h3]:!mt-7 [&_h4]:!mt-6",
          "[&_:is(h1,h2,h3,h4)+*]:!mt-3 [&_:is(h1,h2,h3,h4):first-child]:!mt-0",
          className,
        )}
        {...props}
      >
        <AnnotationsContext.Provider value={shifted}>
          <SearchContext.Provider value={search}>
            <HeadingActionsContext.Provider value={headingActions ?? null}>
              <RegistryContext.Provider value={registry}>
                <LinkPreviewContext.Provider value={renderLinkPreview ?? null}>
                  <TransclusionResolverContext.Provider value={resolveTransclusion ?? null}>
                    <TransclusionDepthContext.Provider value={0}>
                      {body}
                    </TransclusionDepthContext.Provider>
                  </TransclusionResolverContext.Provider>
                </LinkPreviewContext.Provider>
              </RegistryContext.Provider>
            </HeadingActionsContext.Provider>
          </SearchContext.Provider>
        </AnnotationsContext.Provider>
      </div>
    );
  },
);

/** The dialect features an iterated cell's nested preview inherits. */
interface IterationCellConfig {
  evaluateIteration?: EvaluateIteration;
  interpolate?: InterpolateTemplate;
  evaluate?: EvaluateCalc;
  extensions?: MarkdownExtensions;
  footnotes?: boolean;
  math?: boolean;
  resolveCitation?: ResolveCitation;
  citationStyle: CitationStyle;
}

/**
 * Renders one `:::iterate` cell's resolved markdown via a nested `MarkdownPreview`.
 * Defined OUTSIDE `MarkdownPreview` so the component isn't referenced inside its
 * own initializer (the forwardRef self-reference TS2786 — same reason transclusion
 * renders its own pipeline).
 */
function IterationCell({ markdown, config }: { markdown: string; config: IterationCellConfig }) {
  return (
    <MarkdownPreview stripFrontmatter={false} {...config}>
      {markdown}
    </MarkdownPreview>
  );
}

export type { MarkdownAnnotation, MarkdownAnnotationKind } from "../lib/markdown/diff";
