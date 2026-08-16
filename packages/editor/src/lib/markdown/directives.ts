/**
 * Shared remark pipeline for the brand markdown dialect.
 *
 * `remark-directive` parses generic container/leaf/text directives (`:::name`,
 * `::name`, `:name`). `remarkBrandDirectives` then rewrites the four brand blocks
 * — :::card / :::callout / ::metric / :::timeline — into a single `<brand-directive>`
 * element carrying a JSON `data-brand` payload, which the preview's components map
 * turns into real @brand components. Unknown directive names are preserved + flagged
 * so the preview can surface an "unknown block" error instead of silently dropping.
 *
 * One JSON attribute (not many) keeps it robust against Streamdown's HTML
 * sanitization (we only need to allow a single attribute through). The SAME plugin
 * array is fed to Streamdown (preview) and can be fed to Milkdown via `$remark`
 * (editor), so both sides parse `:::card` identically.
 */
import type { ReactNode } from "react";
import remarkDirective from "remark-directive";
import type { PluggableList } from "unified";
import { visit } from "unist-util-visit";

export const BRAND_DIRECTIVES = ["card", "callout", "metric", "timeline"] as const;
export type BrandDirectiveName = (typeof BRAND_DIRECTIVES)[number];

/** Custom element BLOCK / LEAF directives are rewritten to. */
export const BRAND_DIRECTIVE_TAG = "brand-directive";
/**
 * Custom element INLINE (text) directives are rewritten to. A SEPARATE tag (not
 * {@link BRAND_DIRECTIVE_TAG}) so the preview can render inline directives without
 * the block `<div>` wrappers the annotation/search layer adds to block tags —
 * keeping `:entity[name]` inside the text flow.
 */
export const BRAND_DIRECTIVE_INLINE_TAG = "brand-directive-inline";
/** Rendered HTML attribute carrying the JSON payload (allow-list this in Streamdown). */
export const BRAND_DIRECTIVE_ATTR = "data-brand";
/**
 * hast PROPERTY name (camelCase) for {@link BRAND_DIRECTIVE_ATTR}. This — not the
 * rendered `data-brand` — is what Streamdown's `allowedTags` must list to let the
 * payload survive sanitization.
 */
export const BRAND_DIRECTIVE_PROP = "dataBrand";

/** Which directive syntax produced a node: `:::block`, `::leaf`, or `:inline`. */
export type MarkdownDirectiveKind = "container" | "leaf" | "inline";

export interface BrandDirectivePayload {
  name: string;
  known: boolean;
  kind: MarkdownDirectiveKind;
  attributes: Record<string, string>;
  items?: { title: string; status: string }[];
  /**
   * RAW label source for inline/leaf directives (`:calc[85 * 32]` → `85 * 32`).
   * Captured from source positions so markdown-significant characters in the
   * label (`*`, `_`, `[`) survive intact — the rendered children would mangle
   * them. Renderers that need the verbatim expression (calc) read this.
   */
  label?: string;
  /**
   * RAW container body source (the markdown between the `:::name` fences),
   * captured only for the directive names passed in `rawBodyNames` — e.g. the
   * per-cell TEMPLATE of an `:::iterate` block, which must be interpolated then
   * rendered, NOT shown pre-rendered. Captured from source positions.
   */
  body?: string;
}

/* ------------------------------------------------------------------ */
/* Extension registry — the consumer-supplied render seam (the library  */
/* RENDERS; the consumer brings the renderer + any domain hook). One     */
/* registry feeds BOTH the parse-side known-set and the render dispatch. */
/* ------------------------------------------------------------------ */

/** Context handed to a consumer directive renderer. */
export interface MarkdownDirectiveContext {
  name: string;
  /** Which syntax matched — a renderer can branch (e.g. inline chip vs block card). */
  kind: MarkdownDirectiveKind;
  /** Directive attributes (`{key=value}`), strings only. */
  attributes: Record<string, string>;
  /** Rendered body (container), label (inline), or empty (leaf). */
  children: ReactNode;
  /**
   * RAW label text for inline/leaf directives (markdown-significant characters
   * preserved). Use this — not `children` — when you need the verbatim source
   * (e.g. a calc expression `85 * 32`). `undefined` for container directives.
   */
  textValue?: string;
  /**
   * RAW container body markdown (the source between the `:::name` fences). Only
   * populated for directives registered with `rawBodyNames` (e.g. `iterate` /
   * `pivot`), where the body is a TEMPLATE to interpolate + render per cell, not
   * to display pre-rendered. `undefined` otherwise.
   */
  rawBody?: string;
}

