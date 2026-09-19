/**
 * ChartFrame — the export layer (RM-117).
 *
 * A chart's `<svg>` holds only its marks: axis tick labels and titles, legends,
 * keys, the frame's title, description, notes and footer are HTML laid over
 * or around it. An export of the `<svg>` alone loses all of them. This module
 * turns that HTML into an SVG twin in two steps:
 *
 * 1. {@link measureChartExportLayer} reads the rendered geometry ONCE, at
 *    export time, into a plain data model ({@link ChartExportLayerModel}):
 *    one text run per painted line (text, box, resolved font and ink), one
 *    swatch per colour chip, and the chart `<svg>`'s own box. Every value is a
 *    resolved computed style — never a `var(--…)` — and every coordinate is
 *    rounded to 1/100 px so the same layout yields the same model.
 * 2. {@link renderChartExportLayer} is a pure function of that model: it
 *    builds `<rect>` swatches and `<text>` runs. No DOM reads, no raster, no
 *    screenshot.
 *
 * What is skipped: anything inside an `<svg>` (the chart clone already holds
 * it), visually hidden text (`sr-only` restatements), hidden or transparent
 * elements, and any subtree marked `data-chart-export="exclude"` (the footer's
 * action links — "Get the data" is a control, not part of the picture).
 */

const SVG_NS = "http://www.w3.org/2000/svg";

/** What a text run is, from the nearest `data-slot` ancestor — lets a validator count kinds. */
export type ChartExportRole =
  | "title"
  | "description"
  | "tick"
  | "axis-title"
  | "legend"
  | "notes"
  | "footer"
  | "label";

/** One painted line of HTML text, in export coordinates (px from the export's top-left). */
export interface ChartExportTextRun {
  role: ChartExportRole;
  text: string;
  /** Left edge of the line, or its centre when `rotate` is set. */
  x: number;
  /** Vertical centre of the line (drawn with `dominant-baseline="central"`). */
  y: number;
  /** Degrees, clockwise — a rotated tick label. Drawn centred on `x, y`. */
  rotate?: number;
  fill: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  fontStyle: string;
  letterSpacing?: string;
  textDecoration?: string;
}

/** One colour chip (a legend swatch, an `InlineChip`), in export coordinates. */
export interface ChartExportSwatch {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  radius: number;
}

/** Everything the export layer paints, measured once. */
export interface ChartExportLayerModel {
  /** The export canvas: the measured box's CSS size. */
  width: number;
  height: number;
  /** Where the chart `<svg>` sits inside the canvas. */
  chart: { x: number; y: number; width: number; height: number };
  runs: ChartExportTextRun[];
  swatches: ChartExportSwatch[];
}

export interface MeasureChartExportLayerOptions {
  /** The chart's rendered `<svg>` — placed at its measured box. */
  svg: SVGSVGElement;
  /**
   * The box that becomes the export canvas. Default: the `<svg>`'s own box
   * (a bare chart — a dashboard tile keeps its exact part size).
   */
  box?: Element;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Maps the nearest `data-slot` ancestor to a run's role. */
function roleOf(el: Element | null, scope: Element): ChartExportRole {
  let node: Element | null = el;
  while (node && node !== scope.parentElement) {
    const slot = node.getAttribute("data-slot");
    if (slot) {
      if (slot.includes("axis-title")) return "axis-title";
      if (slot.includes("axis")) return "tick";
      if (slot.includes("legend") || slot.includes("key")) return "legend";
      if (slot === "chart-frame-notes") return "notes";
      if (slot.includes("footer") || slot.includes("source")) return "footer";
      if (slot === "card-title" || slot === "chart-frame-title") return "title";
      if (slot === "card-description" || slot === "chart-frame-description") return "description";
    }
    node = node.parentElement;
  }
  return "label";
}

/** True for a visually-hidden restatement (`sr-only`): a 1 × 1 clipped box. */
function isVisuallyHidden(el: Element, style: CSSStyleDeclaration): boolean {
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return true;
  }
  if (style.position !== "absolute") return false;
  const rect = el.getBoundingClientRect();
  return rect.width <= 1 && rect.height <= 1;
}

/** The rotation (degrees) of the nearest rotated ancestor inside `scope`, else 0. */
function rotationOf(el: Element, scope: Element): number {
  let node: Element | null = el;
  while (node && node !== scope) {
    const t = window.getComputedStyle(node).transform;
    if (t && t !== "none") {
      const m = /matrix\(([^)]+)\)/.exec(t);
      if (m) {
        const [a, b] = m[1]!.split(",").map((v) => Number.parseFloat(v));
        if (Math.abs(b ?? 0) > 1e-6) return round((Math.atan2(b!, a!) * 180) / Math.PI);
      }
    }
    node = node.parentElement;
  }
  return 0;
}

function transformText(text: string, transform: string): string {
  if (transform === "uppercase") return text.toUpperCase();
  if (transform === "lowercase") return text.toLowerCase();
  return text;
}

/**
 * Reads every painted HTML text line and colour chip inside `scope` into a
 * model, in coordinates relative to `options.box` (default: the `<svg>`).
 * Call it at export time only — it reads layout.
 */
