/**
 * DG-17 — the diagram as a picture for slides and documents (plan D9, §10): PNG at 1×, 2×
 * or 3×, or SVG, saved as a file or copied. React-free.
 *
 * The picture is the whole diagram at zoom 1, not the part the canvas shows, with the
 * title block above it and the legend below (DG-08). Both are React Flow `Panel`s outside
 * `.react-flow__viewport`, so the diagram's own bounds would crop them (wave-1
 * carry-forward). The minimap, the zoom controls, the status badge and every other panel
 * are controls, not picture, and stay out. So do the selection, the resize handles and
 * any other view state.
 *
 * How: a clone of the canvas is laid out for a moment next to the live one, at the
 * picture's size. Each element's computed style is written inline, but only where it
 * differs from the browser default; the ~2,000 token custom properties never are. Images
 * and the web fonts the picture uses become `data:` URLs, and the result is wrapped in an
 * SVG `<foreignObject>`. PNG draws that SVG onto a canvas.
 *
 * Not `html-to-image` (the recipe in the research): it copies every computed property,
 * custom properties included, onto every element. On the lakehouse example that took
 * 4.6 s and made an 80 MB SVG. docs/findings/DG-17-export.md.
 */
import { FLOW_EDGE_DEFAULTS } from "@elabs-ai/components-flow";
import { KIND_STROKE } from "../edges/edge-style";

/** PNG pixels per CSS pixel. */
export type PictureScale = 1 | 2 | 3;

export interface PictureOptions {
  /** Leave the canvas colour out: only the diagram and its panels are painted. */
  transparent?: boolean;
}

/** A standalone SVG document and its size in CSS pixels. */
export interface Picture {
  svg: string;
  width: number;
  height: number;
}

const SVG_NS = "http://www.w3.org/2000/svg";
const XHTML_NS = "http://www.w3.org/1999/xhtml";

/** Room around the diagram, and between the diagram and a panel (CSS px at zoom 1). */
const PADDING = 32;

/** The largest canvas side every engine draws (html-to-image uses the same limit). */
const MAX_CANVAS_SIDE = 16_384;

/** What the diagram's box is measured from: nodes, edge lines and edge labels. */
const DRAWN = ".react-flow__node, .react-flow__edge-path, .react-flow__edgelabel-renderer > *";

/** The two panels that are part of the picture (DG-08). */
const PICTURE_PANELS = '[data-slot="diagram-title"], [data-slot="diagram-legend"]';

/**
 * Never in the picture: selection boxes, node toolbars, resize handles, connection handles,
 * the wide invisible edge hit areas, the canvas's status line under the title card ("Showing
 * the last valid diagram", wave-2 review m4), and anything a later item marks
 * `data-diagram-export="exclude"`.
 */
const LEFT_OUT =
  '.react-flow__selection, .react-flow__nodesselection, .react-flow__node-toolbar, .react-flow__resize-control, .react-flow__handle, .react-flow__edge-interaction, [data-slot="diagram-title"] > [role="status"], [data-diagram-export="exclude"]';

/** View state carried as attributes (DG-18's walk-through dims what is outside the step). */
const VIEW_STATE_ATTRIBUTES = ["data-dimmed"];

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The canvas the app shows (not a gallery's).
 * P4: library gap — CanvasShell has no export API, so the exporter finds the canvas and its
 * parts by class name (docs/findings/DG-17-export.md §2).
 */
function liveCanvas(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-slot="canvas-shell"] .react-flow');
}

/** How long an export waits for a canvas that is still mounting or laying out. */
const CANVAS_WAIT_MS = 10_000;

/**
 * Resolves once the live canvas is mounted and its first layout has landed (until then the
 * pane is `inert`, `panes/canvas-pane.tsx`), or after `CANVAS_WAIT_MS`; `pictureOfCanvas`
 * then reports a canvas that never came. At once when the canvas is already drawn. A phone's
 * Editor tab does not mount the canvas (app.tsx `PhoneWorkspace`): an export from there opens
 * the Canvas tab and waits here.
 */
