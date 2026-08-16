"use client";

/**
 * `FileViewer` — the compound shell.
 *
 * Every part is composed from `@elabs/components-ui` primitives;
 * this package contributes file LOGIC (detection, parsing, the page model) and
 * never a parallel widget set. There is no `showToolbar` boolean: compose the
 * parts you want, or render `<FileViewer>` for the batteries-included default.
 *
 * Surface separation (`styling-and-tokens.md`): the frame is one raised `card`
 * with a border, the toolbar is divided from the content by a single `border-b`
 * — the sole structural cue between two same-fill regions, so it takes the
 * strong rung.
 */

import {
  Button,
  cn,
  downloadBlob,
  fileIconFor,
  IconButton,
  normalizeFileSource,
  normalizeQuoteTextWithOffsets,
  queryToRanges,
  resolveFileKind,
  Separator,
  Skeleton,
  StatePanel,
  Text,
  useLocale,
  type FileSource,
  type ProseHeadingLevel,
} from "@elabs/components-ui";
import { DownloadIcon, EyeOffIcon, SearchXIcon } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

import { createDefaultRegistry } from "../adapters";
import {
  ViewerError,
  isAbort,
  isModuleNotFound,
  parserMissingError,
  toViewerError,
  type ViewerErrorCode,
} from "../core/errors";
import {
  FIND_MATCH_LIMIT,
  findMatchId,
  type DocumentHighlight,
  type HighlightSupport,
  type ResolvedHighlight,
} from "../core/highlight";
import { resolveHighlights } from "../core/highlight-resolve";
import type { ViewerRegistry } from "../core/registry";
import type { DocumentRotation, ZoomLevel } from "../core/types";
import { DEFAULT_ZOOM, stepZoom } from "../core/zoom";
import { FileViewerFind, isFindShortcut } from "./file-viewer-find";
import { FileViewerPager } from "./file-viewer-pager";
import { FileViewerRotate, FileViewerZoom } from "./file-viewer-zoom";
import {
  FileViewerContext,
  useFileViewer,
  type FileViewerContextValue,
  type FileViewerFindState,
  type FileViewerLoadState,
} from "./file-viewer-context";

/** Stable empties, so a provider with no citations does not re-render on identity. */
const NO_HIGHLIGHTS: readonly DocumentHighlight[] = [];
const NO_RESOLVED: readonly ResolvedHighlight[] = [];
const NO_SUPPORT: HighlightSupport = [];

/* -------------------------------------------------------------------------- */
/* Provider                                                                    */
/* -------------------------------------------------------------------------- */

export interface FileViewerProviderProps {
  /** The file to show. `undefined` is the empty state, not an error. */
  source?: FileSource;
  /**
   * Adapters available to this viewer. Defaults to the built-ins.
   * Pass your own to add a format, drop one, or override a built-in.
   */
  registry?: ViewerRegistry;
  /**
   * Force the not-ready state while a parent fetches the source itself.
   * ORed with the viewer's own loading — a parent can add loading, never remove it.
   */
  loading?: boolean;
  /**
   * The rung a viewed document's own top-level heading renders at. Default `2`.
   *
   * A file carries its OWN heading tree, and that tree is only correct relative
   * to the page hosting it: a README's `#` rendered as an `<h1>` inside an app
   * that already has one puts two `h1`s in a screen reader's flat heading list,
   * and the frame's `<section aria-label>` does not fix that — most screen
   * readers list headings flat, not per landmark. The default assumes the
   * common case, a viewer embedded BELOW the page's own heading; pass `1` when
   * the viewer genuinely is the page.
   *
   * Adapters that render no headings ignore it. Same seam as
   * `@elabs/components-ai`'s `MarkdownView baseHeadingLevel`.
   */
  baseHeadingLevel?: ProseHeadingLevel;
  /**
   * The parts of the document to point at — an answer's citations, a search
   * result's context, anything the app already knows about the file.
   *
   * A PROP rather than provider-only state because citations originate outside
   * the viewer entirely: the chat pane that produced them usually lives in
   * another route, and it owns which one the reader clicked. Pass
   * `defaultHighlights` instead to let the viewer own them.
   */
  highlights?: readonly DocumentHighlight[];
  /** Uncontrolled initial citations. Ignored when `highlights` is supplied. */
  defaultHighlights?: readonly DocumentHighlight[];
  onHighlightsChange?: (highlights: readonly DocumentHighlight[]) => void;
  /**
   * Which citation the viewer is pointed at. `null` is "none" explicitly;
   * `undefined` is what selects uncontrolled mode, so the two are not
   * interchangeable here.
   */
  activeHighlightId?: string | null;
  defaultActiveHighlightId?: string | null;
  onActiveHighlightChange?: (id: string | null) => void;
  /**
   * Which page the viewer is on, 1-based — controlled.
   *
   * A trio (`component-api.md`) rather than provider-only state because the page
   * is routinely something the APP owns: a deep link to page 7, a URL the reader
   * can share, a position restored from a "continue reading" record. Clamped to
   * the document on read, so an out-of-range value degrades to the nearest real
   * page instead of blanking the canvas.
   */
  pageNumber?: number;
  /** Uncontrolled initial page. Ignored when `pageNumber` is supplied. */
  defaultPageNumber?: number;
  onPageNumberChange?: (page: number) => void;
  /**
   * The scale to draw at, or a fit mode — controlled. Persisting a reader's
   * preferred zoom across files and sessions is the reason this is a prop.
   */
  zoom?: ZoomLevel;
  /**
   * Uncontrolled initial zoom. Ignored when `zoom` is supplied.
   *
   * Defaults to `"fit-width"`, not `1`: a viewer's job on open is to show the
   * document, and a 4000px scan or an A4 page at 100% in a 600px pane shows its
   * top-left corner. Every reader-facing PDF viewer opens fitted for the same
   * reason. Pass `1` for true 100%.
   */
  defaultZoom?: ZoomLevel;
  onZoomChange?: (zoom: ZoomLevel) => void;
  /** Quarter-turns clockwise — controlled. */
  rotation?: DocumentRotation;
  /** Uncontrolled initial rotation. Ignored when `rotation` is supplied. Default `0`. */
  defaultRotation?: DocumentRotation;
  onRotationChange?: (rotation: DocumentRotation) => void;
  children: ReactNode;
}