/** Register a custom `:::name` / `::name` / `:name` directive renderer. */
export interface MarkdownDirectiveRenderer {
  /** Directive name, e.g. `"decision"`, `"entity"`. */
  name: string;
  /** Accepted syntaxes. Default: all three. */
  kinds?: readonly MarkdownDirectiveKind[];
  render: (ctx: MarkdownDirectiveContext) => ReactNode;
}

/** Context handed to a consumer fence renderer. */
export interface MarkdownFenceContext {
  /** The fence body (trailing newline stripped). */
  source: string;
  /** The info-string language, e.g. `"calc"`. */
  lang: string;
}

/** Register a custom ```lang fenced-block renderer (the mermaid/calc seam). */
export interface MarkdownFenceRenderer {
  /** Info-string this renderer claims, e.g. `"calc"`. */
  lang: string;
  render: (ctx: MarkdownFenceContext) => ReactNode;
}

/**
 * Consumer extensions to the brand markdown dialect — passed to `MarkdownPreview`
 * via the `extensions` prop. Registered directive NAMES are also fed to the parser
 * (so `:entity[…]` is rewritten, while an unregistered `:foo` in prose stays
 * literal text), and the renderers drive the preview's dispatch. The engine is
 * never forked: new blocks register here.
 */
export interface MarkdownExtensions {
  directives?: readonly MarkdownDirectiveRenderer[];
  fences?: readonly MarkdownFenceRenderer[];
}

interface MdNode {
  type: string;
  name?: string;
  value?: string;
  attributes?: Record<string, string | null | undefined>;
  children?: MdNode[];
  position?: { start?: { offset?: number }; end?: { offset?: number } };
  data?: { hName?: string; hProperties?: Record<string, unknown> };
}

const DIRECTIVE_TYPES = new Set(["containerDirective", "leafDirective", "textDirective"]);

function mdastText(node: MdNode): string {
  if (typeof node.value === "string") return node.value;
  if (node.children) return node.children.map(mdastText).join("");
  return "";
}

function extractTimelineItems(node: MdNode): { title: string; status: string }[] {
  const list = node.children?.find((c) => c.type === "list");
  if (!list?.children) return [];
  // Status marker is a leading `(done)` / `(active)` / `(pending)` — parentheses
  // avoid markdown's `[ref]` link-reference collision. Default: pending.
  const MARKER = /^\((done|complete|completed|active|current|pending|todo)\)\s*/i;
  return list.children
    .filter((c) => c.type === "listItem")
    .map((li) => {
      let title = mdastText(li).trim();
      let status = "pending";
      const marker = title.match(MARKER);
      if (marker) {
        status = marker[1]!.toLowerCase();
        title = title.slice(marker[0].length).trim();
      }
      return { title, status };
    });
}

