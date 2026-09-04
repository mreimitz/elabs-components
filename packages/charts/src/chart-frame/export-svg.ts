/**
 * ChartFrame — SVG / PNG export (RM-042).
 *
 * lieflat's deliverable leaves the app (decks, WeChat posts, annual reports),
 * so the chart's *picture* — not just its data — must be exportable. This
 * module builds a self-contained export from the chart's rendered `<svg>`:
 *
 * - Every colour/opacity/font declaration the original resolves via CSS
 *   (Tailwind utility classes, `var(--token)` presentation attributes,
 *   inherited `currentColor`) is read with `getComputedStyle` **at export
 *   time** and baked into the clone as an explicit inline style — so the
 *   file needs no external stylesheet and carries no `var(--…)` reference,
 *   and is correct for whichever theme was active when the user clicked
 *   export.
 * - `@font-face` is deliberately NOT embedded — `font-family` is set to the
 *   resolved font *stack*; a viewer without that font installed falls back
 *   within the stack, same as an ordinary web page.
 * - The resolved background colour (the card's, passed in by the caller) is
 *   painted as a `<rect>` so the export isn't a transparent cutout when
 *   pasted onto a slide.
 * - The source/attribution row (RM-019) is appended at the bottom when
 *   present, inside the same `<svg>` — so it travels with the picture.
 *
 * PNG rasterises that same built SVG through an offscreen `<canvas>` at a
 * fixed 2× pixel ratio (a deliberate, device-independent "@2x" export scale
 * — not the exporting device's actual `devicePixelRatio`, which would make
 * the same chart produce a different file depending on who clicked export).
 */

const SVG_NS = "http://www.w3.org/2000/svg";

/** Presentation properties that may resolve from a `var(--…)`/`currentColor`/class-driven value. */
const INLINED_PROPERTIES = [
  "fill",
  "stroke",
  "stop-color",
  "color",
  "opacity",
  "fill-opacity",
  "stroke-opacity",
  "stroke-width",
  "font-family",
  "font-size",
  "font-weight",
  "letter-spacing",
  "flood-color",
  "lighting-color",
] as const;

/** Fixed export scale — see module doc for why this is not `window.devicePixelRatio`. */
const EXPORT_PIXEL_RATIO = 2;

/** Height (px) reserved for the source/attribution row appended at the bottom of an export. */
const SOURCE_ROW_HEIGHT = 28;
const SOURCE_ROW_PADDING = 12;

export type ChartExportKind = "svg" | "png";

export interface ChartExportOptions {
  /** Attribution/source text (RM-019), rendered as a row at the bottom of the export. */
  source?: string;
  /** Resolved (computed, not `var(…)`) background colour painted behind the chart. */
  backgroundColor?: string;
}

/**
 * Finds the chart's root `<svg>` inside a rendered ChartFrame body. Returns
 * `null` for a non-chart placeholder (no data yet, or a plain `<div>`
 * children in a story/test) — the toolbar hides export controls in that case,
 * same as `table`/`download` degrade without `data`.
 */
export function findChartSvg(container: Element | null | undefined): SVGSVGElement | null {
  if (!container) return null;
  const svg = container.querySelector("svg");
  return svg instanceof SVGSVGElement ? svg : null;
}

function numericAttr(el: Element, name: string, fallback: number): number {
  const raw = el.getAttribute(name);
  const parsed = raw ? Number.parseFloat(raw) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Reads the chart svg's rendered pixel size (falls back to its bounding box). */
export function readSvgSize(svg: SVGSVGElement): { width: number; height: number } {
  const rect = svg.getBoundingClientRect();
  return {
    width: numericAttr(svg, "width", rect.width || 1),
    height: numericAttr(svg, "height", rect.height || 1),
  };
}

/**
 * Walks `clone` in lock-step with `source` (identical structure — `clone` is
 * `source.cloneNode(true)`) and inlines every resolvable computed
 * presentation property, as both the SVG presentation ATTRIBUTE (what a
 * minimal SVG consumer reads — Figma's importer among them) and the inline
 * `style` declaration (belt-and-suspenders for anything that only honours
 * CSS). Setting the attribute is what actually replaces a literal
 * `fill="var(--chart-1)"` — the clone's `style` alone does not touch it,
 * since `cloneNode` copies attributes verbatim and a style declaration
 * doesn't erase the presentation attribute it overrides at *render* time.
 *
 * Also strips `transition`/`animation` from the inline `style` — motion has
 * no place in a static export, and this repo's own timing tokens
 * (`var(--t-fast)`, `var(--ease-standard)`) are exactly the kind of
 * incidental `var(--…)` a colour-focused walk would otherwise miss.
 */
function inlineComputedStyles(source: Element, clone: Element): void {
  if (typeof window === "undefined" || typeof window.getComputedStyle !== "function") return;

  const inlineOne = (sourceEl: Element, cloneEl: Element) => {
    const computed = window.getComputedStyle(sourceEl);
    const style = (cloneEl as HTMLElement | SVGElement).style;
    for (const prop of INLINED_PROPERTIES) {
      const value = computed.getPropertyValue(prop);
      if (!value) continue;
      cloneEl.setAttribute(prop, value);
      style.setProperty(prop, value);
    }
    style.removeProperty("transition");
    style.removeProperty("animation");
  };

  inlineOne(source, clone);

  const sourceWalker = document.createTreeWalker(source, NodeFilter.SHOW_ELEMENT);
  const cloneWalker = document.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT);
  let sourceNode = sourceWalker.nextNode();
  let cloneNode = cloneWalker.nextNode();
  while (sourceNode && cloneNode) {
    inlineOne(sourceNode as Element, cloneNode as Element);
    sourceNode = sourceWalker.nextNode();
    cloneNode = cloneWalker.nextNode();
  }
}