/** Matches for the current query, plus whether the cap swallowed any. */
interface FindMatches {
  highlights: readonly DocumentHighlight[];
  total: number;
  truncated: boolean;
}

const NO_MATCHES: FindMatches = { highlights: NO_HIGHLIGHTS, total: 0, truncated: false };

export function FileViewerProvider({
  source,
  registry: registryProp,
  loading = false,
  baseHeadingLevel = 2,
  highlights: highlightsProp,
  defaultHighlights,
  onHighlightsChange,
  activeHighlightId: activeHighlightIdProp,
  defaultActiveHighlightId = null,
  onActiveHighlightChange,
  pageNumber: pageNumberProp,
  defaultPageNumber = 1,
  onPageNumberChange,
  zoom: zoomProp,
  defaultZoom = "fit-width",
  onZoomChange,
  rotation: rotationProp,
  defaultRotation = 0,
  onRotationChange,
  children,
}: FileViewerProviderProps) {
  // A default registry per provider, not per module: one screen's `register()`
  // override must not leak into another's.
  const fallbackRegistry = useMemo(() => createDefaultRegistry(), []);
  const registry = registryProp ?? fallbackRegistry;

  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<FileViewerLoadState>({ status: "empty", capabilities: {} });

  const resolved = useMemo(() => (source ? normalizeFileSource(source) : undefined), [source]);

  useEffect(() => {
    if (!resolved) {
      setState({ status: "empty", capabilities: {} });
      return;
    }

    const controller = new AbortController();
    let instance: { dispose?: () => void } | undefined;
    let cancelled = false;

    const kind = resolveFileKind(resolved.name, resolved.mediaType);
    const manifest = registry.detect(kind);

    // Capabilities come from the eager manifest, so the chrome is correct from
    // the first frame — before a single byte of parser is fetched.
    setState({
      status: "loading",
      source: resolved,
      capabilities: manifest?.capabilities ?? {},
    });

    void (async () => {
      try {
        if (!manifest) {
          throw new ViewerError("unsupported-format", `No adapter can open "${resolved.name}".`, {
            fileName: resolved.name,
          });
        }
        const adapter = await registry.load(manifest.id);
        // A fresh instance per document — adapters may hold per-document state.
        const parser = adapter.create();
        instance = parser;
        const document = await parser.load(resolved, { signal: controller.signal });
        if (cancelled) return;
        setState({
          status: "ready",
          source: resolved,
          document,
          adapter,
          capabilities: manifest.capabilities ?? {},
        });
      } catch (error) {
        // A cancelled load is a superseded one — reporting it would flash an
        // error every time the user picks a different file.
        if (cancelled || isAbort(error)) return;
        // Every parser engine is reached by a dynamic `import()` INSIDE the
        // adapter's own `load()`, so "the optional peer is not installed" lands
        // here, not on `registry.load()` above. Falling through to `parse-failed`
        // would tell the reader their file is damaged and offer a retry that can
        // never succeed.
        const missingPeer =
          isModuleNotFound(error) && manifest
            ? parserMissingError(manifest.id, manifest.requires ?? [], {
                fileName: resolved.name,
                cause: error,
              })
            : undefined;
        setState({
          status: "error",
          source: resolved,
          capabilities: manifest?.capabilities ?? {},
          error: missingPeer ?? toViewerError(error, "parse-failed", { fileName: resolved.name }),
        });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      instance?.dispose?.();
      // Releases any object URL the source minted for this load.
      resolved.revoke();
    };
  }, [resolved, registry, attempt]);

  /* ---- Citations: a prop the app may control, or the viewer's own --------- */

  const highlightsControlled = highlightsProp !== undefined;
  const [ownHighlights, setOwnHighlights] = useState(defaultHighlights ?? NO_HIGHLIGHTS);
  const highlights = highlightsControlled ? highlightsProp : ownHighlights;
  const setHighlights = useCallback(
    (next: readonly DocumentHighlight[]) => {
      // Mirroring the platform: a controlled value is never written locally, so
      // the component can't drift from the prop that owns it.
      if (!highlightsControlled) setOwnHighlights(next);
      onHighlightsChange?.(next);
    },
    [highlightsControlled, onHighlightsChange],
  );

  const activeControlled = activeHighlightIdProp !== undefined;
  const [ownActiveId, setOwnActiveId] = useState<string | null>(defaultActiveHighlightId);
  const activeHighlightId = activeControlled ? activeHighlightIdProp : ownActiveId;
  const setActiveHighlight = useCallback(
    (id: string | null) => {
      if (!activeControlled) setOwnActiveId(id);
      onActiveHighlightChange?.(id);
    },
    [activeControlled, onActiveHighlightChange],
  );

  /* ---- View: which page, at what scale, turned which way ------------------ */

  const pageCount = state.document?.pageCount ?? 0;

  const pageControlled = pageNumberProp !== undefined;
  const [ownPage, setOwnPage] = useState(defaultPageNumber);
  const rawPage = pageControlled ? pageNumberProp : ownPage;
  // Clamped on READ. Writing a clamped value back at a controlled owner would
  // fight it, and a document whose page count shrank (a different file, same
  // provider) must not blank the canvas while the owner catches up.
  const pageNumber =
    pageCount > 0 ? Math.min(Math.max(1, rawPage), pageCount) : Math.max(1, rawPage);
  const goToPage = useCallback(
    (page: number) => {
      const next = Math.max(1, Math.round(page));
      if (!pageControlled) setOwnPage(next);
      onPageNumberChange?.(next);
    },
    [pageControlled, onPageNumberChange],
  );

  const zoomControlled = zoomProp !== undefined;
  const [ownZoom, setOwnZoom] = useState<ZoomLevel>(defaultZoom);
  const zoom = zoomControlled ? zoomProp : ownZoom;
  const setZoom = useCallback(
    (next: ZoomLevel) => {
      if (!zoomControlled) setOwnZoom(next);
      onZoomChange?.(next);
    },
    [zoomControlled, onZoomChange],
  );

  // What a fit mode actually became. Only the renderer can know it — it is the
  // one measuring its viewport — so this is a report, not a derivation.
  const [reportedZoom, setReportedZoom] = useState(DEFAULT_ZOOM);
  const effectiveZoom = typeof zoom === "number" ? zoom : reportedZoom;

  const rotationControlled = rotationProp !== undefined;
  const [ownRotation, setOwnRotation] = useState<DocumentRotation>(defaultRotation);
  const rotation = rotationControlled ? rotationProp : ownRotation;
  const setRotation = useCallback(
    (next: DocumentRotation) => {
      if (!rotationControlled) setOwnRotation(next);
      onRotationChange?.(next);
    },
    [rotationControlled, onRotationChange],
  );

  // Opening a DIFFERENT file starts at its first page, the right way up. Zoom
  // deliberately survives: a reader who zoomed in is reading at that size, and
  // snapping back to 100% on every file fights them.
  //
  // Compared against the previous source rather than run on mount, so a
  // `defaultPageNumber` (deep link, restored position) is not clobbered by its
  // own first render.
  const previousSource = useRef(resolved);
  useEffect(() => {
    if (previousSource.current === resolved) return;
    previousSource.current = resolved;
    setOwnPage(1);
    setOwnRotation(0);
  }, [resolved]);

  /* ---- Find-in-document: entirely the viewer's own ------------------------ */

  const [find, setFind] = useState({
    open: false,
    query: "",
    caseSensitive: false,
    activeIndex: 0,
  });

  // Whether a `FileViewerFind` part is actually composed into this viewer.
  //
  // The frame swallows Ctrl/Cmd+F, and swallowing it without a box to show is
  // strictly worse than not intercepting at all: the reader loses the browser's
  // own find and gets nothing in return. The parts are composable by design, so
  // "the adapter could paint a match" is not the same question as "there is
  // somewhere to type" — the find part answers the second by registering itself.
  const [findParts, setFindParts] = useState(0);
  const registerFind = useCallback(() => {
    setFindParts((count) => count + 1);
    return () => setFindParts((count) => count - 1);
  }, []);

  const text = state.document?.text;
  const capabilities = state.capabilities;
  const support = capabilities.highlight ?? NO_SUPPORT;

  // The declared `search` flag is an override in the OFF direction only. Read
  // as the source of truth it would deny the find box to PDF — the format
  // readers expect it on most — purely because that manifest predates the
  // feature. Read as "can this adapter paint what find produces" it is right by
  // construction: find emits `range` addresses, so `range` support is the bar.
  const canFind = (capabilities.search ?? true) && text !== undefined && support.includes("range");

  // Deferred so a keystroke paints immediately and the (potentially large)
  // match scan lands a frame later, instead of blocking the caret.
  const query = useDeferredValue(find.query);
  const findMatches = useMemo<FindMatches>(() => {
    if (!find.open || !canFind || text === undefined || query.length === 0) return NO_MATCHES;
    // Deliberately NOT run through `normalizeRanges`: it merges ADJACENT
    // ranges, which is right for a fuzzy matcher painting one contiguous mark
    // and wrong here — searching "l" in "hello" finds two matches, and merging
    // them into one would make the counter disagree with what a reader counts.
    // A single needle's matches never overlap, so there is nothing to merge.
    const ranges = queryToRanges(text, query, find.caseSensitive);
    return {
      highlights: ranges.slice(0, FIND_MATCH_LIMIT).map(([start, end], index) => ({
        id: findMatchId(index),
        address: { kind: "range" as const, start, end },
        source: "search" as const,
      })),
      total: ranges.length,
      truncated: ranges.length > FIND_MATCH_LIMIT,
    };
  }, [find.open, find.caseSensitive, canFind, text, query]);

  /* ---- Locate: the one step that runs outside the adapter ----------------- */

  // Folded once per document, not once per keystroke: find re-resolves on every
  // character, and folding a 2 MB projection each time is what turns a search
  // box into a stutter.
  const normalized = useMemo(
    () => (text === undefined ? undefined : normalizeQuoteTextWithOffsets(text)),
    [text],
  );

  // Two things can claim to be "the current one": a citation the app pointed at,
  // and the match the reader is stepping through. The precedence is stated once,
  // here — while the find box is open and matching, find wins, because it is what
  // the reader's own keystrokes are moving. Leaving both active would paint the
  // reader's match like every other match while a citation kept the active plate.
  const activeFindId =
    find.open && findMatches.highlights.length > 0 ? findMatchId(find.activeIndex) : undefined;

  /**
   * The id the RENDERER is pointed at — the effective one, not the citation knob.
   *
   * A renderer that owns a pager or a tab strip navigates on this, and the shared
   * scroll hook fires on it. Handing it `state.activeHighlightId` instead would
   * leave find-in-document unable to scroll to, page to, or switch sheet to its
   * own match whenever no citation happened to be active.
   */
  const currentHighlightId = activeFindId ?? activeHighlightId;

  const resolvedHighlights = useMemo<readonly ResolvedHighlight[]>(() => {
    if (highlights.length === 0 && findMatches.highlights.length === 0) return NO_RESOLVED;
    return resolveHighlights([...highlights, ...findMatches.highlights], {
      normalized,
      textLength: text?.length,
      truncated: state.document?.textTruncated,
      supported: support,
      activeId: currentHighlightId,
    });
  }, [
    highlights,
    findMatches.highlights,
    normalized,
    text?.length,
    state.document?.textTruncated,
    support,
    currentHighlightId,
  ]);

  /* ---- Stepping ---------------------------------------------------------- */

  const stepCitation = useCallback(
    (delta: 1 | -1) => {
      const list = resolvedHighlights.filter(
        (highlight) => highlight.source === "citation" && highlight.status === "resolved",
      );
      if (list.length === 0) return;
      const at = list.findIndex((highlight) => highlight.id === activeHighlightId);
      // Nothing active yet: "next" starts at the top of the document and
      // "previous" at the bottom, rather than both landing on the first.
      const to =
        at === -1 ? (delta === 1 ? 0 : list.length - 1) : (at + delta + list.length) % list.length;
      setActiveHighlight((list[to] as ResolvedHighlight).id);
    },
    [resolvedHighlights, activeHighlightId, setActiveHighlight],
  );

  const stepFind = useCallback(
    (delta: 1 | -1) => {
      const count = findMatches.highlights.length;
      if (count === 0) return;
      setFind((current) => ({
        ...current,
        activeIndex: (current.activeIndex + delta + count) % count,
      }));
    },
    [findMatches.highlights.length],
  );

  const findState = useMemo<FileViewerFindState>(
    () => ({
      open: find.open,
      query: find.query,
      caseSensitive: find.caseSensitive,
      matches: findMatches.total,
      truncated: findMatches.truncated,
      activeIndex: find.activeIndex,
    }),
    [find, findMatches.total, findMatches.truncated],
  );

  const actions = useMemo(
    () => ({
      reload: () => setAttempt((n) => n + 1),
      setHighlights,
      setActiveHighlight,
      nextHighlight: () => stepCitation(1),
      previousHighlight: () => stepCitation(-1),
      openFind: () => setFind((current) => ({ ...current, open: true })),
      // The query survives a close, so re-opening resumes where the reader was;
      // only the box goes away.
      closeFind: () => setFind((current) => ({ ...current, open: false })),
      setFindQuery: (next: string) =>
        setFind((current) => ({ ...current, query: next, activeIndex: 0 })),
      setFindCaseSensitive: (next: boolean) =>
        setFind((current) => ({ ...current, caseSensitive: next, activeIndex: 0 })),
      nextFindMatch: () => stepFind(1),
      previousFindMatch: () => stepFind(-1),
      goToPage,
      // Stop at the ends rather than wrap: a document is not a carousel, and a
      // reader who holds "next" past the last page expects to stay there.
      nextPage: () => goToPage(Math.min(pageNumber + 1, pageCount || pageNumber + 1)),
      previousPage: () => goToPage(pageNumber - 1),
      setZoom,
      // Stepping from `effectiveZoom`, not from `zoom`: after a fit the ladder
      // has to continue from what is actually on screen.
      zoomIn: () => setZoom(stepZoom(effectiveZoom, 1)),
      zoomOut: () => setZoom(stepZoom(effectiveZoom, -1)),
      setRotation,
      rotate: (quarterTurns: 1 | -1) =>
        setRotation(((((rotation + quarterTurns * 90) % 360) + 360) % 360) as DocumentRotation),
      reportZoom: setReportedZoom,
      registerFind,
    }),
    [
      setHighlights,
      setActiveHighlight,
      stepCitation,
      stepFind,
      registerFind,
      goToPage,
      pageNumber,
      pageCount,
      setZoom,
      effectiveZoom,
      setRotation,
      rotation,
    ],
  );

  const value = useMemo<FileViewerContextValue>(
    () => ({
      state: {
        // A parent's `loading` can add the not-ready state but never clear a
        // real error — losing a failure to a stale prop is worse than a late
        // spinner.
        ...(loading && state.status !== "error" ? { ...state, status: "loading" as const } : state),
        highlights,
        activeHighlightId,
        find: findState,
        pageNumber,
        pageCount,
        zoom,
        effectiveZoom,
        rotation,
      },
      actions,
      registry,
      meta: {
        baseHeadingLevel,
        resolvedHighlights,
        currentHighlightId,
        highlightSupport: support,
        canFind,
        hasFind: findParts > 0,
      },
    }),
    [
      state,
      loading,
      registry,
      baseHeadingLevel,
      highlights,
      activeHighlightId,
      findState,
      actions,
      resolvedHighlights,
      currentHighlightId,
      support,
      canFind,
      findParts,
      pageNumber,
      pageCount,
      zoom,
      effectiveZoom,
      rotation,
    ],
  );

  return <FileViewerContext value={value}>{children}</FileViewerContext>;
}

/* -------------------------------------------------------------------------- */
/* Frame                                                                       */
/* -------------------------------------------------------------------------- */

export type FileViewerFrameProps = HTMLAttributes<HTMLDivElement>;

/**
 * The bordered surface the toolbar and content sit in, and the scope of the
 * viewer's find shortcut.
 *
 * Ctrl/Cmd+F is handled HERE rather than on `document`: a page may hold several
 * viewers, or a viewer beside an editor that has its own find, and a
 * document-level listener would let whichever mounted last win. Bound to the
 * frame, the shortcut belongs to whichever viewer the reader is actually inside,
 * and the browser's own find is untouched everywhere else on the page.
 */
export const FileViewerFrame = forwardRef<HTMLDivElement, FileViewerFrameProps>(
  function FileViewerFrame({ className, children, onKeyDown, ...props }, ref) {
    const { state, actions, meta } = useFileViewer();
    const { t } = useLocale();
    const frame = useRef<HTMLElement | null>(null);
    const wasOpen = useRef(false);

    // Closing the box must hand the caret back, or a keyboard reader is left
    // with focus on nothing at the top of the document.
    const findOpen = state.find.open && meta.canFind;
    useEffect(() => {
      if (wasOpen.current && !findOpen) {
        frame.current
          ?.querySelector<HTMLElement>('[data-slot="file-viewer-content"]')
          ?.focus({ preventScroll: true });
      }
      wasOpen.current = findOpen;
    }, [findOpen]);

    return (
      <section
        ref={(node) => {
          frame.current = node;
          if (typeof ref === "function") ref(node as HTMLDivElement | null);
          else if (ref) ref.current = node as HTMLDivElement | null;
        }}
        data-slot="file-viewer"
        aria-label={t("viewer.label")}
        className={cn(
          "bg-card text-card-foreground border-border flex h-full min-h-0 flex-col overflow-hidden rounded-lg border shadow-sm",
          className,
        )}
        onKeyDown={(event) => {
          // The frame renders a `<section>` while its public props type says
          // `HTMLDivElement` — a pre-existing signature. One cast here beats
          // widening the exported ref type and breaking every caller's
          // `useRef<HTMLDivElement>`.
          onKeyDown?.(event as ReactKeyboardEvent<HTMLDivElement>);
          // Only intercept the browser's shortcut when this viewer can actually
          // honour it — otherwise the reader loses their browser find and gets
          // nothing back. Both halves are needed: an adapter that can paint a
          // match (`canFind`) AND a find part composed in to type into
          // (`hasFind`). A hand-composed frame that omits the part keeps the
          // browser's own find, which is the right answer for it.
          if (!event.defaultPrevented && meta.canFind && meta.hasFind && isFindShortcut(event)) {
            event.preventDefault();
            actions.openFind();
          }
        }}
        {...props}
      >
        {children}
      </section>
    );
  },
);

/* -------------------------------------------------------------------------- */
/* Toolbar                                                                     */
/* -------------------------------------------------------------------------- */

export interface FileViewerToolbarProps extends HTMLAttributes<HTMLDivElement> {
  /** Extra controls, placed after the built-in actions. */
  actions?: ReactNode;
}

/**
 * The identity row: glyph, name, actions.
 *
 * No `role="toolbar"` — that role promises roving-tabindex arrow-key navigation,
 * which this row does not implement. The same decision `ViewToolbar` made, and
 * the reason the P1 `Toolbar` primitive exists (ADR 0024 §5a).
 *
 * With no file it renders NOTHING: a row holding a generic glyph and a blank
 * name reads as a broken render, not as chrome. A screen that needs a permanent
 * header composes its own row around `FileViewerFrame` — that is what the parts
 * are for.
 */
export const FileViewerToolbar = forwardRef<HTMLDivElement, FileViewerToolbarProps>(
  function FileViewerToolbar({ className, actions, children, ...props }, ref) {
    const { state } = useFileViewer();
    const { t } = useLocale();
    const source = state.source;
    const Glyph = fileIconFor(source?.name ?? "", source?.mediaType);

    if (!source) return null;

    const download = () => {
      void source.bytes().then((bytes) => {
        downloadBlob(new Blob([bytes], { type: source.mediaType }), source.name);
      });
    };

    return (
      <div
        ref={ref}
        data-slot="file-viewer-toolbar"
        className={cn(
          // The divider is the ONLY cue between toolbar and content (same fill,
          // no elevation change) — WCAG 1.4.11, so the strong rung.
          "border-border-strong flex shrink-0 items-center gap-2 border-b px-3 py-2",
          className,
        )}
        {...props}
      >
        <Glyph aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
        {/* min-w-0 is what actually lets the name truncate inside a flex row. */}
        <Text className="min-w-0 flex-1 truncate" title={source.name}>
          {source.name}
        </Text>
        {children}
        {actions}
        <Separator orientation="vertical" className="h-4" />
        {/* `label` is IconButton's single source of truth — it becomes both the
            accessible name and the tooltip, so the two cannot drift. */}
        <IconButton
          variant="ghost"
          label={t("viewer.download", { name: source.name })}
          icon={<DownloadIcon aria-hidden="true" />}
          onClick={download}
        />
      </div>
    );
  },
);

/* -------------------------------------------------------------------------- */
/* Highlight status                                                            */
/* -------------------------------------------------------------------------- */

export type FileViewerHighlightStatusProps = HTMLAttributes<HTMLDivElement>;

/**
 * "We couldn't find that passage."
 *
 * A citation that fails to locate must not fail SILENTLY: the reader clicked a
 * source link and got a document that looks untouched, with no way to tell
 * whether the viewer is broken, the passage moved, or they mis-clicked. The
 * request survives resolution precisely so this line has something to say.
 *
 * Three different pieces of news, three sentences:
 * - `not-found` / `absent` — searched the whole projection; it is not in it.
 * - `not-found` / `truncated` — the projection is capped, so it may lie past it.
 * - `unsupported` — a CAPABILITY GAP: this build cannot point at part of that
 *   format. Not the reader's fault and not retryable, same call the error panel
 *   already makes for `unsupported-format`.
 *
 * Search misses are excluded: the find bar already counts its own matches, and
 * "No matches" there says it better than a second line here would.
 */
export const FileViewerHighlightStatus = forwardRef<HTMLDivElement, FileViewerHighlightStatusProps>(
  function FileViewerHighlightStatus({ className, ...props }, ref) {
    const { state, meta } = useFileViewer();
    const { t } = useLocale();

    const missed = meta.resolvedHighlights.filter(
      (highlight) =>
        highlight.source === "citation" &&
        (highlight.status === "not-found" || highlight.status === "unsupported"),
    );
    if (missed.length === 0) return null;

    const first = missed[0] as ResolvedHighlight;
    const message =
      first.status === "unsupported"
        ? t("viewer.highlight.unsupported", {
            format: state.source?.extension.toUpperCase() || "",
          })
        : first.reason === "truncated"
          ? t("viewer.highlight.notFoundTruncated")
          : t("viewer.highlight.notFound");

    return (
      <div
        ref={ref}
        data-slot="file-viewer-highlight-status"
        role="status"
        aria-live="polite"
        className={cn(
          // Information, not a failure — a neutral muted row, never the
          // destructive tone. The divider is the sole cue between it and the
          // content below (WCAG 1.4.11, strong rung).
          "border-border-strong text-muted-foreground flex shrink-0 items-center gap-2 border-b px-3 py-2",
          className,
        )}
        {...props}
      >
        <SearchXIcon aria-hidden="true" className="size-4 shrink-0" />
        <span className="text-meta min-w-0 flex-1 truncate">{message}</span>
      </div>
    );
  },
);

/* -------------------------------------------------------------------------- */
/* States                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A layout-shaped skeleton, not a spinner: it occupies the box the real content
 * will, so nothing shifts when the file arrives (`loading-states.md`).
 * `aria-hidden` because `Skeleton` is decorative — the single live region on the
 * wrapper is what AT hears.
 */
export const FileViewerSkeleton = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function FileViewerSkeleton({ className, ...props }, ref) {
    const { state } = useFileViewer();
    const { t } = useLocale();
    return (
      <div
        ref={ref}
        data-slot="file-viewer-skeleton"
        role="status"
        aria-live="polite"
        className={cn("flex h-full flex-col gap-3 p-4", className)}
        {...props}
      >
        <span className="sr-only">{t("viewer.loading", { name: state.source?.name ?? "" })}</span>
        <Skeleton aria-hidden="true" className="h-4 w-2/5" />
        <Skeleton aria-hidden="true" className="h-4 w-4/5" />
        <Skeleton aria-hidden="true" className="h-4 w-3/5" />
        <Skeleton aria-hidden="true" className="min-h-24 flex-1" />
      </div>
    );
  },
);

/** Message keys per failure code — the code is the contract, the prose is not. */
const ERROR_MESSAGES: Record<ViewerErrorCode, { title: string; body: string }> = {
  "unsupported-format": {
    title: "viewer.error.unsupportedFormat",
    body: "viewer.error.unsupportedFormatBody",
  },
  "parser-missing": {
    title: "viewer.error.parserMissing",
    body: "viewer.error.parserMissingBody",
  },
  "read-failed": { title: "viewer.error.readFailed", body: "viewer.error.readFailedBody" },
  "parse-failed": { title: "viewer.error.parseFailed", body: "viewer.error.parseFailedBody" },
  // Neither should ever reach the UI: a protocol mismatch throws at registration
  // and an abort is swallowed as a superseded load. Mapped anyway so the panel
  // can never render an empty title.
  "protocol-mismatch": { title: "viewer.error.parseFailed", body: "viewer.error.parseFailedBody" },
  aborted: { title: "viewer.error.readFailed", body: "viewer.error.readFailedBody" },
};

/**
 * A gap in what this build can SHOW — the file is fine, we just cannot draw it.
 * Neither is retryable, and neither is the user's fault, so both are presented
 * as information rather than as a failure (see `FileViewerError`).
 */
const CAPABILITY_GAPS = new Set<ViewerErrorCode>(["unsupported-format", "parser-missing"]);

export const FileViewerError = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function FileViewerError({ className, ...props }, ref) {
    const { state } = useFileViewer();
    const { t } = useLocale();
    const error = state.error;
    if (!error) return null;

    const message = ERROR_MESSAGES[error.code];
    const vars = {
      name: state.source?.name ?? "",
      format: state.source?.extension.toUpperCase() || t("viewer.error.parseFailed"),
      packages: error.packages?.join(", ") ?? "",
    };

    // "This build can't draw PDFs" and "the network dropped" are different news.
    // A red alarm on the first one blames the reader for a capability we never
    // shipped, so the gap gets a neutral panel and `status`; a real failure keeps
    // the destructive panel and the `alert` StatePanel already sets.
    const isGap = CAPABILITY_GAPS.has(error.code);

    return (
      <div
        ref={ref}
        data-slot="file-viewer-error"
        // min-h-full (not h-full) so a tall panel grows and scrolls instead of
        // being clipped at the top by `justify-center`.
        className={cn("flex min-h-full flex-col justify-center p-4", className)}
        {...(isGap ? { role: "status" as const, "aria-live": "polite" as const } : {})}
        {...props}
      >
        <StatePanel
          kind={isGap ? "empty" : "error"}
          // A dashed edge invites a drop; this panel accepts nothing. Solid.
          className={isGap ? "border-solid" : undefined}
          icon={isGap ? <EyeOffIcon aria-hidden="true" /> : undefined}
          title={t(message.title)}
          description={t(message.body, vars)}
          // `unsupported-format` and `parser-missing` are not retryable — the
          // file has not changed and neither has what is installed. Offering
          // "Try again" there teaches users the button does nothing.
          actions={
            error.code === "read-failed" || error.code === "parse-failed" ? (
              <RetryButton />
            ) : undefined
          }
        />
      </div>
    );
  },
);