export function canvasDrawn(): Promise<void> {
  const ready = () => {
    const flow = liveCanvas();
    return flow !== null && flow.closest("[inert]") === null;
  };
  if (ready()) return Promise.resolve();
  const started = Date.now();
  return new Promise((resolve) => {
    const poll = window.setInterval(() => {
      if (!ready() && Date.now() - started < CANVAS_WAIT_MS) return;
      window.clearInterval(poll);
      resolve();
    }, 50);
  });
}

/** The drawn diagram's box in flow units (zoom 1), read from the live canvas. */
function drawnBox(flow: HTMLElement): Box | null {
  const viewport = flow.querySelector<HTMLElement>(".react-flow__viewport");
  if (!viewport) return null;
  const { a: zoom, e: panX, f: panY } = new DOMMatrixReadOnly(getComputedStyle(viewport).transform);
  const origin = flow.getBoundingClientRect();
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const element of viewport.querySelectorAll(DRAWN)) {
    const r = element.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    left = Math.min(left, r.left);
    top = Math.min(top, r.top);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }
  if (left === Infinity) return null;
  return {
    x: (left - origin.left - panX) / zoom,
    y: (top - origin.top - panY) / zoom,
    width: (right - left) / zoom,
    height: (bottom - top) / zoom,
  };
}

/**
 * The widest the title card may be in the picture (CSS px at zoom 1). On the canvas the card
 * is capped by the pane, so a long title wraps there; the picture has no pane, so the title
 * stays on one line up to this width and wraps only past it (wave-3 review F9).
 */
const TITLE_MAX_WIDTH = 1200;

/**
 * Room added to text measured on the page: the picture draws text a hair wider (see
 * `keepOneLine`), and a wrapped title must not lose a word to a third line.
 */
const TEXT_SLACK = 4;

/** The right edge of the widest line of text in `box`, from its left border edge. */
function textRight(box: HTMLElement): number {
  const left = box.getBoundingClientRect().left;
  const range = document.createRange();
  const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
  let right = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    range.selectNodeContents(node);
    for (const rect of range.getClientRects()) right = Math.max(right, rect.right - left);
  }
  return right;
}

interface PanelExtent {
  /** The panel's width with both margins. */
  width: number;
  /** How far it reaches in from its edge of the canvas: its margin there plus its height. */
  reach: number;
  /** The measured box's own width. */
  boxWidth: number;
}

/**
 * A picture panel on the live canvas. With `part`, only that child counts: the title panel
 * also holds the status line, which is not picture. With `maxWidth`, it is measured as the
 * picture lays it out, on a hidden copy beside it that is gone again within this task: as
 * wide as its content up to `maxWidth`, and, where its text wraps, no wider than its
 * longest line (a balanced title would otherwise leave half the card empty).
 */
function panelExtent(
  flow: HTMLElement,
  selector: string,
  part?: string,
  maxWidth?: number,
): PanelExtent {
  const none = { width: 0, reach: 0, boxWidth: 0 };
  const live = flow.querySelector<HTMLElement>(selector);
  if (!live) return none;
  const panel = maxWidth ? (live.cloneNode(true) as HTMLElement) : live;
  if (maxWidth) {
    Object.assign(panel.style, {
      maxWidth: `${maxWidth}px`,
      width: "max-content",
      visibility: "hidden",
    });
    live.after(panel);
  }
  try {
    const box = part ? panel.querySelector<HTMLElement>(part) : panel;
    if (!box) return none;
    const style = getComputedStyle(panel);
    const px = (value: string) => Number.parseFloat(value) || 0;
    const edge = panel.classList.contains("top") ? style.marginTop : style.marginBottom;
    // Not `offsetWidth`: it rounds, and a title 0.3 px wider than its box wraps.
    let boxWidth = Math.ceil(box.getBoundingClientRect().width);
    if (maxWidth) {
      const inner = getComputedStyle(box);
      const end = px(inner.paddingRight) + px(inner.borderRightWidth);
      boxWidth = Math.min(boxWidth, Math.ceil(textRight(box) + end + TEXT_SLACK));
    }
    return {
      width: boxWidth + px(style.marginLeft) + px(style.marginRight),
      reach: box.offsetHeight + px(edge),
      boxWidth,
    };
  } finally {
    if (panel !== live) panel.remove();
  }
}

