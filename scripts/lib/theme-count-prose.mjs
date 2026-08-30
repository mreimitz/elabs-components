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
 * both the word form ("all six themes") and the numeric form ("6 themes").
 * Returns `{ line, match, claimed }[]` (1-based line numbers).
 */
export function findThemeCountViolations(text, themeCount) {
  if (!themeCount) return [];
  const re = new RegExp(`\\b(${Object.keys(NUMBER_WORDS).join("|")}|\\d+)\\s+themes\\b`, "gi");
  const out = [];
  text.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(re)) {
      const token = m[1].toLowerCase();
      const claimed = NUMBER_WORDS[token] ?? Number(token);
      if (Number.isFinite(claimed) && claimed !== themeCount) {
        out.push({ line: i + 1, match: m[0], claimed });
      }
    }
  });
  return out;
}
