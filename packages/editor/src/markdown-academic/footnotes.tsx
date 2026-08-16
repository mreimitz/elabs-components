"use client";

/**
 * Branded GFM footnotes (`[^1]` … `[^1]: definition`).
 *
 * GFM footnotes already PARSE (remark-gfm is always on), but Streamdown's default
 * hast handlers render them with broken in-page anchors (a doubled `user-content-`
 * id prefix so ref/backref hrefs don't resolve) and `target="_blank"` on what are
 * same-page jumps. So we OWN the render: `remarkBrandFootnotes` rewrites the
 * `footnoteReference` / `footnoteDefinition` mdast nodes into our own `brand-*`
 * elements BEFORE mdast→hast runs, giving consistent ids, real same-page links,
 * and quiet branded chrome.
 *
 * Why replace the node TYPE (not just set `data.hName`): mdast-util-to-hast has
 * built-in handlers for `footnoteReference` / `footnoteDefinition` that ignore
 * `data.hName`. Only a node type with NO handler falls through to the unknown
 * handler, which honors `hName` / `hProperties`. So we swap in fresh custom-typed
 * nodes — and we keep every `id`/`href` on our React output (post-sanitization),
 * never on raw hast the sanitizer could strip.
 */
import { Separator } from "@qlik-coe-emea/qlabs-components-ui";
import { cn } from "@qlik-coe-emea/qlabs-components-ui/lib/cn";
import { forwardRef, useId, type HTMLAttributes, type ReactNode } from "react";
import { visit } from "unist-util-visit";

/** Inline footnote marker (`<sup><a>…</a></sup>`). */
export const FOOTNOTE_REF_TAG = "brand-footnote-ref";
/** The branded footnote-definition section appended at document end. */
export const FOOTNOTE_LIST_TAG = "brand-footnote-list";
/** A single footnote definition row (`<li>` + backref). */
export const FOOTNOTE_ITEM_TAG = "brand-footnote-item";
/** hast property carrying the JSON payload (rendered as `data-fn`). */
export const FOOTNOTE_PROP = "dataFn";
const FOOTNOTE_ATTR = "data-fn";

interface FootnotePayload {
  /** Footnote identifier (the `1` / `longname` in `[^1]`). */
  id: string;
  /** Display number, assigned in first-reference order. */
  n: number;
  /** Unique element id for this reference occurrence (the backref target). */
  refId?: string;
  /** All reference element ids for this footnote — one back-ref per occurrence. */
  refs?: string[];
}

/* ------------------------------------------------------------------ */
/* remark transform                                                     */
/* ------------------------------------------------------------------ */

interface MdNode {
  type: string;
  identifier?: string;
  value?: string;
  children?: MdNode[];
  data?: { hName?: string; hProperties?: Record<string, unknown> };
}

function payloadProps(payload: FootnotePayload) {
  return { [FOOTNOTE_PROP]: JSON.stringify(payload) };
}

/**
 * Rewrite footnote refs + definitions into branded elements. Numbering follows
 * first-reference order (GFM behavior); repeated references reuse the number but
 * get a unique element id. Unreferenced definitions are dropped (also GFM).
 */
export function remarkBrandFootnotes() {
  return (tree: unknown) => {
    const root = tree as MdNode;

    // Pass 1 — collect definitions (and remove them; re-emitted at the end).
    const defs = new Map<string, MdNode>();
    visit(
      root as never,
      "footnoteDefinition",
      (node: MdNode, index, parent: MdNode | undefined) => {
        if (!node.identifier || !parent?.children || index == null) return;
        defs.set(node.identifier, node);
        parent.children.splice(index, 1);
        return index; // re-visit the now-shifted index
      },
    );

    // Pass 2 — number references in document order + replace with branded refs.
    const numberOf = new Map<string, number>();
    const refsOf = new Map<string, string[]>();
    const order: string[] = [];
    visit(root as never, "footnoteReference", (node: MdNode, index, parent: MdNode | undefined) => {
      if (!node.identifier || !parent?.children || index == null) return;
      const id = node.identifier;
      let n = numberOf.get(id);
      if (n == null) {
        n = order.length + 1;
        numberOf.set(id, n);
        order.push(id);
      }
      const refs = refsOf.get(id) ?? [];
      const refId = refs.length === 0 ? `fnref-${id}` : `fnref-${id}-${refs.length + 1}`;
      refs.push(refId);
      refsOf.set(id, refs);
      parent.children[index] = {
        type: "brandFootnoteRef",
        data: { hName: FOOTNOTE_REF_TAG, hProperties: payloadProps({ id, n, refId }) },
      };
    });

    if (order.length === 0) return;

    // Pass 3 — emit the branded definition section at the document end. Each item
    // is a custom element; the definition BODY stays real mdast (rendered + safely
    // sanitized as normal prose), while every id/anchor lives on our React output.
    // Carry every occurrence's ref id so the item renders one back-ref per mention.
    const items: MdNode[] = order.map((id, i) => {
      const def = defs.get(id);
      const body: MdNode[] = def?.children
        ? def.children.map((c) => structuredClone(c))
        : [{ type: "paragraph", children: [{ type: "text", value: "Missing footnote." }] }];
      return {
        type: "brandFootnoteItem",
        data: {
          hName: FOOTNOTE_ITEM_TAG,
          hProperties: payloadProps({ id, n: i + 1, refs: refsOf.get(id) ?? [`fnref-${id}`] }),
        },
        children: body,
      };
    });

    root.children = root.children ?? [];
    root.children.push({
      type: "brandFootnoteList",
      data: { hName: FOOTNOTE_LIST_TAG },
      children: items,
    });
  };
}