/**
 * Selection is painted from React props (flow `FlowNodeCard`'s ring classes,
 * `FlowEdgePath`'s inline stroke, the label cluster's border), so the clone carries it.
 * Put the resting look back. Every flow gets its resting width: a selected flow and the
 * current step of DG-18's walk-through are drawn wider.
 * P4: library gap — docs/findings/DG-17-export.md.
 */
function unselect(stage: HTMLElement) {
  for (const card of stage.querySelectorAll(".react-flow__node.selected > *")) {
    card.classList.remove("ring-2", "ring-ring");
  }
  for (const path of stage.querySelectorAll<SVGPathElement>('[data-slot="data-flow-edge"]')) {
    path.style.strokeWidth = String(FLOW_EDGE_DEFAULTS.strokeWidth);
  }
  for (const path of stage.querySelectorAll<SVGPathElement>(
    '.react-flow__edge.selected [data-slot="data-flow-edge"]',
  )) {
    const kind = path.dataset.kind as keyof typeof KIND_STROKE | undefined;
    path.style.stroke = KIND_STROKE[kind ?? "data"] ?? KIND_STROKE.data;
  }
  for (const badge of stage.querySelectorAll('[data-slot="edge-label-cluster"] .border-ring')) {
    badge.classList.replace("border-ring", "border-flow-group-border");
  }
  for (const element of stage.querySelectorAll(".selected")) element.classList.remove("selected");
}

/** A clone of the canvas, sized to the picture, with only the picture left in it. */
function stageOf(flow: HTMLElement, box: Box, options: PictureOptions) {
  const stage = flow.cloneNode(true) as HTMLElement;
  for (const child of [...stage.children]) {
    if (!child.matches(`.react-flow__renderer, ${PICTURE_PANELS}`)) child.remove();
  }
  for (const element of stage.querySelectorAll(LEFT_OUT)) element.remove();
  for (const name of VIEW_STATE_ATTRIBUTES) {
    for (const element of stage.querySelectorAll(`[${name}]`)) element.removeAttribute(name);
  }
  unselect(stage);

  // The title block sits above the diagram, the legend below it: neither covers a node.
  const title = panelExtent(
    flow,
    '[data-slot="diagram-title"]',
    '[data-slot="diagram-title-card"]',
    TITLE_MAX_WIDTH,
  );
  // Laid out at the width measured for it, not the pane's cap (`max-w-[calc(100%-…)]`).
  const titlePanel = stage.querySelector<HTMLElement>('[data-slot="diagram-title"]');
  if (titlePanel) titlePanel.style.maxWidth = `${title.boxWidth}px`;
  const legend = panelExtent(flow, '[data-slot="diagram-legend"]');
  const above = title.reach + PADDING;
  const below = legend.reach + PADDING;
  const width = Math.ceil(Math.max(box.width + 2 * PADDING, title.width, legend.width));
  const height = Math.ceil(above + box.height + below);

  const viewport = stage.querySelector<HTMLElement>(".react-flow__viewport");
  if (viewport) {
    const x = (width - box.width) / 2 - box.x;
    viewport.style.transform = `translate(${x}px, ${above - box.y}px) scale(1)`;
  }
  const canvas = flow.closest('[data-slot="canvas-shell"]');
  Object.assign(stage.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: `${width}px`,
    height: `${height}px`,
    zIndex: "-1",
    pointerEvents: "none",
    backgroundColor:
      options.transparent || !canvas ? "transparent" : getComputedStyle(canvas).backgroundColor,
  });
  return { stage, width, height };
}

// ── Inline styles ────────────────────────────────────────────────────────────

/**
 * Longhands the picture never needs: behaviour (cursor, transitions…), `d` (the path's own
 * attribute), and the logical twins of physical properties (Chrome lists both).
 */
const SKIPPED = new Set([
  "d",
  "cursor",
  "pointer-events",
  "user-select",
  "touch-action",
  "caret-color",
  "-webkit-locale",
  "-webkit-tap-highlight-color",
  "text-size-adjust",
]);
const SKIPPED_PATTERN =
  /^(--|transition|animation|will-change|-webkit-user|scroll-|overscroll)|(^|-)(block|inline)(-|$)|^border-(start|end)-(start|end)-radius$/;

