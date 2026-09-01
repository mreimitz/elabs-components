/**
 * The unified-diff line model behind `DiffView` (`@elabs-ai/components-ai`,
 * #102) and the terminal CLI look-alike family's own diff hunk (issue #117).
 *
 * Promoted here (not duplicated) because `@elabs-ai/components-ai` and
 * `@elabs-ai/components-terminal` are layer-2 DAG SIBLINGS and may not import
 * each other — `ui` is upstream of both
 * (docs/decisions/2026-09-01-brainless-adoption-architecture.md § 4). This
 * module is the shiki-free half: the line shape, the marker glyph and the
 * screen-reader polarity label. Intra-line syntax highlighting (Shiki) and
 * the diff's presentational chrome stay in `@elabs-ai/components-ai`'s
 * `diff-view.tsx` — `ui` does not depend on Shiki and never will for one
 * component (see the decision doc § 3).
 *
 * The `DiffLine` model and the polarity-prefix technique are adapted from
 * `theswerd/brainless` (MIT) — see `ATTRIBUTION.md`.
 */

/** What role a line plays in the diff. */
export type DiffLineType = "add" | "del" | "context" | "hunk" | "meta";

/** One line of a unified diff. Absent gutter numbers are load-bearing (see below). */
export interface DiffLine {
  type: DiffLineType;
  /** Line number in the original file. Absent on `add` — there is no old line. */
  oldNumber?: number;
  /** Line number in the new file. Absent on `del` — there is no new line. */
  newNumber?: number;
  /** The line's text, without its leading `+` / `-` / ` ` marker. */
  text: string;
}

/**
 * The single-character marker glyph for a real source line (`add`/`del`/
 * `context`). `hunk`/`meta` lines are diff headers, not source, and render
 * through a full-width row instead — this returns `""` for them.
 */
export function diffLineMarker(type: DiffLineType): string {
  switch (type) {
    case "add":
      return "+";
    case "del":
      return "−";
    case "context":
      return " ";
    default:
      return "";
  }
}

/**
 * The `ui` locale-message KEY (not the translated text) for the `sr-only`
 * screen-reader polarity word an `add`/`del` row carries ALONGSIDE its marker
 * glyph and its fill tint — colour is never the only channel (WCAG 1.4.1).
 * `undefined` for `context`/`hunk`/`meta`, which carry no polarity.
 */
export function diffLineAccessibleLabel(
  type: DiffLineType,
): "ai.diffView.addedLine" | "ai.diffView.removedLine" | undefined {
  if (type === "add") return "ai.diffView.addedLine";
  if (type === "del") return "ai.diffView.removedLine";
  return undefined;
}
