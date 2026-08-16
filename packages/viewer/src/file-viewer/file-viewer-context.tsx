"use client";

/**
 * The context contract behind every `FileViewer` part.
 *
 * Per `component-api.md` ("Lift state into the Provider; expose a
 * `state` / `actions` interface"), `FileViewerProvider` is the only thing that
 * knows HOW a file is loaded. Parts read the interface below, so a sibling
 * control placed outside the visual frame but inside the provider — a download
 * button in a page header, a format badge in a breadcrumb — reads and drives the
 * same state with no prop-drilling.
 *
 * This module is the CONTRACT only; the provider itself lives beside the parts
 * it feeds, in `file-viewer.tsx`.
 */

import type { ProseHeadingLevel, ResolvedFileSource } from "@elabs/components-ui";
import { createContext, use } from "react";

import type { ViewerError } from "../core/errors";
import type { DocumentHighlight, HighlightSupport, ResolvedHighlight } from "../core/highlight";
import type { ViewerRegistry } from "../core/registry";
import type {
  AdapterCapabilities,
  AdapterDocument,
  AdapterModule,
  DocumentRotation,
  ZoomLevel,
} from "../core/types";

/**
 * Where a file is in its journey to the screen.
 *
 * `loading` means "no renderable content yet" — the canonical signal from
 * `.claude/rules/loading-states.md`, rendered as a layout-shaped skeleton.
 * There is no separate `isStreaming`: a file arrives settled or not at all.
 */
export type FileViewerStatus = "empty" | "loading" | "ready" | "error";

/**
 * The LOAD half of the state — everything the fetch-and-parse effect owns.
 *
 * Split from the highlight half because the two have different lifetimes: this
 * one is replaced wholesale each time a file is opened, while the citations
 * pointing into it are a prop the app controls and outlive any single parse.
 * Folding them together would mean every `setState` in the load effect had to
 * remember to carry the highlights forward.
 */
export interface FileViewerLoadState {
  status: FileViewerStatus;
  /** The resolved source, available as soon as there IS one — before any read. */
  source?: ResolvedFileSource;
  /** The adapter's parsed output. Only in `ready`. */
  document?: AdapterDocument;
  /** The adapter module that produced it, for its `Renderer`. Only in `ready`. */
  adapter?: AdapterModule;
  /** What the chrome may offer. Known from the manifest BEFORE the parser loads. */
  capabilities: AdapterCapabilities;
  /** Only in `error`. Always a `ViewerError`, so `code` can drive the message. */
  error?: ViewerError;
}

/**
 * How the open document is being LOOKED at — which page, at what scale, turned
 * which way.
 *
 * Separate from the load state because it survives nothing and owns nothing: it
 * is pure view, reset (page, rotation) or carried (zoom) when a new file opens.
 * It lives in the provider rather than inside each adapter's `Renderer` so a
 * control can sit anywhere — the shell toolbar, an app's own page header, a
 * deep link — instead of only inside the canvas (ADR 0026).
 */
export interface FileViewerViewState {
  /** 1-based. `1` for a format that does not paginate. */
  pageNumber: number;
  /** `0` until a paginated document is ready, and for formats with no pages. */
  pageCount: number;
  /** What was ASKED for: a fixed scale, or a fit mode the renderer resolves. */
  zoom: ZoomLevel;
  /**
   * What that resolved to, as a number — what the zoom control shows and what
   * `zoomIn`/`zoomOut` step from. Equal to `zoom` whenever `zoom` is a number.
   */
  effectiveZoom: number;
  /** Quarter-turns clockwise. Reset to `0` when a different file is opened. */
  rotation: DocumentRotation;
}

export interface FileViewerState extends FileViewerLoadState, FileViewerViewState {
  /**
   * The parts of the document to point at, as REQUESTED. What was actually
   * located is `meta.resolvedHighlights` — the request survives a miss so the
   * chrome can say "we couldn't find that passage" instead of showing nothing.
   */
  highlights: readonly DocumentHighlight[];
  /** Which one the viewer is pointed at. `null` is "none", explicitly. */
  activeHighlightId: string | null;
  find: FileViewerFindState;
}

/** What find-in-document is doing right now. */
export interface FileViewerFindState {
  /** Whether the search box is showing. */
  open: boolean;
  query: string;
  caseSensitive: boolean;
  /** How many matches the current query has. */
  matches: number;
  /** Whether that count hit `FIND_MATCH_LIMIT` and is therefore a floor. */
  truncated: boolean;
  /**
   * Which match is current, 0-based — the "3" in "3 of 12", minus one.
   *
   * Deliberately NOT the same knob as `activeHighlightId`. Find is the viewer's
   * own, and an app that controls `activeHighlightId` to drive citations would
   * otherwise have to also honour every keystroke of a search it never asked
   * for, or silently break next/previous.
   */
  activeIndex: number;
}

