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
 * - `@font-face` is deliberately NOT embedded in the SVG FILE — `font-family`
 *   is set to the resolved font *stack*; a viewer without that font installed
 *   falls back within the stack, same as an ordinary web page. The PNG is
 *   different: an SVG drawn as an image cannot reach the page's web fonts, so
 *   the faces it uses are embedded before rasterising (`export-fonts.ts`).
 * - The resolved background colour (the card's, passed in by the caller) is
 *   painted as a `<rect>` so the export isn't a transparent cutout when
 *   pasted onto a slide.
 * - The source/attribution row (RM-019) is appended at the bottom when
 *   present, inside the same `<svg>` — so it travels with the picture.
 *
 * - RM-117: the HTML around and over the `<svg>` (axis ticks and titles,
 *   legends, the frame's title, description, notes and footer) comes along as
 *   an SVG twin measured by `export-layer.tsx` and passed in as `layer` —
 *   with every other `<svg>`, `<canvas>` and painted HTML box in the frame
 *   (overlays, panels, legend markers, plates), each on its side of the chart.
 *
 * PNG rasterises that same built SVG through an offscreen `<canvas>` at a
 * chosen pixel ratio, 2× by default (a deliberate, device-independent export scale
 * — not the exporting device's actual `devicePixelRatio`, which would make
 * the same chart produce a different file depending on who clicked export).
 */

import { embedExportFonts } from "./export-fonts";
import {
  chartExportLayerPaints,
  clipChartToExportBox,
  inlineComputedStyles,
  renderChartExportLayer,
  renderChartExportUnderlay,
  sanitizeXml,
  type ChartExportLayerModel,
} from "./export-layer";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Default export scale — see module doc for why this is not `window.devicePixelRatio`. */
const EXPORT_PIXEL_RATIO = 2;

/** PNG pixel ratio (RM-117): 1× to 4× the chart's CSS size. */
export type ChartExportScale = 1 | 2 | 3 | 4;

/** What an export asks for (RM-117) — the menu, the footer actions and `onExport` share it. */
export interface ChartExportRequest {
  /** PNG pixel ratio. Default `2`. Ignored by SVG (it is resolution-free). */
  scale?: ChartExportScale;
  /** Leave out the header (title, description) and the footer (notes, byline, source). */
  plain?: boolean;
}

/** Height (px) reserved for the source/attribution row appended at the bottom of an export. */
const SOURCE_ROW_HEIGHT = 28;
const SOURCE_ROW_PADDING = 12;

export type ChartExportKind = "svg" | "png";

export interface ChartExportOptions {
  /** Attribution/source text (RM-019), rendered as a row at the bottom of the export. */
  source?: string;
  /** Resolved (computed, not `var(…)`) background colour painted behind the chart. */
  backgroundColor?: string;
  /**
   * The measured HTML text layer (RM-117, `measureChartExportLayer`): axis
   * ticks and titles, legends, keys and — for a framed export — the header and
   * footer. When its canvas is the `<svg>`'s own box the layer is appended to
   * the clone; otherwise the clone is placed inside a canvas of the layer's size.
   */
  layer?: ChartExportLayerModel;
  /** Accessible name of the exported picture (a root `<title>`), usually the chart title. */
  title?: string;
}

/**
 * Where an `<svg>` is a control's glyph or a transient surface, never the
 * chart: a button's icon, a toolbar, a menu, a tooltip, or anything marked
 * `data-chart-export="exclude"`.
 */
const NOT_THE_CHART =
  '[data-chart-export="exclude"], button, a[href], [role="button"], [role="toolbar"], [role="menu"], [role="menubar"], [role="tooltip"], [role="dialog"], [role="alertdialog"]';

/** The top-level `<svg>`s inside `container` that could be the chart. */
function chartSvgCandidates(container: Element): SVGSVGElement[] {
  const inside = (el: Element | null | undefined) =>
    Boolean(el && el !== container && container.contains(el));
  return [...container.querySelectorAll("svg")].filter(
    (svg): svg is SVGSVGElement =>
      svg instanceof SVGSVGElement &&
      !inside(svg.parentElement?.closest("svg")) &&
      !inside(svg.closest(NOT_THE_CHART)),
  );
}

/**
 * Finds the chart's root `<svg>` inside a rendered ChartFrame body: the
 * largest top-level `<svg>` that is not a control's glyph — a legend marker,
 * a selection toolbar's icon or a zoom button can come first in the DOM, and
 * none of them is the chart. Returns `null` for a non-chart placeholder (no
 * data yet, or a plain `<div>` children in a story/test) — the toolbar hides
 * export controls in that case, same as `table`/`download` degrade without
 * `data`. Reads layout: call it at export time, not in a render loop (see
 * {@link hasChartSvg}).
 */
export function findChartSvg(container: Element | null | undefined): SVGSVGElement | null {
  if (!container) return null;
  const candidates = chartSvgCandidates(container);
  let best: SVGSVGElement | null = candidates[0] ?? null;
  let bestArea = 0;
  for (const svg of candidates) {
    const rect = svg.getBoundingClientRect();
    const area = rect.width * rect.height;
    if (area > bestArea) {
      best = svg;
      bestArea = area;
    }
  }
  return best;
}

/** Whether `container` holds a chart `<svg>` at all — {@link findChartSvg} without the layout reads. */
export function hasChartSvg(container: Element | null | undefined): boolean {
  return Boolean(container) && chartSvgCandidates(container!).length > 0;
}

function numericAttr(el: Element, name: string, fallback: number): number {
  const raw = el.getAttribute(name);
  // `width="100%"` is relative to the page, not a pixel size.
  if (!raw || raw.trim().endsWith("%")) return fallback;
  const parsed = Number.parseFloat(raw);
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

  const layer = options.layer;
  if (!layer) return clone;
  if (layer.userSpace !== undefined) {
    // Measured against the <svg> itself (a dashboard part): the layer joins the
    // clone in the svg's own user space, so the part's size, viewBox and marks
    // stay exactly as they were. An empty layer adds nothing at all.
    if (chartExportLayerPaints(layer)) {
      const underlay = renderChartExportUnderlay(layer);
      if (underlay) {
        underlay.setAttribute("transform", layer.userSpace);
        backgroundRect.after(underlay);
      }
      const group = renderChartExportLayer(layer);
      group.setAttribute("transform", layer.userSpace);
      clone.append(group);
    }
    return clone;
  }
  const inPlace =
    layer.chart.x === 0 &&
    layer.chart.y === 0 &&
    Math.abs(layer.width - width) < 0.5 &&
    Math.abs(layer.height - height) < 0.5;
  if (inPlace) {
    const underlay = renderChartExportUnderlay(layer);
    if (underlay) backgroundRect.after(underlay);
    clone.append(renderChartExportLayer(layer));
    return clone;
  }
  // The frame paints its own background; the clone's would hide the underlay.
  backgroundRect.remove();
  if (typeof window !== "undefined" && window.getComputedStyle(svg).overflow === "visible") {
    // A nested <svg> clips to its box by default; the page let marks overhang it.
    clone.setAttribute("overflow", "visible");
  }
  return composeFramedExport(clone, width, height, layer, options);
}

/**
 * RM-117: the frame's picture — a canvas the frame's CSS size, the chart clone
 * at its measured box, and the HTML layer (header, ticks, legend, footer) over it.
 */
function composeFramedExport(
  clone: SVGSVGElement,
  chartWidth: number,
  chartHeight: number,
  layer: ChartExportLayerModel,
  options: ChartExportOptions,
): SVGSVGElement {
  const root = document.createElementNS(SVG_NS, "svg");
  root.setAttribute("xmlns", SVG_NS);
  root.setAttribute("width", String(layer.width));
  root.setAttribute("height", String(layer.height));
  root.setAttribute("viewBox", `0 0 ${layer.width} ${layer.height}`);
  if (options.title) {
    root.setAttribute("role", "img");
    const title = document.createElementNS(SVG_NS, "title");
    title.textContent = options.title;
    root.append(title);
  }
  const background = document.createElementNS(SVG_NS, "rect");
  background.setAttribute("x", "0");
  background.setAttribute("y", "0");
  background.setAttribute("width", String(layer.width));
  background.setAttribute("height", String(layer.height));
  background.setAttribute("fill", options.backgroundColor ?? "transparent");
  root.append(background);
  const underlay = renderChartExportUnderlay(layer);
  if (underlay) root.append(underlay);
  // The clone keeps its own pixel viewBox, so it draws 1:1 at its measured box.
  clone.setAttribute("viewBox", `0 0 ${chartWidth} ${chartHeight}`);
  clone.setAttribute("x", String(layer.chart.x));
  clone.setAttribute("y", String(layer.chart.y));
  clone.setAttribute("width", String(chartWidth));
  clone.setAttribute("height", String(chartHeight));
  clone.removeAttribute("xmlns");
  root.append(clipChartToExportBox(layer, clone));
  root.append(renderChartExportLayer(layer));
  return root;
}

/**
 * Serialises an export-built SVG element to a well-formed, standalone SVG
 * string. Characters XML forbids (a control character in a process map's edge
 * id) become U+FFFD — one of them would make the whole file unreadable.
 */
export function serializeSvg(svg: SVGSVGElement): string {
  return sanitizeXml(new XMLSerializer().serializeToString(svg));
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
  /** The measured HTML text layer (RM-117) — see {@link ChartExportOptions.layer}. */
  layer?: ChartExportLayerModel;
  /** PNG pixel ratio (RM-117). Default `2`. */
  scale?: ChartExportScale;
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
  layer,
  onExport,
}: ExportChartParams): void {
  const built = buildExportSvg(svg, { source, backgroundColor, layer, title });
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
 * Builds, rasterises at `scale` (default 2×) and (unless `onExport` is set)
 * downloads the chart as a PNG file. The resolved background is already
 * painted into the built SVG's `<rect>`, so it comes along for free when
 * `drawImage` rasterises it. The web fonts the picture uses are embedded
 * first: an SVG drawn as an image cannot load the page's fonts, and a
 * fallback face lays every label out at a different width.
 */
export async function exportChartPng({
  svg,
  title,
  source,
  backgroundColor,
  layer,
  scale = EXPORT_PIXEL_RATIO,
  onExport,
}: ExportChartParams): Promise<void> {
  const built = buildExportSvg(svg, { source, backgroundColor, layer, title });
  await embedExportFonts(built);
  const serialized = serializeSvg(built);
  const width = Number.parseFloat(built.getAttribute("width") ?? "0") || 1;
  const height = Number.parseFloat(built.getAttribute("height") ?? "0") || 1;

  const svgBlob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const image = await loadImage(url);
    // `load` can fire before the embedded fonts are decoded; draw once they are.
    await image.decode().catch(() => undefined);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(scale, scale);
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

// composeSvg — RM-084
/**
 * One positioned part of a composed multi-chart export (RM-084): an already self-contained
 * SVG element (typically `buildExportSvg`'s output, so its colours/fonts are already inlined)
 * placed at `x, y` and scaled to `width × height`.
 */
export interface ComposeSvgPart {
  svg: SVGSVGElement;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Accessible title for this part's group (a tile's title), read by screen readers/Figma. */
  title?: string;
}

/** Height (px) reserved for the title row a composed export prepends when `title` is set. */
const COMPOSE_TITLE_ROW_HEIGHT = 40;

/**
 * Accessible name used when `options.title` is not set — a composed export is still a whole
 * picture a screen reader or an `<img>`/`<object>` embed needs a name for (WCAG 1.1.1), even
 * with no visible title row.
 */
const DEFAULT_COMPOSED_SVG_TITLE = "Exported chart";

const COMPOSE_SVG_TITLE_ID = "composed-svg-title";
const COMPOSE_SVG_DESC_ID = "composed-svg-desc";

export interface ComposeSvgOptions {
  /** Canvas size the parts' `x`/`y`/`width`/`height` are positioned within. */
  width: number;
  height: number;
  /** Resolved (computed, not `var(…)`) background colour painted behind every part. */
  backgroundColor?: string;
  /** Sheet/composition title, rendered as a row above every part AND the root's accessible name. */
  title?: string;
  /** One or two sentences on what the export shows; rendered as the root `<desc>` when set. */
  description?: string;
  /** Attribution/source text (RM-019's row, reused), rendered at the bottom. */
  source?: string;
}

/**
 * Composes several already-built export parts (one per tile) into one self-contained `<svg>`:
 * one `<g transform="translate(x, y)">` per part at its `cellRect`, each wrapping a nested
 * `<svg>` sized to that part's `width × height` so the part's own viewBox/marks scale
 * correctly, plus an optional title row above and a source row below (both reuse this
 * module's existing row conventions). Deterministic — no timestamps, no random ids — so two
 * calls with the same parts produce byte-identical output.
 *
 * The root itself carries `role="img"` and `aria-labelledby` pointing at a root `<title>` —
 * `options.title` when set, else `DEFAULT_COMPOSED_SVG_TITLE` — placed as the FIRST child (the
 * SVG spec's own requirement for a `<title>` to name its element), plus a root `<desc>` +
 * `aria-describedby` when `options.description` is set. This is the whole-picture accessible
 * name a screen reader or an `<img>`/`<object>` embed reads, separate from each part's own
 * per-tile `<title>` below (only reachable by an AT walking the SVG's own tree).
 */
export function composeSvg(
  parts: readonly ComposeSvgPart[],
  options: ComposeSvgOptions,
): SVGSVGElement {
  const titleRowHeight = options.title ? COMPOSE_TITLE_ROW_HEIGHT : 0;
  const sourceRowHeight = options.source ? SOURCE_ROW_HEIGHT + SOURCE_ROW_PADDING : 0;
  const totalHeight = options.height + titleRowHeight + sourceRowHeight;

  const root = document.createElementNS(SVG_NS, "svg");
  root.setAttribute("xmlns", SVG_NS);
  root.setAttribute("width", String(options.width));
  root.setAttribute("height", String(totalHeight));
  root.setAttribute("viewBox", `0 0 ${options.width} ${totalHeight}`);
  root.setAttribute("role", "img");
  root.setAttribute("aria-labelledby", COMPOSE_SVG_TITLE_ID);

  const rootTitle = document.createElementNS(SVG_NS, "title");
  rootTitle.setAttribute("id", COMPOSE_SVG_TITLE_ID);
  rootTitle.textContent = options.title || DEFAULT_COMPOSED_SVG_TITLE;
  root.append(rootTitle);

  if (options.description) {
    root.setAttribute("aria-describedby", COMPOSE_SVG_DESC_ID);
    const rootDesc = document.createElementNS(SVG_NS, "desc");
    rootDesc.setAttribute("id", COMPOSE_SVG_DESC_ID);
    rootDesc.textContent = options.description;
    root.append(rootDesc);
  }

  const background = document.createElementNS(SVG_NS, "rect");
  background.setAttribute("x", "0");
  background.setAttribute("y", "0");
  background.setAttribute("width", String(options.width));
  background.setAttribute("height", String(totalHeight));
  background.setAttribute("fill", options.backgroundColor ?? "transparent");
  root.append(background);

  if (options.title) {
    const heading = document.createElementNS(SVG_NS, "text");
    heading.setAttribute("x", String(options.width / 2));
    heading.setAttribute("y", String(titleRowHeight / 2 + 6));
    heading.setAttribute("text-anchor", "middle");
    heading.style.setProperty("font-size", "16px");
    heading.style.setProperty("font-weight", "600");
    heading.style.setProperty("fill", "currentColor");
    heading.textContent = options.title;
    root.append(heading);
  }

  for (const part of parts) {
    const group = document.createElementNS(SVG_NS, "g");
    group.setAttribute("transform", `translate(${part.x}, ${part.y + titleRowHeight})`);
    if (part.title) {
      const groupTitle = document.createElementNS(SVG_NS, "title");
      groupTitle.textContent = part.title;
      group.append(groupTitle);
    }
    const nested = part.svg.cloneNode(true) as SVGSVGElement;
    if (!nested.getAttribute("viewBox")) {
      const w = nested.getAttribute("width") ?? String(part.width);
      const h = nested.getAttribute("height") ?? String(part.height);
      nested.setAttribute("viewBox", `0 0 ${w} ${h}`);
    }
    nested.setAttribute("x", "0");
    nested.setAttribute("y", "0");
    nested.setAttribute("width", String(part.width));
    nested.setAttribute("height", String(part.height));
    nested.removeAttribute("aria-hidden");
    group.append(nested);
    root.append(group);
  }

  if (options.source) {
    appendSourceRow(root, options.width, totalHeight - sourceRowHeight, options.source);
  }

  return root;
}