/** Colours whose initial value is `currentcolor`: written only where they differ from `color`. */
const CURRENT_COLOR = new Set([
  "outline-color",
  "column-rule-color",
  "text-decoration-color",
  "text-emphasis-color",
  "-webkit-text-fill-color",
  "-webkit-text-stroke-color",
  "row-rule-color",
]);

/**
 * Each line (border side, outline, column rule): its width, its style, then its other parts.
 * A line with no width or no style paints nothing, so none of its parts is written;
 * otherwise its width and style always are: a style written without its width would read
 * as `medium`.
 */
const LINES = [
  ["border-top-width", "border-top-style", "border-top-color"],
  ["border-right-width", "border-right-style", "border-right-color"],
  ["border-bottom-width", "border-bottom-style", "border-bottom-color"],
  ["border-left-width", "border-left-style", "border-left-color"],
  ["outline-width", "outline-style", "outline-color", "outline-offset"],
  ["column-rule-width", "column-rule-style", "column-rule-color"],
] as const;
type Line = readonly [width: string, style: string];
const LINE_OF = new Map<string, Line>(
  LINES.flatMap(([width, style, ...parts]) =>
    [width, style, ...parts].map((part): [string, Line] => [part, [width, style]]),
  ),
);
const paints = (computed: Styles, [width, style]: Line) =>
  computed.get(width) !== "0px" && !["none", "hidden"].includes(computed.get(style) ?? "none");

/**
 * Inherited properties: written only where they differ from what the picture gives the
 * element anyway, the parent's value or, for a tag the browser styles, that rule's value.
 */
const INHERITED = new Set([
  "color",
  "direction",
  "fill",
  "fill-opacity",
  "fill-rule",
  "font-family",
  "font-feature-settings",
  "font-kerning",
  "font-optical-sizing",
  "font-size",
  "font-stretch",
  "font-style",
  "font-variant",
  "font-variation-settings",
  "font-weight",
  "letter-spacing",
  "line-height",
  "stroke",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke-width",
  "text-align",
  "text-anchor",
  "text-indent",
  "text-rendering",
  "text-shadow",
  "text-transform",
  "visibility",
  "white-space",
  "white-space-collapse",
  "word-break",
  "word-spacing",
  "overflow-wrap",
  "-webkit-font-smoothing",
  "color-scheme",
  "tab-size",
]);

/**
 * Inherited values the browser sets relative to the context for some tags: `<code>`, `<kbd>`,
 * `<samp>`, `<pre>` and `<tt>` get 13 px through the generic monospace default, headings a
 * multiple of the parent's size. Where the browser sizes the tag itself, the value read in
 * the empty sandbox says nothing about what the picture would give it, so it is written.
 */
const CONTEXT_SIZED = new Set(["font-size", "line-height"]);

/** Elements the browser gives their own font and colour instead of the parent's. */
const FORM_CONTROLS = new Set(["button", "input", "select", "textarea"]);

type Styles = Map<string, string>;

const transformed = (computed: Styles) =>
  ["transform", "rotate", "scale", "translate"].some((name) => computed.get(name) !== "none");

/** An empty document the browser's default styles are read in. */
async function openSandbox(): Promise<HTMLIFrameElement> {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  Object.assign(frame.style, { position: "fixed", width: "0", height: "0", border: "0" });
  frame.srcdoc = "<!DOCTYPE html><html><head></head><body></body></html>";
  const loaded = new Promise((resolve) => frame.addEventListener("load", resolve, { once: true }));
  document.body.append(frame);
  await loaded;
  return frame;
}

