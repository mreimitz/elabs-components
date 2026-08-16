/**
 * Typed-`/` trigger detection for the Monaco source pane (the conflict-free way
 * to open the brand block menu — no keybinding, mirrors the WYSIWYG `/` trigger).
 *
 * Pure + Monaco-free so it unit-tests without the engine. The workspace feeds it
 * the just-edited line + the column the `/` landed on (from a Monaco content
 * change) and, when it's a valid trigger spot, gets back the model range of that
 * `/` so the menu can replace it with the inserted block (or delete it on cancel).
 *
 * A `/` is a valid trigger only at a textblock start (column 1) or right after
 * whitespace — so a `/` inside a word, a URL, or a path (`a/b`, `http://`) never
 * hijacks typing, matching the WYSIWYG `triggerAllowed` rule.
 */

/** A Monaco `IRange`-shaped span (kept structural so this module imports no monaco). */
export interface SlashTriggerRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

/**
 * Given the 1-based `line` number, the FULL line content AFTER the `/` was typed,
 * and the 1-based `slashColumn` the `/` now occupies, return the range covering
 * that `/` when it is a valid trigger — otherwise `null`.
 */
export function slashTriggerRange(
  line: number,
  lineContent: string,
  slashColumn: number,
): SlashTriggerRange | null {
  // Sanity: the character at the reported column must actually be the `/`.
  if (lineContent.charAt(slashColumn - 1) !== "/") return null;
  // Allowed at the very start of the line, or immediately after whitespace.
  if (slashColumn > 1) {
    const before = lineContent.charAt(slashColumn - 2);
    if (!/\s/.test(before)) return null;
  }
  return {
    startLineNumber: line,
    startColumn: slashColumn,
    endLineNumber: line,
    endColumn: slashColumn + 1,
  };
}