/* ------------------------------------------------------------------ */
/* React renderers (registered on MarkdownPreview's components map)      */
/* ------------------------------------------------------------------ */

type TagProps = { node?: unknown; children?: ReactNode } & Record<string, unknown>;

function readPayload(rest: TagProps): FootnotePayload | null {
  const raw =
    (rest[FOOTNOTE_ATTR] as string | undefined) ?? (rest[FOOTNOTE_PROP] as string | undefined);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FootnotePayload;
  } catch {
    return null;
  }
}

/** Inline footnote marker — a quiet superscript same-page link. */
export function FootnoteRef({ node: _n, children: _c, ...rest }: TagProps) {
  const payload = readPayload(rest);
  if (!payload) return null;
  const { id, n, refId } = payload;
  return (
    <sup className="leading-none">
      <a
        id={refId ?? `fnref-${id}`}
        href={`#fn-${id}`}
        data-footnote-ref=""
        aria-label={`Footnote ${n}`}
        // #399 — a footnote marker is superscript body text: `-text` rung.
        className="px-0.5 font-medium text-primary-text underline tabular-nums hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {n}
      </a>
    </sup>
  );
}

/** A single footnote definition row — the `<li>` + one "↩" back-ref per mention. */
export function FootnoteItem({ node: _n, children, ...rest }: TagProps) {
  const payload = readPayload(rest);
  if (!payload) return null;
  const { id, n, refs } = payload;
  // One back-ref per occurrence (GFM behavior); a single mention → a lone "↩".
  const refList = refs && refs.length > 0 ? refs : [`fnref-${id}`];
  return (
    <li
      id={`fn-${id}`}
      className="scroll-mt-4 ps-1 [&>p]:m-0 [&>p]:inline [&>p]:text-caption [&>p]:text-muted-foreground"
    >
      {children}{" "}
      {refList.map((refId, i) => (
        <a
          key={refId}
          href={`#${refId}`}
          data-footnote-backref=""
          aria-label={
            refList.length > 1
              ? `Back to reference ${n}, mention ${i + 1}`
              : `Back to reference ${n}`
          }
          className="ms-0.5 inline-flex items-center text-muted-foreground no-underline hover:text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span aria-hidden="true">↩</span>
          {refList.length > 1 ? (
            <sub className="ms-0.5 leading-none tabular-nums">{i + 1}</sub>
          ) : null}
        </a>
      ))}
    </li>
  );
}

export type FootnoteListProps = HTMLAttributes<HTMLElement>;

/**
 * The branded footnote-definition section. One focal separation gesture — a top
 * `Separator` (the classic footnote rule) — over a quiet label + the definition
 * list; no fill, no border box. The label id is per-instance (`useId`) so two
 * previews on one page don't collide.
 */
export const FootnoteList = forwardRef<HTMLElement, FootnoteListProps>(function FootnoteList(
  { className, children, ...props },
  ref,
) {
  const labelId = useId();
  return (
    <section ref={ref} aria-labelledby={labelId} className={cn("mt-8", className)} {...props}>
      <Separator className="mb-3" />
      <p id={labelId} className="mb-2 text-meta font-medium text-muted-foreground">
        Footnotes
      </p>
      <ol className="list-decimal space-y-1.5 ps-6 text-caption text-muted-foreground marker:text-muted-foreground">
        {children}
      </ol>
    </section>
  );
});
