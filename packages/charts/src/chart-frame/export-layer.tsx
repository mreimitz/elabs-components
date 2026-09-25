/**
 * ChartFrame — the export layer (RM-117).
 *
 * A chart's `<svg>` holds only its marks. Axis tick labels and titles,
 * legends, keys, the frame's title, description, notes and footer are HTML
 * laid over or around it; some charts paint more than one `<svg>` (overlays,
 * small-multiple panels, funnel stages, legend markers) or draw their marks on
 * a `<canvas>`. An export of the chart `<svg>` alone loses all of them. This
 * module turns everything else painted inside the export box into an SVG twin,
 * in two steps:
 *
 * 1. {@link measureChartExportLayer} reads the rendered geometry ONCE, at
 *    export time, into a plain data model ({@link ChartExportLayerModel}):
 *    one text run per painted line (text, box, resolved font and ink), one
 *    swatch per painted HTML box (a legend dot, a colour chip, a tag's fill,
 *    a border, a gradient ramp), one graphic per other `<svg>` / `<canvas>` /
 *    `<img>`, and the chart `<svg>`'s own box. Every value is a resolved
 *    computed style — never a `var(--…)` — and every coordinate is rounded to
 *    1/100 px so the same layout yields the same model.
 * 2. {@link renderChartExportLayer} (and {@link renderChartExportUnderlay}
 *    for what paints beneath the chart) is a pure function of that model: it
 *    builds `<rect>`/`<path>` swatches, nested `<svg>`/`<image>` graphics and
 *    `<text>` runs. No DOM reads, no screenshot.
 *
 * The walk follows what the browser paints: open shadow roots (NumberFlow
 * draws a KPI's digits in one), CSS `transform` AND the separate `rotate`/
 * `scale` properties (Tailwind v4's `rotate-*`), opacity multiplied down the
 * tree, and `overflow` clipping (a truncated label is cut where the page cuts
 * it, with its ellipsis). Boxes and graphics keep their stacking order
 * relative to the chart `<svg>`: what paints beneath it lands in the underlay.
 *
 * What is skipped: the chart `<svg>` itself (the chart clone already holds
 * it), visually hidden text (`sr-only` restatements), hidden or transparent
 * elements, form fields, controls and transient surfaces (`role="toolbar"`/
 * `"menu"`/`"tooltip"`/`"dialog"`), and any subtree marked
 * `data-chart-export="exclude"` (the frame's toolbar, tooltips, zoom buttons,
 * the footer's action links — "Get the data" is a control, not part of the
 * picture).
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
  /**
   * The line's left edge — its centre when `rotate` is set or `anchor` is
   * `"middle"`, its right edge when `anchor` is `"end"`.
   */
  x: number;
  /** Vertical centre of the line (drawn with `dominant-baseline="central"`). */
  y: number;
  /** Degrees, clockwise — a rotated tick label. Drawn centred on `x, y`. */
  rotate?: number;
  /**
   * Centred or end-aligned text keeps that alignment, so a viewer whose font
   * runs wider or narrower than the page's shifts the line the way the page
   * would, not away from its axis.
   */
  anchor?: "middle" | "end";
  fill: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  fontStyle: string;
  letterSpacing?: string;
  textDecoration?: string;
  /** `font-variant-numeric` when not `normal` — `tabular-nums` figures keep their width. */
  fontVariantNumeric?: string;
  /** `font-feature-settings` when not `normal`. */
  fontFeatureSettings?: string;
  /** Effective opacity (the element's times every ancestor's), when below 1. */
  opacity?: number;
  /** Index into {@link ChartExportLayerModel.clips}: the run is cut to that box. */
  clip?: number;
}

/** A CSS `linear-gradient` background, as an SVG gradient line in export coordinates. */
export interface ChartExportGradient {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** `offset` is 0–1 along the line. */
  stops: { offset: number; color: string }[];
  /** `repeating-linear-gradient`: the stops repeat along the line (a hatch). */
  repeat?: boolean;
}

/**
 * One painted HTML box (a legend dot, an `InlineChip`, a tag's fill, one side
 * of a border, a gradient ramp), in export coordinates.
 */
export interface ChartExportSwatch {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Resolved fill; `"none"` for an outline-only box or a gradient layer. */
  fill: string;
  radius: number;
  /** Per-corner radii (top-left, top-right, bottom-right, bottom-left) when they differ. */
  radii?: [number, number, number, number];
  /** A gradient background layer, painted instead of `fill`. */
  gradient?: ChartExportGradient;
  /** A border drawn on the box's inner edge (a hollow ring marker). */
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  /** SVG transform — a rotated box (a `rotate-45` diamond) turns about its own centre. */
  transform?: string;
  /** Effective opacity, when below 1. */
  opacity?: number;
  /** Paints beneath the chart `<svg>`. */
  under?: boolean;
  /** Paint order among the layer's swatches and graphics. */
  order?: number;
  /** Index into {@link ChartExportLayerModel.clips}. */
  clip?: number;
}

/**
 * One painted picture other than the chart `<svg>` — another inline `<svg>`
 * (an overlay, a legend marker, a small-multiple panel, a funnel stage) or a
 * bitmap (`<canvas>`, `<img>`) — in export coordinates.
 */
export interface ChartExportGraphic {
  kind: "svg" | "image";
  x: number;
  y: number;
  width: number;
  height: number;
  /** `svg`: standalone markup with every computed style inlined; `image`: a `data:` URL. */
  content: string;
  /** SVG transform — a rotated graphic turns about its own centre. */
  transform?: string;
  /** Effective opacity, when below 1. */
  opacity?: number;
  /** Paints beneath the chart `<svg>`. */
  under?: boolean;
  /** Paint order among the layer's swatches and graphics. */
  order?: number;
  /** Index into {@link ChartExportLayerModel.clips}. */
  clip?: number;
}

