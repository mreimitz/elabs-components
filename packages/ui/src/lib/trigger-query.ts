/**
 * The generic, component-agnostic half of a trigger-driven inline palette —
 * "is the caret sitting inside a `trigger + query` run, and how do I splice a
 * chosen result back in". Zero React, zero DOM, zero knowledge of mentions.
 *
 * Lifted out of `MentionInput`'s private `findQuery`/`isWordBoundary`
 * (docs/decisions/2026-09-01-brainless-adoption-architecture.md § 5) so a second
 * trigger-driven surface (a slash-command palette) reuses the algorithm instead
 * of re-implementing it. `MentionInput` consumes this module unchanged — see
 * `mention-input.tsx`.
 */

/**
 * Where a trigger character is allowed to START a query.
 *
 * `"word"`       — index 0, or preceded by whitespace / "(" / "[".  (`MentionInput`'s
 *                  behaviour, unchanged — an "@" inside an email address must not open a popup.)
 * `"line-start"` — index 0, or preceded by "\n".  (A slash palette: "/help" opens, "cd /usr" does not.)
 */
export type TriggerBoundary = "word" | "line-start";

/** An in-progress `trigger + query` run under the caret. */
export interface TriggerQuery {
  /** Offset of the trigger character in `text`. */
  start: number;
  /** The query WITHOUT the trigger character. */
  query: string;
}

export interface FindTriggerQueryOptions {
  /** @default "word" */
  boundary?: TriggerBoundary;
  /**
   * Veto a candidate whose trigger character has already been consumed by a
   * committed token — `MentionInput` passes `mentionAt(...)` here so an
   * inserted "@Ada Lovelace" cannot re-open the popup. Omit when there are no
   * committed tokens (a slash palette has none).
   */
  isTriggerConsumed?: (start: number) => boolean;
}

function isBoundary(text: string, index: number, boundary: TriggerBoundary): boolean {
  if (index === 0) return true;
  const previous = text[index - 1] ?? "";
  if (boundary === "line-start") return previous === "\n";
  return /\s/.test(previous) || previous === "(" || previous === "[";
}

/**
 * Is the caret sitting inside a `trigger + query` run?
 *
 * DERIVED from committed text + caret, never intercepted at keydown — a
 * keydown-driven trigger must `preventDefault()` every printable character and
 * re-insert it by hand, which destroys IME composition, native undo, spellcheck
 * and paste. Deriving means the popup opens identically whether the trigger
 * arrived by typing, pasting, an IME commit, or a click that moved the caret
 * back into a half-typed query.
 */
export function findTriggerQuery(
  text: string,
  caret: number,
  trigger: string,
  options?: FindTriggerQueryOptions,
): TriggerQuery | null {
  const boundary = options?.boundary ?? "word";

  if (caret < trigger.length) return null;
  const start = text.lastIndexOf(trigger, caret - trigger.length);
  if (start < 0) return null;

  const query = text.slice(start + trigger.length, caret);
  if (/\s/.test(query)) return null;
  if (!isBoundary(text, start, boundary)) return null;
  if (options?.isTriggerConsumed?.(start)) return null;

  return { start, query };
}

/** The plain-text half of an insert: splice `insertText` over the run, and say where the caret lands. */
export function replaceTriggerRun(
  text: string,
  queryStart: number,
  caret: number,
  insertText: string,
): { text: string; caret: number } {
  const nextText = text.slice(0, queryStart) + insertText + text.slice(caret);
  return { text: nextText, caret: queryStart + insertText.length };
}
