/**
 * The adapter protocol — what a format plugin declares, what it produces, and
 * what renders it.
 *
 * ## The two halves, and why they are split
 *
 * A registry entry is an eager {@link AdapterManifest} plus a lazy loader. The
 * manifest is plain data available the moment the registry is created, so the
 * chrome can decide which controls to show and whether a file is openable at all
 * **without downloading a parser**. The loader is a `() => import(…)` that pulls
 * the parser AND its renderer together, only once a file of that kind is opened.
 *
 * ## Adapters emit DATA, not HTML (ADR 0024 §3)
 *
 * An adapter's `load()` returns an {@link AdapterDocument} — a model — and ships
 * a `Renderer` that draws it with brand-ui components. No adapter returns an
 * HTML string, so no adapter can smuggle a colour, a font or a border past the
 * token layer. This is the single decision that keeps the viewer themeable.
 */

import type {
  DocumentAddressKind,
  FileCategory,
  ProseHeadingLevel,
  ResolvedFileSource,
} from "@elabs-ai/components-ui";
import type { ComponentType } from "react";

import type { ResolvedHighlight } from "./highlight";
import type { TextIndex } from "./text-index";

/**
 * The adapter protocol version. Bumped only when the shapes below change in a
 * way an existing adapter would not survive; an adapter declaring a different
 * version is rejected with a named error rather than crashing at render.
 */
export const PROTOCOL_VERSION = 1;

/**
 * A quarter-turn clockwise rotation applied to the whole document.
 *
 * Document-level, not per-page: turning one page of a scan and leaving the rest
 * is an AUTHORING act (it changes the file), and this package reads files.
 */
export type DocumentRotation = 0 | 90 | 180 | 270;

/** Scale the content to a dimension of the viewport instead of to a fixed number. */
export type ZoomFit = "fit-width" | "fit-page";

/** One page's size at scale 1, in CSS pixels. */
export interface PageSize {
  width: number;
  height: number;
}

/**
 * What the chrome asks a renderer to draw at.
 *
 * A fit mode is a REQUEST, not a scale: only the renderer knows how wide its own
 * viewport is and how big the page is, so it resolves the request and reports the
 * number back through {@link AdapterRendererProps.onZoomResolved}. Resolving it
 * in the provider would mean the shell measuring a box it does not own.
 */
export type ZoomLevel = number | ZoomFit;

/** What the chrome may offer for a format, known before any parser is fetched. */
export interface AdapterCapabilities {
  /** The document is paginated — show the pager. */
  pages?: boolean;
  /** The rendered content can be scaled — show the zoom control. */
  zoom?: boolean;
  /** The rendered content can be rotated. */
  rotate?: boolean;
  /**
   * The document exposes text that can be searched.
   *
   * An OVERRIDE, not the source of truth: the shell offers find-in-document
   * whenever a format has both a text projection and a text-based
   * {@link AdapterCapabilities.highlight} kind, and reads this only when an
   * adapter says otherwise. Left as the source of truth it would deny the find
   * box to PDF — the format readers most expect it on — purely because that
   * manifest predates the feature and never declared the flag.
   *
   * It overrides in the OFF direction only, so a declared `true` is inert: it
   * cannot grant find to a format with no text or no range-painting renderer,
   * because the box would then have nothing to show for a match.
   */
  search?: boolean;
  /**
   * Which {@link DocumentAddress} kinds this adapter's `Renderer` can actually
   * paint. Absent means none.
   *
   * On the EAGER manifest on purpose: an app can decide whether to show a
   * "jump to the cited passage" affordance before it downloads pdf.js.
   *
   * It is a promise the renderer has to keep — `pnpm viewer-highlight:check`
   * fails a manifest that declares a kind its adapter never exercises.
   */
  highlight?: readonly DocumentAddressKind[];
  /** The document has an outline/table of contents for the sidebar. */
  outline?: boolean;
  /** The document can produce page thumbnails for the sidebar. */
  thumbnails?: boolean;
  /** A plain-text projection exists — enables the raw/source toggle and copy. */
  text?: boolean;
}

/**
 * What an adapter can open. At least one of `extensions` / `mediaTypes` /
 * `categories` must be present, or nothing will ever route to it.
 */
export interface AdapterManifest {
  /**
   * Stable identity and the OVERRIDE key: registering a different loader under
   * an existing id replaces it, which is how a consumer swaps a built-in.
   */
  id: string;
  /** Must equal {@link PROTOCOL_VERSION}. */
  protocol: number;
  /**
   * Tie-break when several adapters claim the same file. Built-ins are `0`;
   * register above it to win, below it to act only as a fallback.
   */
  priority?: number;
  /** Extensions claimed, lowercase and without the dot. The most specific match. */
  extensions?: string[];
  /** MIME types claimed. A trailing slash makes it a prefix (`"image/"`). */
  mediaTypes?: string[];
  /** Coarse categories claimed. The broadest match — a catch-all fallback. */
  categories?: FileCategory[];
  /** Which chrome controls apply. Absent keys are `false`. */
  capabilities?: AdapterCapabilities;
  /**
   * Optional peer packages this adapter dynamically imports. Purely
   * informational to the registry — it is what the "install this to open that"
   * message names when the import fails to resolve.
   */
  requires?: string[];
}

/**
 * An adapter's parsed output. Adapters EXTEND this with their own payload; the
 * fields here are the parts the shell itself understands, so it can drive the
 * pager, the search box and the raw toggle without knowing the format.
 */