/** A clipping box (an `overflow: hidden` ancestor), in export coordinates. */
export interface ChartExportClip {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Everything the export layer paints, measured once. */
export interface ChartExportLayerModel {
  /** The export canvas: the measured box's CSS size. */
  width: number;
  height: number;
  /**
   * Where the chart `<svg>` sits inside the canvas; `clip` indexes
   * {@link ChartExportLayerModel.clips} when a scroll or overflow ancestor
   * cuts it on the page.
   */
  chart: { x: number; y: number; width: number; height: number; clip?: number };
  runs: ChartExportTextRun[];
  swatches: ChartExportSwatch[];
  /** Other `<svg>`s and bitmaps painted inside the box. */
  graphics?: ChartExportGraphic[];
  /** Clipping boxes the runs, swatches and graphics refer to by index. */
  clips?: ChartExportClip[];
  /**
   * Set only when the layer was measured against the `<svg>`'s own box (no
   * `box` option — a dashboard part): the SVG `transform` that maps the
   * measured CSS pixels into the svg's user space (its `viewBox` units), so
   * `buildExportSvg` can add the layer inside the clone without touching the
   * part's size, viewBox or marks.
   */
  userSpace?: string;
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

/** Two decimals; `+ 0` turns a `-0` (a gradient line through the origin) into `0`. */
const round = (n: number) => Math.round(n * 100) / 100 + 0;

// ── Standalone SVG markup ────────────────────────────────────────────────────

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

/**
 * Class-driven text and stroke styling, inlined only when it differs from the
 * property's initial value (or the element already names it) — so a file
 * doesn't carry a dozen defaults on every node. The flag marks properties that
 * are CSS-only (no SVG presentation attribute): those go in `style` alone.
 */
const INLINED_WHEN_SET: ReadonlyArray<
  readonly [property: string, initial: string, cssOnly?: true]
> = [
  ["font-style", "normal"],
  ["text-anchor", "start"],
  ["dominant-baseline", "auto"],
  ["paint-order", "normal"],
  ["stroke-dasharray", "none"],
  ["stroke-linecap", "butt"],
  ["stroke-linejoin", "miter"],
  ["visibility", "visible"],
  ["font-variant-numeric", "normal", true],
  ["font-feature-settings", "normal", true],
];

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
 * Anything else still naming a `var(--…)` — an inline `filter:
 * drop-shadow(… var(--chart-1))`, a `stroke-dasharray="var(--dash)"` — is
 * replaced by its computed value; a class-hidden element (`display: none`)
 * stays hidden; class-driven `text-transform` is applied to the text itself.
 *
 * Also strips `transition`/`animation` from the inline `style` — motion has
 * no place in a static export, and this repo's own timing tokens
 * (`var(--t-fast)`, `var(--ease-standard)`) are exactly the kind of
 * incidental `var(--…)` a colour-focused walk would otherwise miss.
 */
export function inlineComputedStyles(source: Element, clone: Element): void {
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
    for (const [prop, initial, cssOnly] of INLINED_WHEN_SET) {
      const value = computed.getPropertyValue(prop);
      if (!value || (value === initial && !cloneEl.hasAttribute(prop))) continue;
      if (!cssOnly) cloneEl.setAttribute(prop, value);
      style.setProperty(prop, value);
    }
    if (computed.display === "none") style.setProperty("display", "none");
    style.removeProperty("transition");
    style.removeProperty("animation");

    // Whatever still names a custom property resolves to its computed value.
    for (const attr of [...cloneEl.attributes]) {
      if (attr.name === "style" || !attr.value.includes("var(")) continue;
      const value = computed.getPropertyValue(attr.name);
      if (value) cloneEl.setAttribute(attr.name, value);
      else cloneEl.removeAttribute(attr.name);
    }
    const unresolved: string[] = [];
    for (let i = 0; i < style.length; i++) {
      const prop = style.item(i);
      if (style.getPropertyValue(prop).includes("var(")) unresolved.push(prop);
    }
    for (const prop of unresolved) {
      const value = computed.getPropertyValue(prop);
      if (value && !value.includes("var(")) style.setProperty(prop, value);
      else style.removeProperty(prop);
    }

    const textTransform = computed.textTransform;
    if (textTransform === "uppercase" || textTransform === "lowercase") {
      for (const child of cloneEl.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          child.textContent = transformText(child.textContent ?? "", textTransform);
        }
      }
    }
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

/**
 * Characters XML 1.0 forbids (C0 controls other than tab/LF/CR, lone
 * surrogates, U+FFFE/U+FFFF), which the DOM happily holds — a process map's
 * edge ids join activity names with U+0001. One of them anywhere makes the
 * whole file malformed: an SVG viewer refuses it and a PNG never rasterises.
 */
const XML_ILLEGAL =
  // eslint-disable-next-line no-control-regex -- matching control characters is the point.
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** Replaces every character XML 1.0 forbids with U+FFFD, so the markup always parses. */
export function sanitizeXml(markup: string): string {
  return markup.replace(XML_ILLEGAL, "\uFFFD");
}

// ── Measuring ────────────────────────────────────────────────────────────────

/** The run role a `data-slot` names, or `undefined` when it names none. */
function slotRole(slot: string): ChartExportRole | undefined {
  if (slot.includes("axis-title")) return "axis-title";
  if (slot.includes("axis")) return "tick";
  if (slot.includes("legend") || slot.includes("key")) return "legend";
  if (slot === "chart-frame-notes") return "notes";
  if (slot.includes("footer") || slot.includes("source")) return "footer";
  if (slot === "card-title" || slot === "chart-frame-title") return "title";
  if (slot === "card-description" || slot === "chart-frame-description") return "description";
  return undefined;
}

/** Roles whose subtree is a control or a transient surface, never part of the picture. */
const CONTROL_ROLES = new Set(["toolbar", "menu", "menubar", "tooltip", "dialog", "alertdialog"]);

/**
 * The frame's own action row, known by slot: its DOM is pinned by the RM-072
 * byte-identical snapshot, so it carries no `data-chart-export` marker.
 */
const CONTROL_SLOTS = new Set(["chart-frame-actions", "chart-frame-selection-divider"]);

/** Form fields: an open editor (a range bubble being typed into) is a control, not the picture. */
const FORM_FIELDS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function transformText(text: string, transform: string): string {
  if (transform === "uppercase") return text.toUpperCase();
  if (transform === "lowercase") return text.toLowerCase();
  return text;
}

/** Collapses source whitespace (line breaks, indentation) the page collapses too; keeps no-break spaces. */
const collapse = (text: string) => text.replaceAll(/[\t\n\f\r ]+/g, " ").trim();

const px = (value: string) => Number.parseFloat(value) || 0;

/** True when a resolved colour paints anything at all. */
export function paints(color: string): boolean {
  if (!color || color === "transparent") return false;
  // A zero alpha after a slash: `oklch(… / 0)`, `color(… / 0%)`, `rgb(0 0 0 / 0)`.
  if (/\/\s*0(\.0+)?%?\s*\)$/.test(color)) return false;
  // In the comma form only a FOURTH argument is alpha — `rgb(255, 0, 0)` ends in blue.
  return !/^(rgba?|hsla?)\((?:[^,()]*,){3}\s*0(\.0+)?%?\s*\)$/.test(color);
}

/** The children an element renders: its open shadow tree, a slot's assigned nodes, else its own. */
function renderedChildren(node: Node): Node[] {
  if (node instanceof Element && node.shadowRoot) return [...node.shadowRoot.childNodes];
  if (typeof HTMLSlotElement !== "undefined" && node instanceof HTMLSlotElement) {
    const assigned = node.assignedNodes({ flatten: true });
    return assigned.length > 0 ? assigned : [...node.childNodes];
  }
  return [...node.childNodes];
}

const ANGLE_UNITS: Record<string, number> = { deg: 1, rad: 180 / Math.PI, grad: 0.9, turn: 360 };

function parseAngle(token: string): number | undefined {
  const m = /^(-?[\d.]+(?:e-?\d+)?)(deg|rad|grad|turn)?$/.exec(token.trim());
  if (!m) return undefined;
  return Number.parseFloat(m[1]!) * ANGLE_UNITS[m[2] ?? "deg"]!;
}

/**
 * An element's own 2-D transform: its `transform` matrix composed after the
 * separate `rotate` and `scale` properties (the CSS order is translate,
 * rotate, scale, transform — translation is irrelevant here: positions come
 * from the rendered boxes, only the turn and the size of the glyphs don't).
 */
function ownTransform(style: CSSStyleDeclaration): DOMMatrix | undefined {
  let m: DOMMatrix | undefined;
  const rotate = style.rotate;
  if (rotate && rotate !== "none") {
    const tokens = rotate.trim().split(/\s+/);
    const angle = parseAngle(tokens.at(-1) ?? "");
    const axis = tokens.slice(0, -1).join(" ");
    const sign = axis === "" || axis === "z" || axis === "0 0 1" ? 1 : axis === "0 0 -1" ? -1 : 0;
    if (angle && sign) m = new DOMMatrix().rotate(sign * angle);
  }
  const scale = style.scale;
  if (scale && scale !== "none") {
    const [sx, sy] = scale
      .trim()
      .split(/\s+/)
      .map((v) => (v.endsWith("%") ? px(v) / 100 : px(v)));
    if (sx !== undefined) m = (m ?? new DOMMatrix()).scale(sx, sy ?? sx);
  }
  const transform = style.transform;
  if (transform && transform !== "none") {
    try {
      m = (m ?? new DOMMatrix()).multiply(new DOMMatrix(transform));
    } catch {
      // An unparsable matrix leaves the element as laid out.
    }
  }
  return m;
}

/** The accumulated in-plane rotation (degrees, clockwise) of a matrix. */
const rotationOf = (m: DOMMatrix | undefined) => (m ? (Math.atan2(m.b, m.a) * 180) / Math.PI : 0);

/** The accumulated uniform scale of a matrix (the square root of its area factor). */
const scaleOf = (m: DOMMatrix | undefined) =>
  m ? Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1 : 1;

type Rect = { left: number; top: number; right: number; bottom: number };

function intersect(a: Rect, b: Rect): Rect | undefined {
  const r = {
    left: Math.max(a.left, b.left),
    top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom),
  };
  return r.right > r.left && r.bottom > r.top ? r : undefined;
}