/**
 * The real `Button`, not a styled `<button>`.
 *
 * A hand-rolled `text-primary` link measured 4.14:1 against `StatePanel`'s error
 * wash and failed axe — the brand hue is tuned against `--background`/`--card`,
 * not against a tinted panel. `outline` puts the label on ordinary ink over its
 * own surface, which is contrast-safe on any panel and gives the control a
 * visible hit target besides.
 */
function RetryButton() {
  const { actions } = useFileViewer();
  const { t } = useLocale();
  return (
    <Button variant="outline" size="sm" onClick={actions.reload}>
      {t("viewer.retry")}
    </Button>
  );
}

export const FileViewerEmpty = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function FileViewerEmpty({ className, ...props }, ref) {
    const { t } = useLocale();
    return (
      <div
        ref={ref}
        data-slot="file-viewer-empty"
        className={cn("flex min-h-full flex-col justify-center p-4", className)}
        {...props}
      >
        <StatePanel kind="empty" title={t("viewer.empty")} description={t("viewer.emptyBody")} />
      </div>
    );
  },
);

/* -------------------------------------------------------------------------- */
/* Content                                                                     */
/* -------------------------------------------------------------------------- */

export type FileViewerContentProps = HTMLAttributes<HTMLDivElement>;

/**
 * The state switch: empty · loading · error · the adapter's own renderer.
 *
 * The adapter supplies its `Renderer` alongside its parser, so this component
 * never grows a per-format `switch` — that is what keeps formats additive.
 *
 * **This is THE scroll boundary** for any adapter that does not manage its own
 * viewport. Two nested `overflow-auto` boxes do not compose: the inner one clips
 * while the outer one's padding stays put, so a long document ends flush against
 * a band of whitespace and reads as a failed render rather than as "scroll for
 * more". Adapters whose content simply flows (text, code, markdown, Word) let
 * this scroll; the ones with a fixed sub-control and a scrolling body of their
 * own — PDF pages, PowerPoint slides, a sheet under its tab bar — keep theirs
 * and label it the same way.
 *
 * It is also a **focusable, named region**: a pane that scrolls but contains
 * nothing focusable cannot be reached from a keyboard at all (WCAG 2.1.1), and
 * a plain-text file contains nothing focusable by definition.
 */
