/**
 * The pdf.js seam — one place that knows the engine exists.
 *
 * Everything here is deliberately NOT React. Splitting the engine wiring from
 * the renderer keeps two things true: the dynamic `import("pdfjs-dist")` has a
 * single call site (so `heavy-deps:check` has one edge to police), and an app
 * can configure the worker before any file is ever opened.
 *
 * ## Why a worker is not optional
 *
 * pdf.js parses and rasterizes on a worker thread; without one it falls back to
 * doing that on the main thread, and a 40-page document freezes the tab. The
 * default below resolves the worker that ships INSIDE `pdfjs-dist`, via
 * `new URL(…, import.meta.url)` — the form every modern bundler understands, so
 * it works with no configuration in Vite/webpack/Next.
 *
 * ## Why an app may still have to configure it
 *
 * A CSP without `worker-src blob:` — or a bundler that cannot see through the
 * `new URL` form — needs the worker served as a real asset instead. Hence
 * {@link configurePdfEngine}: set `workerSrc` to a URL your app serves, and the
 * default is never consulted. `cMapUrl` / `standardFontDataUrl` are the same
 * story for CJK text and non-embedded fonts, which pdf.js fetches on demand.
 */

/** Engine wiring an app can override. Every field is optional. */
export interface PdfEngineConfig {
  /** URL of `pdf.worker.min.mjs`. Defaults to the copy inside `pdfjs-dist`. */
  workerSrc?: string;
  /** Directory of pdf.js `cmaps/`, for documents with CJK text. */
  cMapUrl?: string;
  /** Directory of pdf.js `standard_fonts/`, for documents that embed no fonts. */
  standardFontDataUrl?: string;
}

let config: PdfEngineConfig = {};

/**
 * Point the PDF adapter at your own copies of the pdf.js assets.
 *
 * Call once at app start, before a PDF is opened. Calling it later is harmless
 * but only affects documents opened afterwards — pdf.js reads the worker
 * setting when a document is created.
 */
export function configurePdfEngine(next: PdfEngineConfig): void {
  config = { ...config, ...next };
}

/** What the adapter will actually use, after any {@link configurePdfEngine} call. */
export function getPdfEngineConfig(): Readonly<PdfEngineConfig> {
  return config;
}

/**
 * The pdf.js surface this adapter uses, declared structurally.
 *
 * `pdfjs-dist` is an OPTIONAL peer, so its types are not guaranteed to be
 * installed — importing them would make this package's typecheck depend on a
 * package a consumer may not have. Declaring the handful of members used here
 * keeps the build honest without that coupling, and a shape change in pdf.js
 * surfaces as a runtime failure the `parse-failed` panel already handles.
 */
export interface PdfPageViewport {
  width: number;
  height: number;
}

export interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName?: string;
}

export interface PdfPage {
  getViewport(options: { scale: number; rotation?: number }): PdfPageViewport;
  render(options: { canvasContext: CanvasRenderingContext2D; viewport: PdfPageViewport }): {
    promise: Promise<void>;
    cancel(): void;
  };
  getTextContent(): Promise<{ items: PdfTextItem[] }>;
  cleanup(): void;
}

export interface PdfDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPage>;
}

/**
 * An open document plus the one call that releases its worker.
 *
 * The two are separate because **the worker belongs to the LOADING TASK, not to
 * the document**: pdf.js removed `PDFDocumentProxy.destroy()` in v5, so
 * `document.destroy()` is not a function on the engine this package installs. It
 * type-checked anyway — the structural `PdfDocument` interface here declared a
 * method the real proxy does not have — and threw a `TypeError` on every unmount,
 * leaking exactly the worker per document that `dispose()` exists to prevent.
 * Keeping the teardown on this object rather than on `document` is what stops the
 * mistake from being expressible.
 */
export interface PdfSession {
  document: PdfDocument;
  destroy(): Promise<void>;
}

interface PdfJsModule {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(options: Record<string, unknown>): {
    promise: Promise<PdfDocument>;
    destroy(): Promise<void>;
  };
}

let enginePromise: Promise<PdfJsModule> | undefined;

/**
 * Load pdf.js once per page load and wire its worker.
 *
 * The result is cached: opening a second PDF must not re-fetch a megabyte of
 * engine. A FAILED load is not cached, so a transient network error can be
 * retried by the viewer's own retry button.
 */
export async function loadPdfEngine(): Promise<PdfJsModule> {
  enginePromise ??= (async () => {
    // The ONLY edge to the optional peer. A static import here would break
    // every consumer that did not install pdfjs-dist (heavy-deps:check).
    const pdfjs = (await import("pdfjs-dist")) as unknown as PdfJsModule;
    pdfjs.GlobalWorkerOptions.workerSrc = config.workerSrc ?? defaultWorkerSrc();
    return pdfjs;
  })().catch((error: unknown) => {
    enginePromise = undefined;
    throw error;
  });
  return enginePromise;
}

/**
 * The worker that ships with the installed `pdfjs-dist`.
 *
 * `new URL(…, import.meta.url)` is a *bundler instruction*, not a runtime path
 * lookup: Vite, webpack 5 and Turbopack all rewrite it to an emitted asset URL.
 * It is wrapped because a runtime without `import.meta.url` (a CJS test) throws
 * here, and a missing worker should surface as "configure the worker", not as an
 * unexplained crash.
 */
function defaultWorkerSrc(): string {
  return new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).href;
}

/** Open a document from bytes. The caller owns `destroy()` — see the adapter's `dispose`. */
export async function openPdfDocument(
  bytes: Uint8Array,
  signal?: AbortSignal,
): Promise<PdfSession> {
  const pdfjs = await loadPdfEngine();
  const task = pdfjs.getDocument({
    data: bytes,
    // Defence in depth: pdf.js can evaluate font programs, and a viewer opens
    // files the app did not write. The cost is a rare, slightly slower font
    // path; the benefit is that a malicious PDF has no `eval` to reach for.
    isEvalSupported: false,
    cMapUrl: config.cMapUrl,
    cMapPacked: true,
    standardFontDataUrl: config.standardFontDataUrl,
  });
  signal?.addEventListener("abort", () => void task.destroy(), { once: true });
  const document = await task.promise;
  return { document, destroy: () => task.destroy() };
}