/** True when `outer` holds all of `inner` (half a pixel of slack for rounding). */
const covers = (outer: Rect, inner: Rect) =>
  inner.left >= outer.left - 0.5 &&
  inner.right <= outer.right + 0.5 &&
  inner.top >= outer.top - 0.5 &&
  inner.bottom <= outer.bottom + 0.5;

/** True for a visually-hidden restatement (`sr-only`) or an element that paints nothing. */
function isVisuallyHidden(el: Element, style: CSSStyleDeclaration): boolean {
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return true;
  }
  if (style.visibility === "collapse") return true;
  if (style.position !== "absolute" && style.position !== "fixed") return false;
  // `sr-only`: `clip-path: inset(50%)` (Tailwind v4) or `clip: rect(0 0 0 0)`, else a 1 × 1
  // clipped box. The layout size, not the bounding box — under a rotated ancestor
  // a 1 × 1 box measures 1.41 × 1.41.
  if (
    style.clipPath === "inset(50%)" ||
    /^rect\(0(px)?,? 0(px)?,? 0(px)?,? 0(px)?\)$/.test(style.clip)
  ) {
    return true;
  }
  const html = el as HTMLElement;
  const width =
    typeof html.offsetWidth === "number" ? html.offsetWidth : el.getBoundingClientRect().width;
  const height =
    typeof html.offsetHeight === "number" ? html.offsetHeight : el.getBoundingClientRect().height;
  return width <= 1 && height <= 1 && style.overflow !== "visible";
}