export const FileViewerContent = forwardRef<HTMLDivElement, FileViewerContentProps>(
  function FileViewerContent({ className, ...props }, ref) {
    const { state, actions, meta } = useFileViewer();
    const { t } = useLocale();

    return (
      <div
        ref={ref}
        data-slot="file-viewer-content"
        role="region"
        aria-label={t("viewer.content")}
        tabIndex={0}
        className={cn(
          "focus-visible:ring-ring min-h-0 flex-1 overflow-auto p-4 focus-visible:outline-none focus-visible:ring-2",
          className,
        )}
        {...props}
      >
        {state.status === "empty" && <FileViewerEmpty />}
        {state.status === "loading" && <FileViewerSkeleton />}
        {state.status === "error" && <FileViewerError />}
        {state.status === "ready" && state.adapter && state.document && state.source && (
          <state.adapter.Renderer
            document={state.document}
            source={state.source}
            baseHeadingLevel={meta.baseHeadingLevel}
            highlights={meta.resolvedHighlights}
            // `meta.currentHighlightId`, NOT `state.activeHighlightId`: the
            // renderer must follow the find match too, or find can never scroll,
            // page or switch sheet.
            activeHighlightId={meta.currentHighlightId}
            // The view half (ADR 0026). A renderer that ignores these keeps
            // working — they are optional, and a format with no pages or no
            // scaling never reads them.
            pageNumber={state.pageNumber}
            onPageChange={actions.goToPage}
            zoom={state.zoom}
            onZoomResolved={actions.reportZoom}
            rotation={state.rotation}
          />
        )}
      </div>
    );
  },
);