/** Appends the source/attribution row (RM-019) at the bottom of an export. */
function appendSourceRow(
  svg: SVGSVGElement,
  width: number,
  chartHeight: number,
  text: string,
): void {
  const row = document.createElementNS(SVG_NS, "text");
  row.setAttribute("x", String(width / 2));
  row.setAttribute("y", String(chartHeight + SOURCE_ROW_HEIGHT / 2 + 4));
  row.setAttribute("text-anchor", "middle");
  row.style.setProperty("font-size", "10px");
  row.style.setProperty("letter-spacing", "0.05em");
  row.style.setProperty("text-transform", "uppercase");
  row.style.setProperty("fill", "currentColor");
  row.textContent = text;
  svg.append(row);
}

/**
 * Clones `svg`, inlines every resolvable computed style so the file is
 * self-contained, paints the resolved background as a `<rect>`, and appends
 * the source row (RM-019) when present. Pure DOM construction — call
 * `serializeSvg` to get the export string.
 */
export function buildExportSvg(
  svg: SVGSVGElement,
  options: ChartExportOptions = {},
): SVGSVGElement {
  const { width, height } = readSvgSize(svg);
  const extraHeight = options.source ? SOURCE_ROW_HEIGHT + SOURCE_ROW_PADDING : 0;
  const totalHeight = height + extraHeight;

  const clone = svg.cloneNode(true) as SVGSVGElement;
  inlineComputedStyles(svg, clone);

  clone.setAttribute("xmlns", SVG_NS);
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(totalHeight));
  clone.setAttribute("viewBox", `0 0 ${width} ${totalHeight}`);
  // The live chart hides its SVG from AT (`ChartDatapointLayer` is the real
  // keyboard surface, see chart-components.md); the export is a static
  // picture with nothing else on the page, so that exemption doesn't apply.
  clone.removeAttribute("aria-hidden");

  const backgroundRect = document.createElementNS(SVG_NS, "rect");
  backgroundRect.setAttribute("x", "0");
  backgroundRect.setAttribute("y", "0");
  backgroundRect.setAttribute("width", String(width));
  backgroundRect.setAttribute("height", String(totalHeight));
  backgroundRect.setAttribute("fill", options.backgroundColor ?? "transparent");
  clone.insertBefore(backgroundRect, clone.firstChild);

  if (options.source) {
    appendSourceRow(clone, width, height, options.source);
  }

  return clone;
}

/** Serialises an export-built SVG element to a well-formed, standalone SVG string. */
export function serializeSvg(svg: SVGSVGElement): string {
  return new XMLSerializer().serializeToString(svg);
}

/** Filesystem-safe filename stem, derived from the chart title. */
export function slugifyChartFilename(title: string | undefined, fallback = "chart"): string {
  const slug = (title ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
  return slug || fallback;
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ExportChartParams {
  svg: SVGSVGElement;
  /** Chart title, used to build the filename. Non-string titles fall back to `"chart"`. */
  title?: string;
  /** Attribution/source text (RM-019), rendered at the bottom of the export. */
  source?: string;
  /** Resolved (computed) background colour, painted as the export's `<rect>`. */
  backgroundColor?: string;
  /**
   * Routes the export to the caller instead of triggering a local browser
   * download — mirrors `onDownload`, for apps that want to route an export
   * through their own storage.
   */
  onExport?: (kind: ChartExportKind, blob: Blob, filename: string) => void;
}

/** Builds, serialises and (unless `onExport` is set) downloads the chart as an SVG file. */
export function exportChartSvg({
  svg,
  title,
  source,
  backgroundColor,
  onExport,
}: ExportChartParams): void {
  const built = buildExportSvg(svg, { source, backgroundColor });
  const serialized = serializeSvg(built);
  const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
  const filename = `${slugifyChartFilename(title)}.svg`;
  if (onExport) {
    onExport("svg", blob, filename);
  } else {
    triggerBlobDownload(blob, filename);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to rasterise the chart SVG for PNG export."));
    img.src = src;
  });
}

/**
 * Builds, rasterises at a fixed 2× pixel ratio and (unless `onExport` is set)
 * downloads the chart as a PNG file. The resolved background is already
 * painted into the built SVG's `<rect>`, so it comes along for free when
 * `drawImage` rasterises it.
 */
export async function exportChartPng({
  svg,
  title,
  source,
  backgroundColor,
  onExport,
}: ExportChartParams): Promise<void> {
  const built = buildExportSvg(svg, { source, backgroundColor });
  const serialized = serializeSvg(built);
  const width = Number.parseFloat(built.getAttribute("width") ?? "0") || 1;
  const height = Number.parseFloat(built.getAttribute("height") ?? "0") || 1;

  const svgBlob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = width * EXPORT_PIXEL_RATIO;
    canvas.height = height * EXPORT_PIXEL_RATIO;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(EXPORT_PIXEL_RATIO, EXPORT_PIXEL_RATIO);
    ctx.drawImage(image, 0, 0, width, height);

    // canvas.toBlob uses a callback-based API, wrapping in a Promise is necessary
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;

    const filename = `${slugifyChartFilename(title)}.png`;
    if (onExport) {
      onExport("png", blob, filename);
    } else {
      triggerBlobDownload(blob, filename);
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}
