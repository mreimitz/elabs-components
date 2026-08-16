"use client";

/**
 * Math via `remark-math` + KaTeX (`$inline$`, and `$$block$$` on its own lines).
 *
 * `remark-math` parses `$…$` / `$$…$$` into `inlineMath` / `math` mdast nodes,
 * which have NO mdast→hast handler (they'd otherwise degrade to literal text). So
 * `remarkBrandMath` rewrites them into our own `brand-math` / `brand-math-inline`
 * elements carrying the raw TeX, and the React renderers turn that into KaTeX.
 *
 * SECURITY: the TeX is untrusted input, so KaTeX runs with `trust: false` (blocks
 * `\href`/`\url`/class injection), a bounded `maxExpand` (caps macro expansion —
 * the `\def`-bomb DoS guard), and `throwOnError: false` (a bad expression renders
 * a contained error, never crashes the page). a11y: `output: "htmlAndMathml"`
 * emits MathML (read by assistive tech) alongside the visual HTML.
 */
import { cn } from "@elabs/components-ui/lib/cn";
import katex from "katex";
import { useMemo, type HTMLAttributes } from "react";
import { visit } from "unist-util-visit";

/** Block math element (`$$…$$`). */
export const MATH_BLOCK_TAG = "brand-math";
/** Inline math element (`$…$`). */
export const MATH_INLINE_TAG = "brand-math-inline";
/** hast property carrying the raw TeX (rendered as `data-tex`). */
export const MATH_PROP = "dataTex";
const MATH_ATTR = "data-tex";

/** Cap macro expansion — bounds `\def`-style expansion against untrusted input. */
const MAX_EXPAND = 1000;

interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
  data?: { hName?: string; hProperties?: Record<string, unknown> };
}

/**
 * Rewrite `inlineMath` / `math` (from remark-math) into branded elements carrying
 * the raw TeX. Runs AFTER `remarkMath` in the plugin array.
 */
export function remarkBrandMath() {
  return (tree: unknown) => {
    visit(tree as never, (node: MdNode, index: number | undefined, parent: MdNode | undefined) => {
      if (node.type !== "inlineMath" && node.type !== "math") return;
      if (!parent?.children || index == null) return;
      const display = node.type === "math";
      const tex = typeof node.value === "string" ? node.value : "";
      parent.children[index] = {
        type: display ? "brandMathBlock" : "brandMathInline",
        data: {
          hName: display ? MATH_BLOCK_TAG : MATH_INLINE_TAG,
          hProperties: { [MATH_PROP]: tex },
        },
      };
    });
  };
}

/* ------------------------------------------------------------------ */
/* React renderers                                                      */
/* ------------------------------------------------------------------ */

type TagProps = { node?: unknown; children?: React.ReactNode } & Record<string, unknown>;

function readTex(rest: TagProps): string {
  return (rest[MATH_ATTR] as string | undefined) ?? (rest[MATH_PROP] as string | undefined) ?? "";
}

/** Render TeX to a KaTeX HTML string (safe options); never throws. */
function renderKatex(tex: string, displayMode: boolean): { html: string; error: boolean } {
  try {
    return {
      html: katex.renderToString(tex, {
        displayMode,
        throwOnError: false,
        errorColor: "var(--destructive)",
        trust: false,
        maxExpand: MAX_EXPAND,
        strict: "ignore",
        output: "htmlAndMathml",
      }),
      error: false,
    };
  } catch {
    return { html: "", error: true };
  }
}

export interface MathProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** Raw TeX source. */
  tex: string;
}

/** Inline math (`$…$`) → KaTeX, in the text flow. */
export function MathInline({ tex, className, ...props }: MathProps) {
  const { html, error } = useMemo(() => renderKatex(tex, false), [tex]);
  if (error) {
    return (
      <code
        className={cn("text-destructive-text", className)}
        aria-label={`Math (could not render): ${tex}`}
        title="Could not render math"
        {...props}
      >
        {tex}
      </code>
    );
  }
  return (
    <span
      role="math"
      // The raw TeX is a universally-readable fallback name for AT that does not
      // process the embedded MathML; MathML-capable AT reads the MathML instead.
      aria-label={tex}
      className={cn("inline-block align-middle", className)}
      // KaTeX output is generated with trust:false + bounded maxExpand (safe).
      dangerouslySetInnerHTML={{ __html: html }}
      {...props}
    />
  );
}

/** Block math (`$$…$$`) → centered display KaTeX. */
export function MathBlock({ tex, className, ...props }: MathProps) {
  const { html, error } = useMemo(() => renderKatex(tex, true), [tex]);
  if (error) {
    return (
      <pre
        className={cn(
          "overflow-x-auto rounded-md bg-surface-muted p-3 text-destructive-text",
          className,
        )}
        aria-label={`Math (could not render): ${tex}`}
        title="Could not render math"
        {...props}
      >
        <code>{tex}</code>
      </pre>
    );
  }
  return (
    <div
      role="math"
      aria-label={tex}
      className={cn("my-3 overflow-x-auto text-center", className)}
      dangerouslySetInnerHTML={{ __html: html }}
      {...props}
    />
  );
}

/** Components-map renderer for the inline math element. */
export function MathInlineTag({ node: _n, children: _c, ...rest }: TagProps) {
  return <MathInline tex={readTex(rest)} />;
}

/** Components-map renderer for the block math element. */
export function MathBlockTag({ node: _n, children: _c, ...rest }: TagProps) {
  return <MathBlock tex={readTex(rest)} />;
}