export interface FileViewerActions {
  /** Re-run the load. The retry action on the error state. */
  reload: () => void;
  /**
   * Replace the citations. While `highlights` is controlled this writes no local
   * state — but it still calls `onHighlightsChange`, so the owner can accept the
   * request. Mirroring the platform: a controlled input reports, it does not
   * self-update.
   */
  setHighlights: (highlights: readonly DocumentHighlight[]) => void;
  /** Point the viewer at one highlight, or at none. */
  setActiveHighlight: (id: string | null) => void;
  /** Move to the next/previous CITATION in document order, wrapping around. */
  nextHighlight: () => void;
  previousHighlight: () => void;
  openFind: () => void;
  closeFind: () => void;
  setFindQuery: (query: string) => void;
  setFindCaseSensitive: (caseSensitive: boolean) => void;
  /** Move to the next/previous SEARCH match, wrapping around. */
  nextFindMatch: () => void;
  previousFindMatch: () => void;
  /**
   * Turn to a page, 1-based. Clamped to the document — an out-of-range page is
   * a caller's arithmetic slip, not a reason to blank the canvas.
   */
  goToPage: (page: number) => void;
  /** Turn one page. Both stop at the ends rather than wrapping: a document is not a carousel. */
  nextPage: () => void;
  previousPage: () => void;
  /** Draw at a fixed scale, or hand the renderer a fit mode to resolve. */
  setZoom: (zoom: ZoomLevel) => void;
  /**
   * Step to the next stop above/below what is currently ON SCREEN — so zooming
   * in from a fitted page continues from the fitted scale, not from wherever the
   * fixed ladder was last parked.
   */
  zoomIn: () => void;
  zoomOut: () => void;
  setRotation: (rotation: DocumentRotation) => void;
  /** Turn the document a quarter-turn: `1` clockwise, `-1` counter-clockwise. */
  rotate: (quarterTurns: 1 | -1) => void;
  /**
   * The renderer's report channel for {@link FileViewerViewState.effectiveZoom}
   * — not for app code. `FileViewerContent` wires it to the adapter's
   * `onZoomResolved`, the same way `registerFind` is wired to a part rather than
   * called by a consumer.
   */
  reportZoom: (scale: number) => void;
  /**
   * Tell the viewer a find part is mounted; call the returned function on
   * unmount. `FileViewerFind` does this for you — it exists so the frame knows
   * whether taking Ctrl/Cmd+F off the browser leads anywhere.
   */
  registerFind: () => () => void;
}

export interface FileViewerContextValue {
  state: FileViewerState;
  actions: FileViewerActions;
  registry: ViewerRegistry;
  meta: {
    /**
     * The rung a viewed document's own top-level heading renders at. Passed to
     * every adapter `Renderer`; see `AdapterRendererProps.baseHeadingLevel`.
     */
    baseHeadingLevel: ProseHeadingLevel;
    /**
     * Citations and find matches, LOCATED, in document order, numbered — what
     * an adapter `Renderer` is handed and what the chrome counts.
     */
    resolvedHighlights: readonly ResolvedHighlight[];
    /**
     * Which highlight the viewer is EFFECTIVELY pointed at, and what an adapter
     * `Renderer` receives as `activeHighlightId`.
     *
     * Not the same knob as `state.activeHighlightId`: that one is the citation
     * the app controls, while the reader stepping through find matches is also
     * "current". Find outranks the citation while its box is open and matching,
     * so navigation and scrolling follow whichever the reader is actually moving.
     */
    currentHighlightId: string | null;
    /** Which address kinds this document's adapter declared it can paint. */
    highlightSupport: HighlightSupport;
    /**
     * Whether find-in-document applies to the open document. Derived, not read
     * straight off the manifest — see `AdapterCapabilities.search`.
     */
    canFind: boolean;
    /**
     * Whether a `FileViewerFind` part is composed into this viewer.
     *
     * Separate from {@link canFind}, which only says the ADAPTER could paint a
     * match. The frame needs both before it takes Ctrl/Cmd+F away from the
     * browser: intercepting the shortcut with nowhere to type leaves a keyboard
     * reader with no find at all.
     */
    hasFind: boolean;
  };
}

/**
 * Exported for `FileViewerProvider` (which lives with the parts it feeds, in
 * `file-viewer.tsx`) — NOT part of the package's public surface.
 */
export const FileViewerContext = createContext<FileViewerContextValue | null>(null);

/**
 * Read the viewer state. Throws outside a provider — a part that silently
 * rendered nothing would be far harder to diagnose than a named error.
 */
export function useFileViewer(): FileViewerContextValue {
  const value = use(FileViewerContext);
  if (!value) {
    throw new Error("useFileViewer must be used inside a <FileViewerProvider> (or <FileViewer>).");
  }
  return value;
}