/* -------------------------------------------------------------------------- */
/* Batteries-included                                                          */
/* -------------------------------------------------------------------------- */

export interface FileViewerProps
  extends
    Omit<FileViewerProviderProps, "children">,
    Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Replace the default composition. Rendered inside the provider AND the frame. */
  children?: ReactNode;
}

/**
 * The default composition — provider + frame + toolbar + content.
 *
 * Reach for the parts when you need a different arrangement; this covers the
 * common case in one element.
 */
export const FileViewer = forwardRef<HTMLDivElement, FileViewerProps>(function FileViewer(
  {
    // Every provider prop is destructured BY NAME, and the rest goes to the
    // frame. Peeling off only some of them and spreading the remainder was a
    // silent bug: `baseHeadingLevel` type-checked, never reached the provider,
    // and landed on the `<section>` as an unknown DOM attribute. Adding a
    // provider prop above without adding it here re-creates that exactly.
    source,
    registry,
    loading,
    baseHeadingLevel,
    highlights,
    defaultHighlights,
    onHighlightsChange,
    activeHighlightId,
    defaultActiveHighlightId,
    onActiveHighlightChange,
    pageNumber,
    defaultPageNumber,
    onPageNumberChange,
    zoom,
    defaultZoom,
    onZoomChange,
    rotation,
    defaultRotation,
    onRotationChange,
    children,
    ...props
  },
  ref,
) {
  return (
    <FileViewerProvider
      source={source}
      registry={registry}
      loading={loading}
      baseHeadingLevel={baseHeadingLevel}
      highlights={highlights}
      defaultHighlights={defaultHighlights}
      onHighlightsChange={onHighlightsChange}
      activeHighlightId={activeHighlightId}
      defaultActiveHighlightId={defaultActiveHighlightId}
      onActiveHighlightChange={onActiveHighlightChange}
      pageNumber={pageNumber}
      defaultPageNumber={defaultPageNumber}
      onPageNumberChange={onPageNumberChange}
      zoom={zoom}
      defaultZoom={defaultZoom}
      onZoomChange={onZoomChange}
      rotation={rotation}
      defaultRotation={defaultRotation}
      onRotationChange={onRotationChange}
    >
      <FileViewerFrame ref={ref} {...props}>
        {children ?? (
          <>
            {/* The page and scale controls live in the identity row, not inside
                the canvas: one row of chrome per viewer, and an app that wants
                them somewhere else composes the parts itself. Each renders
                nothing for a format whose manifest does not claim it. */}
            <FileViewerToolbar>
              <FileViewerPager />
              <FileViewerZoom />
              <FileViewerRotate />
            </FileViewerToolbar>
            {/* Renders nothing until Ctrl/Cmd+F, and nothing at all for a
                format whose adapter cannot paint a range. */}
            <FileViewerFind />
            <FileViewerHighlightStatus />
            <FileViewerContent />
          </>
        )}
      </FileViewerFrame>
    </FileViewerProvider>
  );
});