/** Reads computed styles against the browser defaults. */
function styleReader(sandbox: HTMLIFrameElement) {
  const win = sandbox.contentWindow!;
  const doc = sandbox.contentDocument!;
  const defaults = new Map<string, Styles>();
  const read = (style: CSSStyleDeclaration, names: readonly string[]): Styles =>
    new Map(names.map((name) => [name, style.getPropertyValue(name)]));
  const probeStyle = win.getComputedStyle(doc.body);
  const names = [...probeStyle].filter((name) => !SKIPPED.has(name) && !SKIPPED_PATTERN.test(name));

  function defaultsOf(namespace: string | null, tag: string): Styles {
    const key = `${namespace}|${tag}`;
    let styles = defaults.get(key);
    if (!styles) {
      const probe = doc.createElementNS(namespace, tag);
      const host =
        namespace === SVG_NS && tag !== "svg" ? doc.createElementNS(SVG_NS, "svg") : null;
      if (host) host.append(probe);
      doc.body.append(host ?? probe);
      styles = read(win.getComputedStyle(probe), names);
      (host ?? probe).remove();
      defaults.set(key, styles);
    }
    return styles;
  }
  /** A tag the browser styles nothing on: what an element inherits when no rule applies. */
  const plain = defaultsOf(XHTML_NS, "span");

  /** The declarations `element` (or its pseudo-element) needs, as CSS text. */
  function declarations(
    computed: Styles,
    base: Styles,
    parent: Styles | undefined,
  ): string | undefined {
    const out: string[] = [];
    const color = computed.get("color");
    for (const [name, value] of computed) {
      const line = LINE_OF.get(name);
      if (line) {
        if (!paints(computed, line)) {
          // A `<button>` draws a border by default: say it has none.
          if (name === line[1] && paints(base, line)) out.push(`${name}:none`);
          continue;
        }
        if (line.includes(name)) {
          out.push(`${name}:${value}`);
          continue;
        }
      }
      if (name.endsWith("-color") && value === color && (line || CURRENT_COLOR.has(name))) continue;
      if (name === "transform-origin" && !transformed(computed)) continue;
      if (name === "perspective-origin" && computed.get("perspective") === "none") continue;
      if (parent && INHERITED.has(name)) {
        // In the picture an inherited value comes from the parent, unless the browser styles
        // this tag itself; then it comes from that rule. Checking the tag's default first
        // dropped a badge's 13 px `<code>` size, which matches Chromium's monospace default,
        // and the badge took its parent's larger size (wave-3 review m1).
        const byTag = base.get(name) !== plain.get(name);
        const given = byTag ? base.get(name) : parent.get(name);
        if (value === given && !(byTag && CONTEXT_SIZED.has(name))) continue;
        out.push(`${name}:${value}`);
        continue;
      }
      if (value === base.get(name)) continue;
      out.push(`${name}:${value}`);
    }
    return out.length ? out.join(";") : undefined;
  }

  return { names, defaultsOf, declarations, read };
}

interface Inlined {
  element: Element;
  style?: string;
  pseudo?: string;
}

/**
 * The picture draws text a hair wider or narrower than the page does, while every width in
 * it is fixed at its live value. A title sized to fit its text exactly would then wrap and
 * lose its second line, or end in "…" (seen with Source Sans 3 in qlik-light). So text that
 * sits on one line on the page stays on one line, and text the page shows whole may spill
 * a pixel past its box rather than be cut.
 */
function keepOneLine(element: Element, computed: Styles): string | undefined {
  if (element.namespaceURI !== XHTML_NS || element.childElementCount > 0) return undefined;
  if (!element.textContent?.trim()) return undefined;
  const range = document.createRange();
  range.selectNodeContents(element);
  const lines = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)));
  if (lines.size !== 1) return undefined;
  const out: string[] = [];
  if (computed.get("text-wrap-mode") === "wrap") out.push("text-wrap-mode:nowrap");
  if (computed.get("overflow-x") !== "visible" && element.scrollWidth <= element.clientWidth) {
    // `hidden` also let a flex item shrink below its text; keep that, or the item would
    // push its siblings (a zone header's owner badge) onto a clipped second row.
    out.push("overflow:visible;min-width:0;min-height:0");
  }
  return out.length ? out.join(";") : undefined;
}

/**
 * Every element's style as inline declarations, read while `stage` is laid out. Elements
 * that are not displayed are dropped. Pseudo-elements become rules in `pseudoCss`.
 */