export function measureChartExportLayer(
  scope: Element,
  options: MeasureChartExportLayerOptions,
): ChartExportLayerModel {
  const boxEl = options.box ?? options.svg;
  const origin = boxEl.getBoundingClientRect();
  const svgRect = options.svg.getBoundingClientRect();
  const model: ChartExportLayerModel = {
    width: round(origin.width),
    height: round(origin.height),
    chart: {
      x: round(svgRect.left - origin.left),
      y: round(svgRect.top - origin.top),
      width: round(svgRect.width),
      height: round(svgRect.height),
    },
    runs: [],
    swatches: [],
  };
  if (typeof window === "undefined" || typeof document === "undefined") return model;

  const inBox = (r: DOMRect) =>
    r.right > origin.left &&
    r.left < origin.right &&
    r.bottom > origin.top &&
    r.top < origin.bottom;

  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
      const el = node as Element;
      if (el.namespaceURI === SVG_NS) return NodeFilter.FILTER_REJECT;
      if (el.getAttribute("data-chart-export") === "exclude") return NodeFilter.FILTER_REJECT;
      if (isVisuallyHidden(el, window.getComputedStyle(el))) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const range = document.createRange();
  // No layout engine (jsdom): nothing is painted, so there is nothing to measure.
  if (typeof range.getBoundingClientRect !== "function") return model;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const slot = el.getAttribute("data-slot") ?? "";
      if (slot.endsWith("swatch") || el.getAttribute("data-chart-export") === "swatch") {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const fill = style.backgroundColor;
        if (rect.width > 0 && rect.height > 0 && inBox(rect) && fill !== "rgba(0, 0, 0, 0)") {
          model.swatches.push({
            x: round(rect.left - origin.left),
            y: round(rect.top - origin.top),
            width: round(rect.width),
            height: round(rect.height),
            fill,
            radius: round(
              Math.min(Number.parseFloat(style.borderTopLeftRadius) || 0, rect.height / 2),
            ),
          });
        }
      }
      continue;
    }

    const textNode = node as Text;
    const parent = textNode.parentElement;
    if (!parent || !textNode.data.trim()) continue;
    const style = window.getComputedStyle(parent);
    const base = {
      role: roleOf(parent, scope),
      fill: style.color,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      fontStyle: style.fontStyle,
      ...(style.letterSpacing && style.letterSpacing !== "normal"
        ? { letterSpacing: style.letterSpacing }
        : {}),
      ...(style.textDecorationLine && style.textDecorationLine !== "none"
        ? { textDecoration: style.textDecorationLine }
        : {}),
    };

    const rotate = rotationOf(parent, scope);
    if (rotate !== 0) {
      range.selectNodeContents(textNode);
      const rect = range.getBoundingClientRect();
      if (!inBox(rect)) continue;
      model.runs.push({
        ...base,
        text: transformText(textNode.data.trim(), style.textTransform),
        x: round((rect.left + rect.right) / 2 - origin.left),
        y: round((rect.top + rect.bottom) / 2 - origin.top),
        rotate,
      });
      continue;
    }

    // One run per painted line: group the words by their line box.
    type Line = { start: number; end: number; left: number; top: number; bottom: number };
    const lines: Line[] = [];
    for (const match of textNode.data.matchAll(/\S+/g)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      range.setStart(textNode, start);
      range.setEnd(textNode, end);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      const last = lines.at(-1);
      const mid = (rect.top + rect.bottom) / 2;
      if (last && mid > last.top && mid < last.bottom) {
        last.end = end;
      } else {
        lines.push({ start, end, left: rect.left, top: rect.top, bottom: rect.bottom });
      }
    }
    for (const line of lines) {
      const lineRect = {
        left: line.left,
        right: line.left + 1,
        top: line.top,
        bottom: line.bottom,
      };
      if (!inBox(lineRect as DOMRect)) continue;
      model.runs.push({
        ...base,
        text: transformText(textNode.data.slice(line.start, line.end), style.textTransform),
        x: round(line.left - origin.left),
        y: round((line.top + line.bottom) / 2 - origin.top),
      });
    }
  }
  range.detach();
  return model;
}

/**
 * The SVG twin of a measured layer: swatches first, then text runs. Pure — the
 * same model always yields the same markup.
 */
export function renderChartExportLayer(model: ChartExportLayerModel): SVGGElement {
  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute("data-slot", "chart-export-layer");
  for (const s of model.swatches) {
    const rect = document.createElementNS(SVG_NS, "rect");
    rect.setAttribute("x", String(s.x));
    rect.setAttribute("y", String(s.y));
    rect.setAttribute("width", String(s.width));
    rect.setAttribute("height", String(s.height));
    if (s.radius > 0) rect.setAttribute("rx", String(s.radius));
    rect.setAttribute("fill", s.fill);
    group.append(rect);
  }
  for (const run of model.runs) {
    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("data-export-role", run.role);
    text.setAttribute("x", String(run.x));
    text.setAttribute("y", String(run.y));
    text.setAttribute("dominant-baseline", "central");
    if (run.rotate) {
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("transform", `rotate(${run.rotate} ${run.x} ${run.y})`);
    }
    text.setAttribute("fill", run.fill);
    text.setAttribute("font-family", run.fontFamily);
    text.setAttribute("font-size", run.fontSize);
    text.setAttribute("font-weight", run.fontWeight);
    if (run.fontStyle !== "normal") text.setAttribute("font-style", run.fontStyle);
    if (run.letterSpacing) text.setAttribute("letter-spacing", run.letterSpacing);
    if (run.textDecoration) text.setAttribute("text-decoration", run.textDecoration);
    text.textContent = run.text;
    group.append(text);
  }
  return group;
}