export interface AdapterDocument {
  /** Adapter-defined discriminant, matched by that adapter's own `Renderer`. */
  readonly kind: string;
  /** Page count for a paginated document. Omit for single-surface formats. */
  readonly pageCount?: number;
  /**
   * Each page's size at scale 1, in document order.
   *
   * What lets a continuously-scrolling renderer reserve the right height for a
   * page it has not drawn yet, so the scrollbar means something from the first
   * frame instead of growing as pages arrive. May be SHORTER than
   * {@link AdapterDocument.pageCount} — measuring 900 pages up front costs 900
   * round-trips to a worker, so an adapter is free to describe the pages it
   * already touched and let the renderer assume the rest match.
   */
  readonly pageSizes?: readonly PageSize[];
  /** Plain-text projection, when the format has one. Powers search, copy and the raw view. */
  readonly text?: string;
  /**
   * Whether {@link AdapterDocument.text} is CAPPED rather than complete.
   *
   * Changes what "we couldn't find that passage" means: absent from the whole
   * document, or simply past the part we previewed. Those deserve different
   * sentences, and only the adapter knows which one is true.
   */
  readonly textTruncated?: boolean;
  /**
   * The map from {@link AdapterDocument.text} back into this adapter's own
   * model, so a character range can become a block, a page or a cell.
   *
   * The `ref` type is the adapter's business — its own `Renderer` is the only
   * thing that reads it, which is why it is `unknown` here.
   */
  readonly textIndex?: TextIndex<unknown>;
}

/** Everything an adapter is given while loading a document. */
export interface AdapterLoadContext {
  /** Cancels the load — always honour it; a stale parse must not win a race. */
  signal?: AbortSignal;
  /** Report determinate progress in `0..1` where the format allows it. */
  onProgress?: (fraction: number) => void;
}

/** A parser instance. One per document — adapters may hold per-document state. */
export interface FileAdapter {
  load(source: ResolvedFileSource, context: AdapterLoadContext): Promise<AdapterDocument>;
  /** Release anything the document holds (workers, object URLs, decoded buffers). */
  dispose?(): void;
}

/** Props every adapter `Renderer` receives. */
export interface AdapterRendererProps {
  /** The value this adapter's own `load()` returned — narrow it by `kind`. */
  document: AdapterDocument;
  /** The source, for identity, `alt` text and download actions. */
  source: ResolvedFileSource;
  className?: string;
  /**
   * The heading rung a document's own top-level heading renders at.
   *
   * A viewed file carries its OWN heading tree, and that tree has to be
   * relative to the page hosting it: a README's `#` inside an app that already
   * has an `<h1>` would otherwise put two `h1`s in a screen reader's flat
   * heading list. `FileViewerContent` passes the provider's value; an adapter
   * that renders headings offsets by it (`clampHeadingLevel(own + base - 1)`),
   * and one that renders none ignores it. Same seam as
   * `@elabs-ai/components-ai`'s `MarkdownView baseHeadingLevel`.
   *
   * Optional, so adding it is not a `PROTOCOL_VERSION` change.
   */
  baseHeadingLevel?: ProseHeadingLevel;
  /**
   * The parts of the document to mark, already located — citations from the
   * app and the viewer's own find-in-document matches, in document order.
   *
   * The shell has done LOCATE (a quote is now a character range); the renderer
   * does MAP and PAINT, because only it knows that offsets 812–847 are the
   * second half of block 14. An adapter renders only the entries whose `status`
   * is `"resolved"` and whose `address.kind` it declared, and ignores the rest
   * — the shell is what tells the reader about a miss.
   *
   * Optional, so adding it is not a `PROTOCOL_VERSION` change.
   */
  highlights?: readonly ResolvedHighlight[];
  /**
   * Which highlight the viewer is pointed at. The renderer scrolls it into
   * view, pages to it if the format paginates, and draws it distinctly.
   *
   * Also present as `active` on the entry itself; this is the shortcut for a
   * renderer that only needs to know whether anything changed.
   */
  activeHighlightId?: string | null;
  /**
   * Which page the reader is on, 1-based — the provider's, not the renderer's.
   *
   * Page, zoom and rotation are PROVIDER state (ADR 0026) so a control can live
   * anywhere: the shell's own toolbar, an app's page header, a deep link. While
   * these were `useState` inside each renderer nothing outside the canvas could
   * read or drive them.
   *
   * Uncontrolled when absent — a renderer used outside a `FileViewerProvider`
   * keeps its own page, so it still works standalone. Optional, so adding it is
   * not a `PROTOCOL_VERSION` change.
   */
  pageNumber?: number;
  /**
   * Report a page the RENDERER navigated to on its own — turning to a cited
   * page, or (once pages scroll continuously) the page scrolled into view. The
   * provider is what keeps the pager's number honest.
   */
  onPageChange?: (page: number) => void;
  /** The scale, or a fit mode to resolve. Absent means the renderer's own default. */
  zoom?: ZoomLevel;
  /**
   * Report the scale a {@link ZoomFit} actually resolved to.
   *
   * Only a renderer knows this — it is the one measuring its viewport. Without
   * it the chrome cannot show a percentage for a fitted page, and the reader's
   * next "zoom in" would step from the last fixed stop rather than from what is
   * on screen. A renderer that never resolves a fit mode never calls it.
   */
  onZoomResolved?: (scale: number) => void;
  /** Quarter-turns clockwise. Ignored by renderers whose manifest omits `rotate`. */
  rotation?: DocumentRotation;
}

/**
 * What an adapter module exports. `manifest` is re-declared here so the registry
 * can verify the loaded module is the one the eager manifest promised.
 */
export interface AdapterModule {
  manifest: AdapterManifest;
  /** Fresh instance per document — never a shared singleton. */
  create(): FileAdapter;
  Renderer: ComponentType<AdapterRendererProps>;
}

/** A lazy adapter loader. Always `() => import("…")` so nothing heavy is eager. */
export type AdapterLoader = () => Promise<AdapterModule | { default: AdapterModule }>;