function inlineStyles(stage: HTMLElement, reader: ReturnType<typeof styleReader>) {
  const inlined: Inlined[] = [];
  const hidden: Element[] = [];
  const pseudoRules: string[] = [];
  const span = reader.defaultsOf(XHTML_NS, "span");

  const walk = (element: Element, parent: Styles | undefined) => {
    const live = getComputedStyle(element);
    if (live.display === "none") {
      hidden.push(element);
      return;
    }
    const computed = reader.read(live, reader.names);
    const entry: Inlined = {
      element,
      style: reader.declarations(
        computed,
        reader.defaultsOf(element.namespaceURI, element.localName),
        // A form control does not inherit its text style, so it writes all of it.
        FORM_CONTROLS.has(element.localName) ? undefined : parent,
      ),
    };
    const oneLine = keepOneLine(element, computed);
    if (oneLine) entry.style = entry.style ? `${entry.style};${oneLine}` : oneLine;
    for (const which of ["::before", "::after"] as const) {
      const pseudo = getComputedStyle(element, which);
      if (pseudo.content === "none" || pseudo.content === "normal") continue;
      const body = reader.declarations(reader.read(pseudo, reader.names), span, computed);
      const id = `p${pseudoRules.length}`;
      entry.pseudo = entry.pseudo ? `${entry.pseudo} ${id}` : id;
      pseudoRules.push(`[data-picture~="${id}"]${which}{content:${pseudo.content};${body ?? ""}}`);
    }
    inlined.push(entry);
    for (const child of element.children) walk(child, computed);
  };
  walk(stage, undefined);

  // Write only after every read: a write would make the next read lay the page out again.
  for (const element of hidden) element.remove();
  for (const { element, style, pseudo } of inlined) {
    element.removeAttribute("class");
    if (style) element.setAttribute("style", style);
    else element.removeAttribute("style");
    if (pseudo) element.setAttribute("data-picture", pseudo);
  }
  return pseudoRules.join("\n");
}

// ── Images and fonts ─────────────────────────────────────────────────────────

/** One fetch per URL per page. */
const dataUrls = new Map<string, Promise<string | undefined>>();

function dataUrlOf(url: string): Promise<string | undefined> {
  let pending = dataUrls.get(url);
  if (!pending) {
    pending = fetch(url)
      .then((response) => (response.ok ? response.blob() : undefined))
      .then(
        (blob) =>
          blob &&
          new Promise<string | undefined>((resolve) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve(typeof reader.result === "string" ? reader.result : undefined);
            reader.onerror = () => resolve(undefined);
            reader.readAsDataURL(blob);
          }),
      )
      .catch(() => undefined);
    dataUrls.set(url, pending);
    // A failed fetch may work next time (a dev server restarting).
    void pending.then((value) => {
      if (value === undefined) dataUrls.delete(url);
    });
  }
  return pending;
}

/** `url("…")`, `url('…')` or a bare `url(…)`; the address is group 1, 2 or 3. */
const CSS_URL = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/g;

/**
 * `css` with every remote `url()` as a `data:` URL: an icon painted as a CSS mask
 * (`ServiceLogo`'s `mask-image`) otherwise draws as a solid square. Fragment references
 * (`url(#marker)`) stay; a file that cannot be fetched keeps its URL.
 */
async function embedCssUrls(css: string): Promise<string> {
  const urls = new Set(
    [...css.matchAll(CSS_URL)]
      .map((match) => match[1] ?? match[2] ?? match[3] ?? "")
      .filter((url) => url && !url.startsWith("data:") && !url.startsWith("#")),
  );
  let embedded = css;
  await Promise.all(
    [...urls].map(async (url) => {
      let href: string;
      try {
        href = new URL(url, document.baseURI).href;
      } catch {
        return;
      }
      const data = await dataUrlOf(href);
      if (data) embedded = embedded.split(url).join(data);
    }),
  );
  return embedded;
}

/**
 * Every `<img>` and every inline `url()` carries its picture: an SVG image cannot load
 * anything itself.
 */
