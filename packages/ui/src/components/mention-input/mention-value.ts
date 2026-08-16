import type { ReactNode } from "react";

/**
 * The pure offset algebra behind `MentionInput`.
 *
 * Chip atomicity in a real `<textarea>` is **selection arithmetic over a token
 * map**, not DOM nodes: the field holds ordinary text, and this module keeps a
 * parallel list of `{ id, label, start }` records honest as that text is edited,
 * pasted over and deleted. Nothing here touches React or the DOM, so every
 * acceptance criterion about backspace atomicity, caret skipping and the
 * `{ text, mentionedIds }` payload reduces to a unit test on these functions.
 */

/** One selectable roster entry. */
export interface MentionOption {
  /** Stable id — this is what `serializeMentions` emits. */
  id: string;
  /** Inserted verbatim after the trigger character. */
  label: string;
  /** Optional secondary line shown under the label. */
  description?: string;
  /** Optional leading glyph (avatar, icon). */
  icon?: ReactNode;
  /** Extra match terms, so "ada" can find "Ada Lovelace". */
  keywords?: string[];
  /** Rendered but not selectable. */
  disabled?: boolean;
}

/** A resolved mention inside `MentionValue.text`. */
export interface Mention {
  /** The option id this run refers to. */
  id: string;
  /** The label WITHOUT the trigger character. */
  label: string;
  /** Offset of the trigger character in `text`. */
  start: number;
}

/** The component's value: plain text plus the mentions it contains. */
export interface MentionValue {
  text: string;
  mentions: Mention[];
}

/** The result of inserting an option: the new value and where the caret goes. */
export interface InsertMentionResult {
  value: MentionValue;
  /** Offset immediately after the inserted token's trailing space. */
  caret: number;
}

/** Exclusive end offset of a mention's `trigger + label` run. */
export function mentionEnd(mention: Mention, trigger = "@"): number {
  return mention.start + trigger.length + mention.label.length;
}

/**
 * The mention whose half-open range `[start, end)` contains `index`, if any.
 *
 * Half-open on purpose: the offset one past the token is *outside* it, so a
 * caret sitting immediately after `@Ada Lovelace` is "next to" the mention
 * rather than "in" it. Backspace therefore asks about `caret - 1` and Delete
 * about `caret`, and both get an unambiguous answer.
 */
export function mentionAt(value: MentionValue, index: number, trigger = "@"): Mention | undefined {
  return value.mentions.find((m) => index >= m.start && index < mentionEnd(m, trigger));
}

/** Length of the longest common prefix of two strings. */
function commonPrefixLength(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[i] === b[i]) i++;
  return i;
}

/**
 * Re-derive the mention list after the text changed underneath it.
 *
 * The edit is treated as ONE contiguous replacement — which is what a
 * keystroke, a paste, a cut and a native undo all are. The common prefix and
 * common suffix bracket it; a mention entirely before the edit keeps its
 * offset, one entirely after it shifts by the length delta, and one the edit
 * reaches into is **dropped** (its text no longer spells the person's name, so
 * the id would be a lie).
 *
 * Every survivor is then **re-validated** against the new text: the run at its
 * offset must still read exactly `trigger + label`. That second pass is what
 * makes a multi-mention paste safe — the arithmetic alone can be fooled by a
 * replacement whose prefix/suffix boundaries land ambiguously, but a run that
 * no longer spells the token can never survive the check.
 */
export function remapMentions(prev: MentionValue, nextText: string, trigger = "@"): Mention[] {
  if (prev.text === nextText) return prev.mentions;

  const prevText = prev.text;
  const p = commonPrefixLength(prevText, nextText);

  const maxSuffix = Math.min(prevText.length, nextText.length) - p;
  let s = 0;
  while (s < maxSuffix && prevText[prevText.length - 1 - s] === nextText[nextText.length - 1 - s]) {
    s++;
  }

  /** End of the replaced span, in PREVIOUS coordinates. */
  const editEnd = prevText.length - s;
  const delta = nextText.length - prevText.length;

  const remapped: Mention[] = [];
  for (const mention of prev.mentions) {
    const end = mentionEnd(mention, trigger);
    if (end <= p) {
      remapped.push(mention);
    } else if (mention.start >= editEnd) {
      remapped.push({ ...mention, start: mention.start + delta });
    }
    // else: the edit reached into the token — drop it.
  }

  return remapped.filter(
    (m) => nextText.slice(m.start, mentionEnd(m, trigger)) === trigger + m.label,
  );
}

/**
 * Replace the in-progress `trigger + query` run with `trigger + label + " "`.
 *
 * `queryStart` is the offset of the trigger character; `caret` is where the
 * query ends. The trailing space is deliberate: it terminates the query so the
 * popup closes, and it gives the next word somewhere to start.
 */
export function insertMention(
  value: MentionValue,
  option: MentionOption,
  trigger: string,
  queryStart: number,
  caret: number,
): InsertMentionResult {
  const inserted = `${trigger}${option.label} `;
  const nextText = value.text.slice(0, queryStart) + inserted + value.text.slice(caret);
  const delta = inserted.length - (caret - queryStart);

  const mentions: Mention[] = [];
  for (const mention of value.mentions) {
    if (mentionEnd(mention, trigger) <= queryStart) {
      mentions.push(mention);
    } else if (mention.start >= caret) {
      mentions.push({ ...mention, start: mention.start + delta });
    }
    // else: it overlapped the query run being replaced — drop it.
  }
  mentions.push({ id: option.id, label: option.label, start: queryStart });
  mentions.sort((a, b) => a.start - b.start);

  return {
    value: {
      text: nextText,
      mentions: mentions.filter(
        (m) => nextText.slice(m.start, mentionEnd(m, trigger)) === trigger + m.label,
      ),
    },
    caret: queryStart + inserted.length,
  };
}

/**
 * The serialization contract a consumer gets out: the raw text plus the option
 * ids it references, **deduped** and in **document order** (two mentions of the
 * same person yield one id).
 */
export function serializeMentions(value: MentionValue): { text: string; mentionedIds: string[] } {
  const ordered = [...value.mentions].sort((a, b) => a.start - b.start);
  const mentionedIds: string[] = [];
  const seen = new Set<string>();
  for (const mention of ordered) {
    if (seen.has(mention.id)) continue;
    seen.add(mention.id);
    mentionedIds.push(mention.id);
  }
  return { text: value.text, mentionedIds };
}

/**
 * Case-insensitive substring match over `label` and `keywords`. An empty query
 * matches everything, so the full roster shows the moment the trigger is typed.
 */
export function defaultMentionFilter(option: MentionOption, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return true;
  if (option.label.toLowerCase().includes(q)) return true;
  return (option.keywords ?? []).some((k) => k.toLowerCase().includes(q));
}
