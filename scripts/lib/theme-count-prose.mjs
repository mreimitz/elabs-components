/**
 * scripts/lib/theme-count-prose.mjs — shared "does this prose claim a stale theme
 * count" detector.
 *
 * Extracted from check-docs-accuracy.mjs (#64) so a second gate scanning a
 * DIFFERENT file set (check-skills-currency.mjs, #29 — the playbook/skill/plugin
 * prose check-docs-accuracy.mjs's `.md`-only walk never reaches) can reuse the
 * exact same regex instead of hand-copying it. Pure, dependency-free.
 */

export const NUMBER_WORDS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

/**
 * Lines in `text` claiming a theme COUNT that disagrees with `themeCount`. Handles
 * both the word form ("all six themes") and the numeric form ("6 themes") —
 * INCLUDING when an adjective sits between the number and "themes" ("three
 * shipped themes", "3 reference themes") or a markdown soft line-wrap splits the
 * number word from "themes" across two lines ("all three\nshipped themes").
 * Returns `{ line, match, claimed }[]` (1-based line numbers in the ORIGINAL text).
 *
 * Three techniques make this robust to both gaps (#29):
 *  1. The regex tolerates 0-2 intervening words between the number and "themes"
 *     (`(?:\s+\S+){0,2}?`, non-greedy so it prefers the shortest span).
 *  2. Matching runs on `text` with every `\n` replaced by a single space — a
 *     1-for-1 substitution, so character OFFSETS are unchanged from the
 *     original string. That lets a match span a line-wrap while still letting
 *     us recover the correct 1-based line number by counting newlines in the
 *     original text before the match's offset.
 *  3. A negative lookbehind (`(?<![\d.:-])`) refuses to start a match on a digit
 *     that is really part of a LARGER numeral — a markdown heading/section
 *     number ("### 5.1 Your own themes"), a date ("2026-08-16 both reference
 *     themes go further"), or a contrast ratio ("4.5:1 in all themes").
 *     Widening the intervening-word window (point 1) made all three collide
 *     with an unrelated "themes" mention later in the same sentence; this
 *     closes that hole without narrowing the window back down.
 */
export function findThemeCountViolations(text, themeCount) {
  if (!themeCount) return [];
  const re = new RegExp(
    `(?<![\\d.:-])\\b(${Object.keys(NUMBER_WORDS).join("|")}|\\d+)\\b(?:\\s+\\S+){0,2}?\\s+themes\\b`,
    "gi",
  );
  const joined = text.replace(/\n/g, " ");
  const out = [];
  for (const m of joined.matchAll(re)) {
    const token = m[1].toLowerCase();
    const claimed = NUMBER_WORDS[token] ?? Number(token);
    if (Number.isFinite(claimed) && claimed !== themeCount) {
      const line = text.slice(0, m.index).split("\n").length;
      out.push({ line, match: m[0].replace(/\s+/g, " "), claimed });
    }
  }
  return out;
}