function cleanAttributes(attrs: MdNode["attributes"]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

/**
 * Reconstruct a directive's ORIGINAL source text. Prose colons routinely
 * pattern-match remark-directive's text/leaf forms (`qwen3:0.6b` parses as a
 * `:0` text directive and swallows the "0") — restoring the source slice is
 * the only faithful undo.
 */
function originalText(node: MdNode, source: string | undefined): string {
  const start = node.position?.start?.offset;
  const end = node.position?.end?.offset;
  if (source != null && typeof start === "number" && typeof end === "number") {
    return source.slice(start, end);
  }
  // Position unavailable — best-effort reconstruction.
  const colons = node.type === "leafDirective" ? "::" : ":";
  const label = node.children?.length ? `[${mdastText(node)}]` : "";
  return `${colons}${node.name ?? ""}${label}`;
}

/** mdast node type → the directive kind it represents. */
function directiveKind(type: string): MarkdownDirectiveKind {
  if (type === "containerDirective") return "container";
  if (type === "leafDirective") return "leaf";
  return "inline";
}

/**
 * The RAW label source of a directive (`:name[label]`) — sliced from the original
 * source via the label children's positions, so markdown-significant characters
 * (`*`, `_`, `[`) survive instead of being parsed into emphasis/links.
 */
function rawLabel(node: MdNode, source: string | undefined): string | undefined {
  const kids = node.children;
  if (!source || !kids || kids.length === 0) return undefined;
  const start = kids[0]?.position?.start?.offset;
  const end = kids[kids.length - 1]?.position?.end?.offset;
  if (typeof start === "number" && typeof end === "number") return source.slice(start, end);
  return undefined;
}

/**
 * The RAW body source of a CONTAINER directive — the markdown between the
 * `:::name{…}` opening and the closing `:::`. Skips a leading directive label
 * (`:::name[label]`) child. Used for templated containers (`:::iterate`) whose
 * body must be interpolated then rendered, not shown pre-rendered.
 */
function rawContainerBody(node: MdNode, source: string | undefined): string | undefined {
  const kids = node.children;
  if (!source || !kids || kids.length === 0) return undefined;
  const body = kids.filter(
    (c) => !(c.data as { directiveLabel?: boolean } | undefined)?.directiveLabel,
  );
  if (body.length === 0) return undefined;
  const start = body[0]?.position?.start?.offset;
  const end = body[body.length - 1]?.position?.end?.offset;
  if (typeof start === "number" && typeof end === "number") return source.slice(start, end).trim();
  return undefined;
}

/**
 * remark transform: brand directives → `<brand-directive data-brand="{json}">`
 * (block/leaf) or `<brand-directive-inline …>` (inline).
 *
 * `knownNames` is the set of directive names to TREAT AS KNOWN — i.e. rewrite
 * rather than restore. It defaults to the four built-ins; `MarkdownPreview`
 * extends it with the names a consumer registered via `extensions`, so a
 * registered `:entity[…]` is rewritten while an unregistered `:foo` (or a stray
 * prose colon) is still restored to literal text.
 */
export function remarkBrandDirectives(
  knownNames: readonly string[] = BRAND_DIRECTIVES,
  rawBodyNames: readonly string[] = [],
) {
  return (tree: unknown, file?: { value?: unknown }) => {
    const source = typeof file?.value === "string" ? file.value : undefined;
    visit(tree as never, (node: MdNode, index: number | undefined, parent: MdNode | undefined) => {
      if (!DIRECTIVE_TYPES.has(node.type) || !node.name) return undefined;

      const name = node.name;
      const known = knownNames.includes(name);
      const kind = directiveKind(node.type);

      // Unknown text/leaf directives are almost always FALSE POSITIVES from
      // ordinary colons in prose — restore them as literal text. Only an
      // unknown CONTAINER (`:::name`, deliberately authored) keeps the
      // explicit unknown-block error.
      if (!known && node.type !== "containerDirective" && parent?.children && index != null) {
        const literal: MdNode = { type: "text", value: originalText(node, source) };
        parent.children.splice(
          index,
          1,
          node.type === "leafDirective"
            ? ({ type: "paragraph", children: [literal] } as MdNode)
            : literal,
        );
        return index + 1; // continue after the replacement
      }

      const payload: BrandDirectivePayload = {
        name,
        known,
        kind,
        attributes: cleanAttributes(node.attributes),
      };

      // Inline/leaf directives carry a verbatim label (e.g. a calc expression).
      if (kind !== "container") {
        const label = rawLabel(node, source);
        if (label != null) payload.label = label;
      }

      // Templated containers (`:::iterate`/`:::pivot`) carry their RAW body so the
      // renderer can interpolate + render it per cell. Clear the children so the
      // template is NOT also rendered pre-interpolated (mirrors timeline).
      if (kind === "container" && rawBodyNames.includes(name)) {
        const body = rawContainerBody(node, source);
        if (body != null) payload.body = body;
        node.children = [];
      }

      if (name === "timeline") {
        payload.items = extractTimelineItems(node);
        node.children = []; // consumed into payload.items
      }

      const data = node.data ?? (node.data = {});
      // Inline directives keep their children (the label) and use a SEPARATE tag
      // so the preview renders them inline (no block wrapper).
      data.hName = kind === "inline" ? BRAND_DIRECTIVE_INLINE_TAG : BRAND_DIRECTIVE_TAG;
      // camelCase hast property → renders as the `data-brand` attribute.
      data.hProperties = { [BRAND_DIRECTIVE_PROP]: JSON.stringify(payload) };
    });
  };
}

/** Options for {@link buildMarkdownPlugins}. */
export interface BuildMarkdownPluginsOptions {
  /**
   * Extra directive names to treat as known (rewritten, not restored as literal
   * text). The four built-ins are always known; pass the names a consumer
   * registered via `extensions.directives`.
   */
  directiveNames?: readonly string[];
  /**
   * Container directive names whose RAW body should be captured (as
   * `payload.body` / `ctx.rawBody`) instead of pre-rendered — for templated
   * blocks like `iterate` / `pivot` whose body is interpolated per cell.
   */
  rawBodyNames?: readonly string[];
}

/**
 * The shared remark plugin array (directive parsing + brand mapping). Pass
 * `directiveNames` to recognize consumer-registered directives without forking
 * the engine; with no options it parses exactly the four built-ins (backward
 * compatible).
 */
export function buildMarkdownPlugins(options: BuildMarkdownPluginsOptions = {}): PluggableList {
  const known =
    options.directiveNames && options.directiveNames.length > 0
      ? [...BRAND_DIRECTIVES, ...options.directiveNames]
      : BRAND_DIRECTIVES;
  const rawBodyNames = options.rawBodyNames ?? [];
  return [remarkDirective, [remarkBrandDirectives, known, rawBodyNames]];
}