/** Splits a CSS value list on `separator`, ignoring separators inside parentheses. */
function splitTopLevel(value: string, separator: "," | " "): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of value) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (depth === 0 && (separator === " " ? /\s/.test(ch) : ch === separator)) {
      if (current.trim()) parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** The CSS gradient-line angle (degrees) a `to <side-or-corner>` keyword names on a w × h box. */
function directionAngle(keyword: string, w: number, h: number): number | undefined {
  const words = keyword
    .replace(/^to\s+/, "")
    .split(/\s+/)
    .sort()
    .join(" ");
  const corner = (Math.atan2(h, w) * 180) / Math.PI;
  const table: Record<string, number> = {
    top: 0,
    right: 90,
    bottom: 180,
    left: 270,
    "right top": corner,
    "bottom right": 180 - corner,
    "bottom left": 180 + corner,
    "left top": 360 - corner,
  };
  return table[words];
}

/**
 * One `linear-gradient`/`repeating-linear-gradient` background layer on a box
 * (`x, y, w, h` in export coordinates) as an SVG gradient line, or
 * `undefined` for any other image (a radial gradient, a `url()`).
 */
export function parseLinearGradient(
  layer: string,
  x: number,
  y: number,
  w: number,
  h: number,
): ChartExportGradient | undefined {
  const m = /^(repeating-)?linear-gradient\((.*)\)$/s.exec(layer.trim());
  if (!m) return undefined;
  const args = splitTopLevel(m[2]!, ",");
  let angle = 180;
  const first = args[0] ?? "";
  const config = first.replace(
    /\s*\bin\s+[\w-]+(\s+(shorter|longer|increasing|decreasing)\s+hue)?$/,
    "",
  );
  if (/^to\s/.test(config)) {
    angle = directionAngle(config, w, h) ?? 180;
    args.shift();
  } else if (parseAngle(config) !== undefined && !/^[\d.]+$/.test(config)) {
    angle = parseAngle(config)!;
    args.shift();
  } else if (/^in\s/.test(first)) {
    args.shift();
  }
  const rad = (angle * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const length = Math.abs(w * dx) + Math.abs(h * dy);
  if (length <= 0) return undefined;

  const stops: { color: string; at?: number }[] = [];
  for (const arg of args) {
    const tokens = splitTopLevel(arg, " ");
    const positions: number[] = [];
    while (tokens.length > 1 && /^-?[\d.]+(%|px)?$/.test(tokens.at(-1)!)) {
      const token = tokens.pop()!;
      positions.unshift(token.endsWith("%") ? (px(token) / 100) * length : px(token));
    }
    const color = tokens.join(" ");
    // A lone position is an interpolation hint; the SVG twin interpolates linearly.
    if (!color || /^-?[\d.]+(%|px)?$/.test(color)) continue;
    if (positions.length === 0) stops.push({ color });
    for (const at of positions) stops.push({ color, at });
  }
  if (stops.length === 0) return undefined;
  // CSS stop fix-up: first 0, last the line's end, never backwards, gaps evenly spread.
  if (stops[0]!.at === undefined) stops[0]!.at = 0;
  if (stops.at(-1)!.at === undefined) stops.at(-1)!.at = length;
  let max = stops[0]!.at!;
  for (const stop of stops) {
    if (stop.at !== undefined) stop.at = max = Math.max(max, stop.at);
  }
  for (let i = 1; i < stops.length; i++) {
    if (stops[i]!.at !== undefined) continue;
    let j = i;
    while (stops[j]!.at === undefined) j++;
    const from = stops[i - 1]!.at!;
    const step = (stops[j]!.at! - from) / (j - i + 1);
    for (let k = i; k < j; k++) stops[k]!.at = from + step * (k - i + 1);
  }

  const cx = x + w / 2;
  const cy = y + h / 2;
  const startX = cx - (dx * length) / 2;
  const startY = cy - (dy * length) / 2;
  const repeat = Boolean(m[1]);
  const from = repeat ? stops[0]!.at! : 0;
  const to = repeat ? stops.at(-1)!.at! : length;
  const span = to - from;
  if (span <= 0)
    return { x1: x, y1: y, x2: x + w, y2: y, stops: [{ offset: 0, color: stops.at(-1)!.color }] };
  return {
    x1: round(startX + dx * from),
    y1: round(startY + dy * from),
    x2: round(startX + dx * to),
    y2: round(startY + dy * to),
    stops: stops.map((s) => ({
      offset: round(Math.min(1, Math.max(0, (s.at! - from) / span)) * 10_000) / 10_000,
      color: s.color,
    })),
    ...(repeat ? { repeat: true } : {}),
  };
}

/**
 * The style-inlined clone behind each measured `svg` graphic. Rendering copies
 * it rather than re-parsing `content`: `DOMParser` is a Trusted Types sink, so
 * under `require-trusted-types-for 'script'` a parse throws and the export
 * with it. `content` stays the serialisable record (and feeds the ids' hash).
 */
const graphicClones = new WeakMap<ChartExportGraphic, SVGSVGElement>();

/** A self-contained clone of another inline `<svg>`: computed styles inlined, sized to its box. */
function svgGraphicClone(
  svg: SVGSVGElement,
  width: number,
  height: number,
  layoutWidth: number,
  layoutHeight: number,
): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  inlineComputedStyles(svg, clone);
  clone.setAttribute("xmlns", SVG_NS);
  // Its own user space stays what the page drew it in; only its box scales.
  if (!clone.hasAttribute("viewBox")) {
    clone.setAttribute("viewBox", `0 0 ${round(layoutWidth)} ${round(layoutHeight)}`);
    clone.setAttribute("preserveAspectRatio", "none");
  }
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.removeAttribute("aria-hidden");
  clone.removeAttribute("x");
  clone.removeAttribute("y");
  // The graphic's opacity folds in its own and every ancestor's; an inline
  // `opacity` left here would beat that attribute.
  clone.removeAttribute("opacity");
  for (const prop of [
    "transform",
    "translate",
    "rotate",
    "scale",
    "position",
    "inset",
    "opacity",
  ]) {
    clone.style.removeProperty(prop);
  }
  if (window.getComputedStyle(svg).overflow === "visible")
    clone.setAttribute("overflow", "visible");
  return clone;
}

/** A bitmap's pixels as a `data:` URL, or `undefined` when they cannot be read (tainted, empty). */
function bitmapDataUrl(el: HTMLCanvasElement | HTMLImageElement): string | undefined {
  try {
    if (el instanceof HTMLCanvasElement) {
      if (el.width === 0 || el.height === 0) return undefined;
      return el.toDataURL("image/png");
    }
    if (!el.complete || el.naturalWidth === 0) return undefined;
    if (el.currentSrc.startsWith("data:")) return el.currentSrc;
    const canvas = document.createElement("canvas");
    canvas.width = el.naturalWidth;
    canvas.height = el.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    ctx.drawImage(el, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    // A cross-origin bitmap taints its canvas; the export goes without it.
    return undefined;
  }
}

let ellipsisContext: CanvasRenderingContext2D | null | undefined;

/** The width of `…` in an element's font (a 0.8 em estimate without a canvas). */
function ellipsisWidth(style: CSSStyleDeclaration): number {
  if (ellipsisContext === undefined) {
    try {
      ellipsisContext = document.createElement("canvas").getContext("2d");
    } catch {
      ellipsisContext = null;
    }
  }
  if (ellipsisContext) {
    ellipsisContext.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const width = ellipsisContext.measureText("…").width;
    if (width > 0) return width;
  }
  return px(style.fontSize) * 0.8;
}

/**
 * How a line keeps its alignment: from `text-align`, from a flex container
 * that centres or end-aligns its text, or from a `-translate-x-1/2` label.
 */
function anchorOf(el: Element, style: CSSStyleDeclaration): ChartExportTextRun["anchor"] {
  const rtl = style.direction === "rtl";
  const align = style.textAlign;
  if (align === "center" || align === "-webkit-center") return "middle";
  if (align === "right" || (align === "end" && !rtl) || (align === "start" && rtl)) return "end";
  if (align === "justify") return undefined;
  if (style.display === "flex" || style.display === "inline-flex") {
    const row = !style.flexDirection.startsWith("column");
    const main = row ? style.justifyContent : style.alignItems;
    if (main === "center") return "middle";
    if (main === "flex-end" || main === "end" || main === "right") return rtl ? undefined : "end";
  }
  const translate = style.translate;
  if (translate && translate !== "none" && /^-50%/.test(translate.trim())) return "middle";
  const html = el as HTMLElement;
  if (style.transform && style.transform !== "none" && html.offsetWidth > 0) {
    const m = /^matrix\(([^)]+)\)$/.exec(style.transform);
    const e = m ? Number.parseFloat(m[1]!.split(",")[4] ?? "0") : 0;
    if (Math.abs(e + html.offsetWidth / 2) < 0.75) return "middle";
  }
  return undefined;
}

/** What a descendant inherits from its painted ancestors while the layer walks down. */
interface WalkContext {
  role: ChartExportRole;
  /** Product of every ancestor's computed opacity. */
  opacity: number;
  /** Every ancestor's transform, composed (rotation and scale only). */
  matrix: DOMMatrix | undefined;
  /** The intersection of every clipping ancestor, in client coordinates. */
  clip: { rect: Rect; ellipsis: boolean } | undefined;
  /** Stacking: the nearest positioned ancestor's `z-index` (0 for `auto`). */
  z: number;
  /** 1 inside a positioned ancestor — painted after in-flow content at the same `z`. */
  positioned: number;
}

type PaintKey = readonly [z: number, positioned: number, sequence: number];

const compareKeys = (a: PaintKey, b: PaintKey) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/**
 * Reads every painted HTML text line, HTML box, extra `<svg>` and bitmap
 * inside `scope` into a model, in coordinates relative to `options.box`
 * (default: the `<svg>`). Call it at export time only — it reads layout.
 */
export function measureChartExportLayer(
  scope: Element,
  options: MeasureChartExportLayerOptions,
): ChartExportLayerModel {
  const chartSvg = options.svg;
  const boxEl = options.box ?? chartSvg;
  const origin = boxEl.getBoundingClientRect();
  const svgRect = chartSvg.getBoundingClientRect();
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

  const range = document.createRange();
  // No layout engine (jsdom): nothing is painted, so there is nothing to measure.
  if (typeof range.getBoundingClientRect !== "function") return model;
  if (!options.box) {
    const ctm = chartSvg.getScreenCTM();
    if (ctm) {
      // `getScreenCTM()` is an SVGMatrix in Chromium; copy it into a DOMMatrix.
      const m = new DOMMatrix([ctm.a, ctm.b, ctm.c, ctm.d, ctm.e, ctm.f])
        .inverse()
        .translate(origin.left, origin.top);
      const n = (v: number) => Number(v.toFixed(5));
      model.userSpace = `matrix(${[m.a, m.b, m.c, m.d, m.e, m.f].map(n).join(" ")})`;
    }
  }

  const canvas: Rect = {
    left: origin.left,
    top: origin.top,
    right: origin.left + origin.width,
    bottom: origin.top + origin.height,
  };
  const visibleArea = (context: WalkContext) =>
    context.clip ? intersect(context.clip.rect, canvas) : canvas;

  const clips: ChartExportClip[] = [];
  const clipIndex = new Map<string, number>();
  /** The clip an item needs — only when its box pokes out of the clipping ancestor. */
  const clipFor = (rect: Rect, context: WalkContext): { clip?: number } => {
    if (!context.clip || covers(context.clip.rect, rect)) return {};
    const r = context.clip.rect;
    const clip = {
      x: round(r.left - origin.left),
      y: round(r.top - origin.top),
      width: round(r.right - r.left),
      height: round(r.bottom - r.top),
    };
    const key = `${clip.x},${clip.y},${clip.width},${clip.height}`;
    let index = clipIndex.get(key);
    if (index === undefined) {
      index = clips.length;
      clips.push(clip);
      clipIndex.set(key, index);
    }
    return { clip: index };
  };
  const alpha = (opacity: number) => (opacity < 0.999 ? { opacity: round(opacity) } : {});

  let sequence = 0;
  let chartKey: PaintKey | undefined;
  const shapes: { key: PaintKey; item: ChartExportSwatch | ChartExportGraphic }[] = [];
  const graphics: ChartExportGraphic[] = [];

  /**
   * The unrotated box an element paints, in export coordinates: its client
   * rect, or — turned by a transform — its layout size (scaled) about the
   * rect's centre plus the turn as an SVG transform.
   */
  const geometry = (el: Element, rect: DOMRect, matrix: DOMMatrix | undefined) => {
    const angle = rotationOf(matrix);
    if (Math.abs(angle) < 0.01) {
      return {
        x: round(rect.left - origin.left),
        y: round(rect.top - origin.top),
        width: round(rect.width),
        height: round(rect.height),
      };
    }
    const s = scaleOf(matrix);
    const html = el as HTMLElement;
    const layoutWidth =
      (typeof html.offsetWidth === "number"
        ? html.offsetWidth
        : (el as SVGSVGElement).clientWidth) || 0;
    const layoutHeight =
      (typeof html.offsetHeight === "number"
        ? html.offsetHeight
        : (el as SVGSVGElement).clientHeight) || 0;
    const width = layoutWidth * s || rect.width;
    const height = layoutHeight * s || rect.height;
    const cx = (rect.left + rect.right) / 2 - origin.left;
    const cy = (rect.top + rect.bottom) / 2 - origin.top;
    return {
      x: round(cx - width / 2),
      y: round(cy - height / 2),
      width: round(width),
      height: round(height),
      transform: `rotate(${round(angle)} ${round(cx)} ${round(cy)})`,
    };
  };

  /** The element's painted fill, gradient layers and borders as swatches. */
  const pushBoxes = (
    el: Element,
    style: CSSStyleDeclaration,
    rect: DOMRect,
    context: WalkContext,
    key: PaintKey,
  ) => {
    const s = scaleOf(context.matrix);
    const fill = style.backgroundColor;
    const hasFill = paints(fill);
    const images =
      style.backgroundImage && style.backgroundImage !== "none"
        ? splitTopLevel(style.backgroundImage, ",")
        : [];
    const sides = (["top", "right", "bottom", "left"] as const).map((side) => {
      const width = px(style.getPropertyValue(`border-${side}-width`)) * s;
      const lineStyle = style.getPropertyValue(`border-${side}-style`);
      const color = style.getPropertyValue(`border-${side}-color`);
      return width > 0 && lineStyle !== "none" && lineStyle !== "hidden" && paints(color)
        ? { width, color, lineStyle }
        : undefined;
    });
    if (!hasFill && images.length === 0 && sides.every((side) => !side)) return;

    const box = geometry(el, rect, context.matrix);
    const common = {
      ...(box.transform ? { transform: box.transform } : {}),
      ...alpha(context.opacity),
      ...clipFor(rect, context),
    };
    const push = (swatch: ChartExportSwatch) => shapes.push({ key, item: swatch });

    // Corner radii: CSS shrinks them all by one factor when neighbours overlap.
    const corner = (name: string) => px(style.getPropertyValue(`border-${name}-radius`)) * s;
    let radii = [
      corner("top-left"),
      corner("top-right"),
      corner("bottom-right"),
      corner("bottom-left"),
    ] as [number, number, number, number];
    const [tl, tr, br, bl] = radii;
    const f = Math.min(
      1,
      box.width / (tl + tr || 1),
      box.width / (bl + br || 1),
      box.height / (tl + bl || 1),
      box.height / (tr + br || 1),
    );
    radii = radii.map((r) => round(r * f)) as typeof radii;
    const inset = (by: number): Pick<ChartExportSwatch, "radius" | "radii"> => {
      const shrunk = radii.map((r) => round(Math.max(0, r - by))) as typeof radii;
      return shrunk.every((r) => r === shrunk[0])
        ? { radius: shrunk[0] }
        : { radius: shrunk[0], radii: shrunk };
    };

    if (hasFill) push({ ...box, fill, ...inset(0), ...common });
    // Background layers paint bottom-up: the last listed is the lowest.
    for (const image of [...images].reverse()) {
      const gradient = parseLinearGradient(image, box.x, box.y, box.width, box.height);
      if (gradient) push({ ...box, fill: "none", gradient, ...inset(0), ...common });
    }

    const drawn = sides.filter(Boolean) as NonNullable<(typeof sides)[number]>[];
    if (drawn.length === 0) return;
    const same = (a: (typeof drawn)[number], b: (typeof drawn)[number]) =>
      a.width === b.width && a.color === b.color && a.lineStyle === b.lineStyle;
    // The border most sides share becomes one stroke on the (rounded) box; the
    // odd sides out — an accent rail, a divider — are strips on top of it.
    const shared = drawn.find((side) => drawn.filter((other) => same(side, other)).length >= 3);
    if (shared) {
      const half = shared.width / 2;
      push({
        x: round(box.x + half),
        y: round(box.y + half),
        width: round(Math.max(0, box.width - shared.width)),
        height: round(Math.max(0, box.height - shared.width)),
        fill: "none",
        ...inset(half),
        stroke: shared.color,
        strokeWidth: round(shared.width),
        ...(shared.lineStyle === "dashed"
          ? { strokeDasharray: `${round(shared.width * 3)} ${round(shared.width * 2)}` }
          : shared.lineStyle === "dotted"
            ? { strokeDasharray: `${round(shared.width)} ${round(shared.width)}` }
            : {}),
        ...common,
      });
    }
    const [top, right, bottom, left] = sides;
    const strips = [
      top && { ...box, height: round(top.width), fill: top.color, side: top },
      right && {
        ...box,
        x: round(box.x + box.width - right.width),
        width: round(right.width),
        fill: right.color,
        side: right,
      },
      bottom && {
        ...box,
        y: round(box.y + box.height - bottom.width),
        height: round(bottom.width),
        fill: bottom.color,
        side: bottom,
      },
      left && { ...box, width: round(left.width), fill: left.color, side: left },
    ];
    for (const strip of strips) {
      if (!strip || (shared && same(strip.side, shared))) continue;
      const { side: _side, transform: _transform, ...geometryOnly } = strip;
      push({ ...geometryOnly, radius: 0, ...common });
    }
  };

  const pushGraphic = (
    el: Element,
    kind: ChartExportGraphic["kind"],
    rect: DOMRect,
    context: WalkContext,
    key: PaintKey,
  ) => {
    const box = geometry(el, rect, context.matrix);
    let content: string | undefined;
    let clone: SVGSVGElement | undefined;
    if (kind === "svg") {
      const svg = el as SVGSVGElement;
      const s = scaleOf(context.matrix);
      const layoutWidth = svg.clientWidth || rect.width / s;
      const layoutHeight = svg.clientHeight || rect.height / s;
      clone = svgGraphicClone(svg, box.width, box.height, layoutWidth, layoutHeight);
      content = sanitizeXml(new XMLSerializer().serializeToString(clone));
    } else {
      content = bitmapDataUrl(el as HTMLCanvasElement | HTMLImageElement);
    }
    if (!content) return;
    const graphic: ChartExportGraphic = {
      kind,
      ...box,
      content,
      ...alpha(context.opacity),
      ...clipFor(rect, context),
    };
    if (clone) graphicClones.set(graphic, clone);
    graphics.push(graphic);
    shapes.push({ key, item: graphic });
  };

  const pushText = (
    textNode: Text,
    context: WalkContext,
    style: CSSStyleDeclaration,
    el: Element,
  ) => {
    const data = textNode.data;
    if (!data.trim()) return;
    const visible = visibleArea(context);
    if (!visible) return;
    const s = scaleOf(context.matrix);
    const scaled = (value: string) => (s === 1 ? value : `${round(px(value) * s)}px`);
    const base = {
      role: context.role,
      fill: style.color,
      fontFamily: style.fontFamily,
      fontSize: scaled(style.fontSize),
      fontWeight: style.fontWeight,
      fontStyle: style.fontStyle,
      ...(style.letterSpacing && style.letterSpacing !== "normal"
        ? { letterSpacing: scaled(style.letterSpacing) }
        : {}),
      ...(style.textDecorationLine && style.textDecorationLine !== "none"
        ? { textDecoration: style.textDecorationLine }
        : {}),
      ...(style.fontVariantNumeric && style.fontVariantNumeric !== "normal"
        ? { fontVariantNumeric: style.fontVariantNumeric }
        : {}),
      ...(style.fontFeatureSettings && style.fontFeatureSettings !== "normal"
        ? { fontFeatureSettings: style.fontFeatureSettings }
        : {}),
      ...alpha(context.opacity),
    };

    const angle = round(rotationOf(context.matrix));
    if (Math.abs(angle) >= 0.01) {
      range.selectNodeContents(textNode);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      if (!intersect(rect, visible)) return;
      const text = collapse(transformText(data, style.textTransform));
      if (!text) return;
      model.runs.push({
        ...base,
        text,
        x: round((rect.left + rect.right) / 2 - origin.left),
        y: round((rect.top + rect.bottom) / 2 - origin.top),
        rotate: angle,
        ...clipFor(rect, context),
      });
      return;
    }

    // One piece per word — or per painted fragment of a word the browser broke
    // across lines (at a hyphen, `overflow-wrap`, or CJK with no spaces at all).
    type Piece = { start: number; end: number } & Rect;
    const pieces: Piece[] = [];
    const measure = (start: number, end: number) => {
      range.setStart(textNode, start);
      range.setEnd(textNode, end);
      return range.getBoundingClientRect();
    };
    for (const match of data.matchAll(/\S+/g)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      range.setStart(textNode, start);
      range.setEnd(textNode, end);
      const fragments = [...range.getClientRects()].filter((r) => r.width > 0 || r.height > 0);
      if (fragments.length === 0) continue;
      const tops = fragments.map((r) => r.top);
      const brokenAcrossLines = Math.max(...tops) - Math.min(...tops) > fragments[0]!.height / 2;
      if (!brokenAcrossLines) {
        const r = range.getBoundingClientRect();
        pieces.push({ start, end, left: r.left, right: r.right, top: r.top, bottom: r.bottom });
        continue;
      }
      let piece: Piece | undefined;
      for (const char of Array.from(match[0])) {
        const offset: number = piece ? piece.end : start;
        const r = measure(offset, offset + char.length);
        const mid = (r.top + r.bottom) / 2;
        if (piece && r.width === 0 && r.height === 0) {
          piece.end += char.length;
        } else if (piece && mid > piece.top && mid < piece.bottom) {
          piece.end += char.length;
          piece.right = Math.max(piece.right, r.right);
        } else {
          if (piece) pieces.push(piece);
          piece = {
            start: offset,
            end: offset + char.length,
            left: r.left,
            right: r.right,
            top: r.top,
            bottom: r.bottom,
          };
        }
      }
      if (piece) pieces.push(piece);
    }

    // One run per painted line: group the pieces by their line box.
    const lines: Piece[] = [];
    for (const piece of pieces) {
      const last = lines.at(-1);
      const mid = (piece.top + piece.bottom) / 2;
      if (last && mid > last.top && mid < last.bottom) {
        last.end = piece.end;
        last.left = Math.min(last.left, piece.left);
        last.right = Math.max(last.right, piece.right);
      } else {
        lines.push({ ...piece });
      }
    }
    const anchor = lines.length > 0 ? anchorOf(el, style) : undefined;
    for (const line of lines) {
      // A line poking past the canvas (a wide y tick) is cut by the canvas, never dropped.
      if (!intersect(line, visible)) continue;
      let text = collapse(transformText(data.slice(line.start, line.end), style.textTransform));
      let right = line.right;
      const clip = context.clip;
      if (clip?.ellipsis && line.right > clip.rect.right + 0.5) {
        // `text-overflow: ellipsis`: keep the characters that fit before the `…`.
        const limit = clip.rect.right - ellipsisWidth(style);
        let fit = line.start;
        let fitRight = line.left;
        for (let offset = line.start; offset < line.end; ) {
          const size = (data.codePointAt(offset) ?? 0) > 0xffff ? 2 : 1;
          const r = measure(offset, offset + size);
          if (r.right > limit) break;
          offset += size;
          fit = offset;
          if (r.width > 0) fitRight = r.right;
        }
        const kept = data.slice(line.start, fit);
        // The page keeps a space that fits before the `…` ("Revenue is …").
        const gap = /\s$/.test(kept) && kept.trim() ? " " : "";
        text = `${collapse(transformText(kept, style.textTransform))}${gap}…`;
        right = Math.min(clip.rect.right, fitRight + ellipsisWidth(style));
      }
      if (!text) continue;
      const x =
        anchor === "end" ? right : anchor === "middle" ? (line.left + right) / 2 : line.left;
      model.runs.push({
        ...base,
        text,
        x: round(x - origin.left),
        y: round((line.top + line.bottom) / 2 - origin.top),
        ...(anchor ? { anchor } : {}),
        ...clipFor({ left: line.left, right, top: line.top, bottom: line.bottom }, context),
      });
    }
  };

  const walk = (parent: Node, context: WalkContext, style: CSSStyleDeclaration, host: Element) => {
    for (const node of renderedChildren(parent)) {
      if (node.nodeType === Node.TEXT_NODE) {
        sequence++;
        pushText(node as Text, context, style, host);
        continue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const el = node as Element;
      const own = window.getComputedStyle(el);
      const positioned = own.position !== "static";
      const z =
        positioned && own.zIndex !== "auto" ? Number.parseInt(own.zIndex, 10) || 0 : context.z;
      const key: PaintKey = [z, positioned ? 1 : context.positioned, sequence++];
      if (el === chartSvg) {
        chartKey = key;
        // A chart wider or taller than its scroller shows only what scrolls into view.
        const { clip } = clipFor(el.getBoundingClientRect(), context);
        if (clip !== undefined) model.chart.clip = clip;
        continue;
      }
      if (el.getAttribute("data-chart-export") === "exclude") continue;
      if (CONTROL_ROLES.has(el.getAttribute("role") ?? "")) continue;
      if (CONTROL_SLOTS.has(el.getAttribute("data-slot") ?? "")) continue;
      if (FORM_FIELDS.has(el.tagName.toUpperCase())) continue;
      if (isVisuallyHidden(el, own)) continue;

      const opacity = context.opacity * (own.opacity === "" ? 1 : Number.parseFloat(own.opacity));
      const transform = ownTransform(own);
      const matrix = transform
        ? (context.matrix ?? new DOMMatrix()).multiply(transform)
        : context.matrix;
      const here: WalkContext = { ...context, opacity, matrix, z, positioned: key[1] };
      const rect = el.getBoundingClientRect();
      const area = visibleArea(here);
      const onCanvas = area && rect.width > 0 && rect.height > 0 && intersect(rect, area);

      if (el.namespaceURI === SVG_NS) {
        // Another top-level <svg> (an overlay, a legend marker, a panel). Its
        // own subtree comes along whole; nothing inside it is HTML to measure.
        if (el instanceof SVGSVGElement && onCanvas) pushGraphic(el, "svg", rect, here, key);
        continue;
      }
      if (el instanceof HTMLCanvasElement || el instanceof HTMLImageElement) {
        if (onCanvas) pushGraphic(el, "image", rect, here, key);
        continue;
      }
      if (onCanvas) pushBoxes(el, own, rect, here, key);

      const clips = own.overflowX !== "visible" || own.overflowY !== "visible";
      if (clips) {
        const inner: Rect = {
          left: rect.left + px(own.borderLeftWidth),
          top: rect.top + px(own.borderTopWidth),
          right: rect.right - px(own.borderRightWidth),
          bottom: rect.bottom - px(own.borderBottomWidth),
        };
        const clipped = here.clip ? intersect(here.clip.rect, inner) : inner;
        // Everything inside a clip that is off the canvas paints nothing.
        if (!clipped) continue;
        here.clip = { rect: clipped, ellipsis: own.textOverflow === "ellipsis" };
      }
      const slot = el.getAttribute("data-slot");
      here.role = (slot && slotRole(slot)) || context.role;
      walk(el, here, own, el);
    }
  };

  const scopeStyle = window.getComputedStyle(scope);
  const scopeSlot = scope.getAttribute("data-slot");
  walk(
    scope,
    {
      role: (scopeSlot && slotRole(scopeSlot)) || "label",
      opacity: 1,
      matrix: undefined,
      clip: undefined,
      z: 0,
      positioned: 0,
    },
    scopeStyle,
    scope,
  );
  range.detach();

  // Paint order: what stacks below the chart <svg> is its underlay; the rest
  // paints over it, each side in stacking order.
  shapes.sort((a, b) => compareKeys(a.key, b.key));
  shapes.forEach(({ key, item }, order) => {
    item.order = order;
    if (chartKey && compareKeys(key, chartKey) < 0) item.under = true;
  });
  model.swatches = shapes
    .map(({ item }) => item)
    .filter((item): item is ChartExportSwatch => !("kind" in item));
  if (graphics.length > 0) model.graphics = graphics;
  if (clips.length > 0) model.clips = clips;
  return model;
}

// ── Rendering ────────────────────────────────────────────────────────────────

/** FNV-1a over the model: a deterministic id prefix, distinct per export. */
function modelHash(model: ChartExportLayerModel): string {
  const text = JSON.stringify(model);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** Collects the `<defs>` a group needs (clip paths, gradients) under ids unique to it. */
class Defs {
  readonly element = document.createElementNS(SVG_NS, "defs");
  private readonly clipIds = new Map<number, string>();
  private gradients = 0;

  constructor(
    private readonly prefix: string,
    private readonly model: ChartExportLayerModel,
  ) {}

  clip(index: number): string | undefined {
    const known = this.clipIds.get(index);
    if (known) return known;
    const box = this.model.clips?.[index];
    if (!box) return undefined;
    const id = `${this.prefix}-clip-${index}`;
    const clipPath = document.createElementNS(SVG_NS, "clipPath");
    clipPath.setAttribute("id", id);
    const rect = document.createElementNS(SVG_NS, "rect");
    rect.setAttribute("x", String(box.x));
    rect.setAttribute("y", String(box.y));
    rect.setAttribute("width", String(box.width));
    rect.setAttribute("height", String(box.height));
    clipPath.append(rect);
    this.element.append(clipPath);
    this.clipIds.set(index, id);
    return id;
  }

  gradient(g: ChartExportGradient): string {
    const id = `${this.prefix}-paint-${this.gradients++}`;
    const gradient = document.createElementNS(SVG_NS, "linearGradient");
    gradient.setAttribute("id", id);
    gradient.setAttribute("gradientUnits", "userSpaceOnUse");
    gradient.setAttribute("x1", String(g.x1));
    gradient.setAttribute("y1", String(g.y1));
    gradient.setAttribute("x2", String(g.x2));
    gradient.setAttribute("y2", String(g.y2));
    if (g.repeat) gradient.setAttribute("spreadMethod", "repeat");
    for (const s of g.stops) {
      const stop = document.createElementNS(SVG_NS, "stop");
      stop.setAttribute("offset", String(s.offset));
      stop.setAttribute("stop-color", s.color);
      gradient.append(stop);
    }
    this.element.append(gradient);
    return id;
  }
}

function applyOpacity(el: Element, opacity: number | undefined) {
  if (opacity !== undefined) el.setAttribute("opacity", String(opacity));
}

/** Wraps `el` in a `<g>` cut to clip `index` — a group, so the clip ignores `el`'s own transform. */
function clipped(el: SVGElement, index: number | undefined, defs: Defs): SVGElement {
  const id = index === undefined ? undefined : defs.clip(index);
  if (!id) return el;
  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute("clip-path", `url(#${id})`);
  group.append(el);
  return group;
}

/** A rounded-rect path with a radius per corner (top-left, top-right, bottom-right, bottom-left). */
function roundedRectPath(
  x: number,
  y: number,
  w: number,
  h: number,
  [tl, tr, br, bl]: [number, number, number, number],
): string {
  const r = round;
  return [
    `M${r(x + tl)} ${r(y)}`,
    `H${r(x + w - tr)}`,
    tr ? `A${tr} ${tr} 0 0 1 ${r(x + w)} ${r(y + tr)}` : "",
    `V${r(y + h - br)}`,
    br ? `A${br} ${br} 0 0 1 ${r(x + w - br)} ${r(y + h)}` : "",
    `H${r(x + bl)}`,
    bl ? `A${bl} ${bl} 0 0 1 ${r(x)} ${r(y + h - bl)}` : "",
    `V${r(y + tl)}`,
    tl ? `A${tl} ${tl} 0 0 1 ${r(x + tl)} ${r(y)}` : "",
    "Z",
  ]
    .filter(Boolean)
    .join(" ");
}

function renderSwatch(s: ChartExportSwatch, defs: Defs): SVGElement {
  let shape: SVGElement;
  if (s.radii && !s.radii.every((r) => r === s.radii![0])) {
    shape = document.createElementNS(SVG_NS, "path");
    shape.setAttribute("d", roundedRectPath(s.x, s.y, s.width, s.height, s.radii));
  } else {
    shape = document.createElementNS(SVG_NS, "rect");
    shape.setAttribute("x", String(s.x));
    shape.setAttribute("y", String(s.y));
    shape.setAttribute("width", String(s.width));
    shape.setAttribute("height", String(s.height));
    if (s.radius > 0) shape.setAttribute("rx", String(s.radius));
  }
  shape.setAttribute("fill", s.gradient ? `url(#${defs.gradient(s.gradient)})` : s.fill);
  if (s.stroke) {
    shape.setAttribute("stroke", s.stroke);
    shape.setAttribute("stroke-width", String(s.strokeWidth ?? 1));
    if (s.strokeDasharray) shape.setAttribute("stroke-dasharray", s.strokeDasharray);
  }
  if (s.transform) shape.setAttribute("transform", s.transform);
  applyOpacity(shape, s.opacity);
  return clipped(shape, s.clip, defs);
}

/**
 * A graphic's markup as a node, for a model that did not come from
 * {@link measureChartExportLayer} in this page (built by hand, copied).
 * `null`: it does not parse. `undefined`: parsing is refused (Trusted Types).
 */
function parseSvgGraphic(content: string): SVGElement | null | undefined {
  let parsed: Document;
  try {
    parsed = new DOMParser().parseFromString(sanitizeXml(content), "image/svg+xml");
  } catch {
    return undefined;
  }
  const root = parsed.documentElement;
  if (root.namespaceURI !== SVG_NS || parsed.getElementsByTagName("parsererror").length > 0) {
    return null;
  }
  return document.importNode(root, true) as unknown as SVGElement;
}

function renderGraphic(g: ChartExportGraphic, defs: Defs): SVGElement | null {
  const node =
    g.kind === "svg"
      ? ((graphicClones.get(g)?.cloneNode(true) as SVGElement | undefined) ??
        parseSvgGraphic(g.content))
      : undefined;
  if (node === null) return null;
  let el: SVGElement;
  if (node) {
    el = node;
    el.removeAttribute("xmlns");
  } else {
    // A bitmap — or svg markup the page may not parse, drawn as an image of itself.
    el = document.createElementNS(SVG_NS, "image");
    el.setAttribute("preserveAspectRatio", "none");
    el.setAttribute(
      "href",
      g.kind === "image"
        ? g.content
        : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sanitizeXml(g.content))}`,
    );
  }
  el.setAttribute("x", String(g.x));
  el.setAttribute("y", String(g.y));
  el.setAttribute("width", String(g.width));
  el.setAttribute("height", String(g.height));
  applyOpacity(el, g.opacity);
  if (g.transform) {
    const turned = document.createElementNS(SVG_NS, "g");
    turned.setAttribute("transform", g.transform);
    turned.append(el);
    el = turned;
  }
  return clipped(el, g.clip, defs);
}

function renderRun(run: ChartExportTextRun, defs: Defs): SVGElement {
  const text = document.createElementNS(SVG_NS, "text");
  text.setAttribute("data-export-role", run.role);
  text.setAttribute("x", String(run.x));
  text.setAttribute("y", String(run.y));
  text.setAttribute("dominant-baseline", "central");
  if (run.rotate) {
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("transform", `rotate(${run.rotate} ${run.x} ${run.y})`);
  } else if (run.anchor) {
    text.setAttribute("text-anchor", run.anchor);
  }
  text.setAttribute("fill", run.fill);
  text.setAttribute("font-family", run.fontFamily);
  text.setAttribute("font-size", run.fontSize);
  text.setAttribute("font-weight", run.fontWeight);
  if (run.fontStyle !== "normal") text.setAttribute("font-style", run.fontStyle);
  if (run.letterSpacing) text.setAttribute("letter-spacing", run.letterSpacing);
  if (run.textDecoration) text.setAttribute("text-decoration", run.textDecoration);
  if (run.fontVariantNumeric)
    text.style.setProperty("font-variant-numeric", run.fontVariantNumeric);
  if (run.fontFeatureSettings) {
    text.style.setProperty("font-feature-settings", run.fontFeatureSettings);
  }
  applyOpacity(text, run.opacity);
  text.textContent = run.text;
  return clipped(text, run.clip, defs);
}

/** Swatches and graphics on one side of the chart `<svg>`, in paint order. */
function shapesOf(model: ChartExportLayerModel, under: boolean, defs: Defs): SVGElement[] {
  const items = [
    ...model.swatches.map((s, index) => ({
      order: s.order ?? Number.MAX_SAFE_INTEGER,
      index,
      under: Boolean(s.under),
      el: () => renderSwatch(s, defs),
    })),
    ...(model.graphics ?? []).map((g, index) => ({
      order: g.order ?? Number.MAX_SAFE_INTEGER,
      index: model.swatches.length + index,
      under: Boolean(g.under),
      el: () => renderGraphic(g, defs),
    })),
  ];
  return items
    .filter((item) => item.under === under)
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map((item) => item.el())
    .filter((el): el is SVGElement => el !== null);
}

function group(slot: string, defs: Defs, children: SVGElement[]): SVGGElement {
  const g = document.createElementNS(SVG_NS, "g");
  g.setAttribute("data-slot", slot);
  if (defs.element.childNodes.length > 0) g.append(defs.element);
  g.append(...children);
  return g;
}

/**
 * What paints BENEATH the chart `<svg>` — the boxes, canvases and svgs that
 * stack below it (a card's fill, a density underlay) — or `null` when nothing
 * does. Pure, like {@link renderChartExportLayer}.
 */
export function renderChartExportUnderlay(model: ChartExportLayerModel): SVGGElement | null {
  const defs = new Defs(`chart-export-${modelHash(model)}-u`, model);
  const items = shapesOf(model, true, defs);
  return items.length > 0 ? group("chart-export-underlay", defs, items) : null;
}

/**
 * The SVG twin of a measured layer: swatches and graphics over the chart
 * first (in paint order), then text runs. Pure — the same model always yields
 * the same markup.
 */
export function renderChartExportLayer(model: ChartExportLayerModel): SVGGElement {
  const defs = new Defs(`chart-export-${modelHash(model)}`, model);
  const items = shapesOf(model, false, defs);
  for (const run of model.runs) items.push(renderRun(run, defs));
  return group("chart-export-layer", defs, items);
}

/**
 * The framed chart clone cut to the box a scroll or overflow ancestor clips
 * it to on the page ({@link ChartExportLayerModel.chart}`.clip`), or the clone
 * itself when nothing does.
 */
export function clipChartToExportBox(model: ChartExportLayerModel, chart: SVGElement): SVGElement {
  if (model.chart.clip === undefined) return chart;
  const defs = new Defs(`chart-export-${modelHash(model)}-c`, model);
  const cut = clipped(chart, model.chart.clip, defs);
  if (cut === chart) return chart;
  cut.prepend(defs.element);
  cut.setAttribute("data-slot", "chart-export-chart-clip");
  return cut;
}

/** True when a measured layer paints anything at all. */
export function chartExportLayerPaints(model: ChartExportLayerModel): boolean {
  return model.runs.length > 0 || model.swatches.length > 0 || (model.graphics?.length ?? 0) > 0;
}
