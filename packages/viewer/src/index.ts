/**
 * @elabs-ai/components-viewer — render any file in the browser.
 *
 * A Layer-2 leaf (`tokens → ui → viewer`, ADR 0024). Formats are adapters in a
 * registry: an eager manifest plus a lazy loader, so an app that never opens a
 * spreadsheet never downloads a spreadsheet parser. Every parser is an OPTIONAL
 * peer — install only what you open.
 *
 * The input model (`FileSource`, `resolveFileKind`, `fileIconFor`) lives in
 * `@elabs-ai/components-ui`, so `-ai`, `-viewer` and your own code
 * all speak it.
 */

// Components
export {
  FileViewer,
  FileViewerContent,
  FileViewerEmpty,
  FileViewerError,
  FileViewerFrame,
  FileViewerHighlightStatus,
  FileViewerProvider,
  FileViewerSkeleton,
  FileViewerToolbar,
  type FileViewerContentProps,
  type FileViewerFrameProps,
  type FileViewerHighlightStatusProps,
  type FileViewerProps,
  type FileViewerProviderProps,
  type FileViewerToolbarProps,
} from "./file-viewer/file-viewer";
export {
  FileViewerFind,
  isFindShortcut,
  type FileViewerFindProps,
} from "./file-viewer/file-viewer-find";
// Page, scale and rotation chrome (ADR 0026). Parts, not adapter internals: an
// app can put any of them in its own header and drive the same provider state.
export { FileViewerPager, type FileViewerPagerProps } from "./file-viewer/file-viewer-pager";
export {
  FileViewerRotate,
  FileViewerZoom,
  type FileViewerRotateProps,
  type FileViewerZoomProps,
} from "./file-viewer/file-viewer-zoom";
export {
  useFileViewer,
  type FileViewerActions,
  type FileViewerContextValue,
  type FileViewerFindState,
  type FileViewerLoadState,
  type FileViewerState,
  type FileViewerStatus,
  type FileViewerViewState,
} from "./file-viewer/file-viewer-context";
// The zoom ladder is shared: the provider steps along it and the shell's control
// lists it, so a consumer building its own zoom UI reads the same one.
export { canStepZoom, DEFAULT_ZOOM, isZoomFit, stepZoom, VIEWER_ZOOM_STEPS } from "./core/zoom";

// Pointing the viewer at part of a document (ADR 0025). The ADDRESS vocabulary
// itself is in `@elabs-ai/components-ui` — a citation's producer and
// this consumer are sibling packages that may not import each other.
export {
  FIND_MATCH_LIMIT,
  findMatchId,
  isFindMatchId,
  type DocumentHighlight,
  type HighlightMissReason,
  type HighlightSource,
  type HighlightStatus,
  type HighlightSupport,
  type ResolvedHighlight,
} from "./core/highlight";
export {
  locateQuote,
  resolveHighlights,
  type HighlightResolveContext,
} from "./core/highlight-resolve";
// The PAINT half. Exported for the same reason the index half is: the registry
// is a documented extension point, so a third-party adapter has to be able to
// mark a passage the way the shipped ones do. Re-deriving it by hand means
// re-deriving the merge-vs-`activeIndex` correspondence and the
// `data-slot`/`data-active` scroll contract, and getting either wrong is silent.
export { localizeRanges, toMarkRanges, type MarkRanges } from "./core/highlight-marks";
export {
  useScrollActiveHighlightIntoView,
  ACTIVE_HIGHLIGHT_SELECTOR,
} from "./core/use-highlight-scroll";
// `MarkedText` itself stays internal on purpose: it renders a FRAGMENT, so it
// has no element to carry a `data-slot`, and giving it a wrapper would put a
// span around every unmarked run of every document to no one's benefit. It is
// four lines of glue over the two exports above — a third-party adapter composes
// `localizeRanges` with `MatchHighlight` from `@elabs-ai/components-ui`
// the same way.
export {
  chunkOffset,
  createTextIndexBuilder,
  spanAt,
  spansForRange,
  type SpanOverlap,
  type TextIndex,
  type TextIndexBuilder,
  type TextIndexBuilderOptions,
  type TextSpan,
} from "./core/text-index";

// Registry — the extension point
export { createRegistry, scoreManifest, type ViewerRegistry } from "./core/registry";
export { createDefaultRegistry } from "./adapters";
export {
  codeManifest,
  csvManifest,
  docxManifest,
  imageManifest,
  jsonManifest,
  markdownManifest,
  mediaManifest,
  pdfManifest,
  pptxManifest,
  textManifest,
  xlsxManifest,
} from "./adapters";

// PDF engine wiring. Exported so an app behind a strict CSP — or a bundler that
// cannot see through `new URL(…, import.meta.url)` — can serve the pdf.js worker
// and font assets itself. Types only; the engine stays behind a dynamic import.
export {
  configurePdfEngine,
  getPdfEngineConfig,
  type PdfEngineConfig,
} from "./adapters/pdf/pdf-engine";
export {
  PROTOCOL_VERSION,
  type AdapterCapabilities,
  type AdapterDocument,
  type AdapterLoadContext,
  type AdapterLoader,
  type AdapterManifest,
  type AdapterModule,
  type AdapterRendererProps,
  type DocumentRotation,
  type FileAdapter,
  type ZoomFit,
  type ZoomLevel,
} from "./core/types";

// Failures — the `code` is the contract, not the message
export {
  ViewerError,
  isAbort,
  isModuleNotFound,
  isViewerError,
  parserMissingError,
  toViewerError,
  type ViewerErrorCode,
  type ViewerErrorOptions,
} from "./core/errors";
