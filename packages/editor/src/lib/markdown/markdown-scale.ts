/**
 * markdown-scale — the markdown visual scale shared by BOTH renderers of the
 * brand markdown dialect:
 *
 *   • the Streamdown preview (React: `prose/prose.tsx` Heading + the `components` map)
 *   • the Milkdown WYSIWYG editor (CSS: `markdown-editor/markdown-editor.css`)
 *
 * The two are independent renderers (the editor is ProseMirror-native by design and
 * cannot import the React components — see directive-nodes.ts), so without a shared,
 * machine-consumable scale they drift: switching Source → Split → Preview-edit
 * visibly re-skins headings / measure (issue #18).
 *
 * Since #188 the numbers are DERIVED, not re-hardcoded: @elabs-ai/components-ui owns the canonical
 * reading scale (`PROSE_HEADING_REM` in `components/typography/prose.tsx`, itself
 * pinned to the `--text-<role>` tokens where the rungs coincide). This module is the
 * editor-side seam: it re-exports those numbers and emits them as CSS variables (set
 * on `.milkdown-host` via `markdownScaleVars()`); `markdown-scale.test.ts` fails the
 * moment either renderer diverges.
 */
import {
  PROSE_HEADING_REM,
  PROSE_HEADING_TRACKING,
  PROSE_HEADING_WEIGHT,
} from "@elabs-ai/components-ui";

export type MarkdownHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Canonical heading font-size per level, in rem — derived from the @elabs-ai/components-ui
 * prose reading scale (h2/h4/h5/h6 == the title/subtitle/body role rems;
 * h1/h3 are intermediate reading rungs).
 */
export const MARKDOWN_HEADING_REM: Record<MarkdownHeadingLevel, number> = PROSE_HEADING_REM;

/** Canonical heading weight (Tailwind `font-semibold`) — derived from @elabs-ai/components-ui. */
export const MARKDOWN_HEADING_WEIGHT = PROSE_HEADING_WEIGHT;

/** Canonical heading letter-spacing (Tailwind `tracking-tight`) — derived from @elabs-ai/components-ui. */
export const MARKDOWN_HEADING_TRACKING = PROSE_HEADING_TRACKING;

/** Canonical reading measure (max content width). Mirrors `max-w-3xl`. */
export const MARKDOWN_MEASURE = "48rem";

/**
 * The scale as CSS custom properties, to set on the editor host (`.milkdown-host`)
 * so `markdown-editor.css` reads the SAME numbers as the prose components instead of
 * hardcoding its own. Spread onto a `style` prop:
 *   `<div className="milkdown-host" style={markdownScaleVars()} />`
 */
export function markdownScaleVars(): Record<string, string> {
  return {
    "--md-h1": `${MARKDOWN_HEADING_REM[1]}rem`,
    "--md-h2": `${MARKDOWN_HEADING_REM[2]}rem`,
    "--md-h3": `${MARKDOWN_HEADING_REM[3]}rem`,
    "--md-h4": `${MARKDOWN_HEADING_REM[4]}rem`,
    "--md-h5": `${MARKDOWN_HEADING_REM[5]}rem`,
    "--md-h6": `${MARKDOWN_HEADING_REM[6]}rem`,
    "--md-heading-weight": String(MARKDOWN_HEADING_WEIGHT),
    "--md-heading-tracking": MARKDOWN_HEADING_TRACKING,
    "--md-measure": MARKDOWN_MEASURE,
  };
}