async function embedImages(stage: HTMLElement) {
  await Promise.all([
    ...[...stage.querySelectorAll("img")].map(async (image) => {
      image.removeAttribute("srcset");
      image.removeAttribute("loading");
      const src = image.getAttribute("src");
      if (!src || src.startsWith("data:")) return;
      const data = await dataUrlOf(new URL(src, document.baseURI).href);
      if (data) image.setAttribute("src", data);
    }),
    ...[stage, ...stage.querySelectorAll<HTMLElement>('[style*="url("]')].map(async (element) => {
      const style = element.getAttribute("style");
      if (!style?.includes("url(")) return;
      const embedded = await embedCssUrls(style);
      if (embedded !== style) element.setAttribute("style", embedded);
    }),
  ]);
}

const unquote = (family: string) =>
  family
    .trim()
    .replace(/^(["'])(.*)\1$/, "$2")
    .toLowerCase();

/** Every `@font-face` rule the page can read, with the URL its `url()`s resolve against. */
function* fontFaceRules(): Generator<{ rule: CSSFontFaceRule; base: string }> {
  function* visit(
    rules: CSSRuleList,
    base: string,
  ): Generator<{ rule: CSSFontFaceRule; base: string }> {
    for (const rule of rules) {
      if (rule instanceof CSSFontFaceRule) yield { rule, base };
      else if (rule instanceof CSSImportRule && rule.styleSheet) {
        yield* visit(rule.styleSheet.cssRules, rule.styleSheet.href ?? base);
      } else if (rule instanceof CSSGroupingRule) yield* visit(rule.cssRules, base);
    }
  }
  for (const sheet of document.styleSheets) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // a cross-origin sheet hides its rules
    }
    yield* visit(rules, sheet.href ?? document.baseURI);
  }
}

/** True when a `unicode-range` covers any of `codePoints` (no descriptor covers all). */
function covers(unicodeRange: string, codePoints: ReadonlySet<number>): boolean {
  if (!unicodeRange.trim()) return true;
  const ranges = unicodeRange.split(",").flatMap((part) => {
    const m = /^\s*u\+([0-9a-f?]{1,6})(?:-([0-9a-f]{1,6}))?\s*$/i.exec(part);
    if (!m) return [];
    const first = m[1]!;
    const from = Number.parseInt(first.replaceAll("?", "0"), 16);
    const to = m[2] ? Number.parseInt(m[2], 16) : Number.parseInt(first.replaceAll("?", "f"), 16);
    return [[from, to] as const];
  });
  for (const cp of codePoints) if (ranges.some(([from, to]) => cp >= from && cp <= to)) return true;
  return false;
}

/**
 * `@font-face` rules, with `data:` sources, for the web fonts the picture draws with: an SVG
 * drawn as an image cannot reach the page's fonts, and a fallback face lays every label
 * out at another width. P4: library gap — charts has the same helper
 * (`chart-frame/export-fonts.ts`) but does not export it. docs/findings/DG-17-export.md.
 */
async function fontCss(stage: HTMLElement): Promise<string> {
  const families = new Set<string>();
  for (const element of [stage, ...stage.querySelectorAll<HTMLElement>("*")]) {
    const family = element.style?.getPropertyValue("font-family");
    if (family) for (const name of family.split(",")) families.add(unquote(name));
  }
  const codePoints = new Set<number>();
  for (const char of stage.textContent ?? "") codePoints.add(char.codePointAt(0)!);
  const seen = new Set<string>();
  const faces: Promise<string | undefined>[] = [];
  for (const { rule, base } of fontFaceRules()) {
    const style = rule.style;
    if (!families.has(unquote(style.getPropertyValue("font-family")))) continue;
    if (/^(italic|oblique)/.test(style.getPropertyValue("font-style").trim())) continue;
    if (!covers(style.getPropertyValue("unicode-range"), codePoints)) continue;
    const m = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/.exec(style.getPropertyValue("src"));
    const raw = m ? (m[1] ?? m[2] ?? m[3] ?? "").trim() : "";
    if (!raw) continue;
    const url = new URL(raw, base).href;
    if (seen.has(url)) continue;
    seen.add(url);
    const descriptors = [...style]
      .filter((name) => name !== "src")
      .map((name) => `${name}:${style.getPropertyValue(name)}`);
    faces.push(
      dataUrlOf(url).then((data) =>
        data ? `@font-face{${descriptors.join(";")};src:url("${data}")}` : undefined,
      ),
    );
  }
  return (await Promise.all(faces)).filter(Boolean).join("\n");
}

// ── The picture ──────────────────────────────────────────────────────────────

/** Characters XML 1.0 forbids become U+FFFD, so the file always parses (charts does the same). */
const XML_ILLEGAL =
  // eslint-disable-next-line no-control-regex -- matching control characters is the point.
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/**
 * The live canvas as a standalone SVG. Throws when there is nothing drawn.
 * `title`: the picture's accessible name (the diagram's `title:`).
 */
export async function pictureOfCanvas(
  title: string | undefined,
  options: PictureOptions = {},
): Promise<Picture> {
  const flow = liveCanvas();
  const box = flow ? drawnBox(flow) : null;
  if (!flow || !box) throw new Error("There is no diagram on the canvas to export.");
  const sandbox = await openSandbox();
  let stage: HTMLElement;
  let size: { width: number; height: number };
  let pseudoCss: string;
  try {
    const staged = stageOf(flow, box, options);
    stage = staged.stage;
    size = staged;
    // Laid out next to the live canvas (same ancestors, same tokens) and gone again within
    // this task: it is never painted.
    flow.after(stage);
    try {
      pseudoCss = inlineStyles(stage, styleReader(sandbox));
    } finally {
      stage.remove();
    }
  } finally {
    sandbox.remove();
  }
  // In the picture the stage is the whole page: no offset, no stacking.
  Object.assign(stage.style, { position: "relative", inset: "", zIndex: "" });
  await embedImages(stage);
  const css = [await fontCss(stage), await embedCssUrls(pseudoCss)].filter(Boolean).join("\n");

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", String(size.width));
  svg.setAttribute("height", String(size.height));
  svg.setAttribute("viewBox", `0 0 ${size.width} ${size.height}`);
  if (title) {
    svg.setAttribute("role", "img");
    const name = document.createElementNS(SVG_NS, "title");
    name.textContent = title;
    svg.append(name);
  }
  const object = document.createElementNS(SVG_NS, "foreignObject");
  object.setAttribute("width", "100%");
  object.setAttribute("height", "100%");
  const body = document.createElementNS(XHTML_NS, "div");
  if (css) {
    const style = document.createElementNS(XHTML_NS, "style");
    style.textContent = css;
    body.append(style);
  }
  body.append(stage);
  object.append(body);
  svg.append(object);
  return {
    svg: new XMLSerializer().serializeToString(svg).replace(XML_ILLEGAL, "�"),
    width: size.width,
    height: size.height,
  };
}

/** The picture as an SVG file. */
export function svgBlob(picture: Picture): Blob {
  return new Blob([picture.svg], { type: "image/svg+xml" });
}

/**
 * The picture as a PNG at `scale` pixels per CSS pixel, lowered when a side would pass
 * `MAX_CANVAS_SIDE`. Returns the pixel size it drew.
 */
export async function pngBlob(
  picture: Picture,
  scale: PictureScale,
): Promise<{ blob: Blob; width: number; height: number }> {
  const ratio = Math.min(scale, MAX_CANVAS_SIDE / Math.max(picture.width, picture.height));
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error("The browser could not draw the picture."));
    // A data URL, not a blob URL: a `<foreignObject>` image from a data URL leaves the
    // canvas readable in Chromium.
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(picture.svg)}`;
  });
  // `load` can come before the embedded fonts are decoded; draw once they are.
  await image.decode().catch(() => undefined);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(picture.width * ratio);
  canvas.height = Math.round(picture.height * ratio);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The browser could not draw the picture.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The browser could not encode the PNG.");
  return { blob, width: canvas.width, height: canvas.height };
}

/** `Lakehouse on AWS` → `lakehouse-on-aws.png`; no title → `diagram.png`. */
export function pictureFileName(title: string | undefined, extension: "png" | "svg"): string {
  const slug = (title ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return `${slug || "diagram"}.${extension}`;
}

/** Download `blob` as `name`. */
export function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  // Revoked on the next task: the download has started from the click.
  setTimeout(() => URL.revokeObjectURL(url));
}
