/**
 * css.mjs — comment handling and a tiny rule splitter shared by the token/theme rules.
 * Pure string helpers; no I/O. Loaded by rules, never itself a rule (not in rules/).
 */

/**
 * Blank `/* … *\/` comments, preserving length and newlines so offsets and line
 * numbers stay valid. Theme CSS documents the very declarations the rules scan
 * for (`--shadow-strength: 0`, `--info: it used to be…`), so parsing comments
 * produces false readings — blank first.
 */
export function blankComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

/**
 * Blank JS/TS block AND line comments, preserving newlines (`//` preceded by `:` is
 * kept, so `https://…` survives). Regex-level, not AST — a `//` inside a string
 * that is not a URL is also blanked, which only ever hides text, never invents it.
 */
export function blankJsComments(text) {
  return blankComments(text).replace(
    /(^|[^:])(\/\/[^\n]*)/g,
    (_, pre, c) => pre + c.replace(/./g, " "),
  );
}

/**
 * Remove CSS block comments, quote-aware: a comment cannot open inside a string, and
 * an `@source "…/**\/*.tsx"` glob contains a sequence a naive regex reads as an
 * empty comment. Newlines inside removed comments are kept.
 */
export function stripCssCommentsQuoteAware(text) {
  let out = "";
  let i = 0;
  let inString = null;
  while (i < text.length) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (ch === "\\" && i + 1 < text.length) {
        out += text[i + 1];
        i += 2;
        continue;
      }
      if (ch === inString) inString = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = ch;
      out += ch;
      i++;
      continue;
    }
    if (ch === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      const stop = end === -1 ? text.length : end + 2;
      out += text.slice(i, stop).replace(/[^\n]/g, "");
      i = stop;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/**
 * Split a stylesheet into `selector { body }` rules. Comments are blanked first;
 * at-rule wrappers (`@layer`, `@media`, `@supports`) are descended into, so nested
 * rules are seen. `start` is the selector's offset in the source.
 * @returns {{ selector: string, body: string, start: number }[]}
 */
export function ruleBlocks(css) {
  const src = blankComments(css);
  const rules = [];
  const walk = (start, end) => {
    let cursor = start;
    let selBegin = start;
    while (cursor < end) {
      const ch = src[cursor];
      if (ch === "{") {
        const selector = src.slice(selBegin, cursor);
        let depth = 0;
        let close = cursor;
        for (; close < end; close++) {
          if (src[close] === "{") depth++;
          else if (src[close] === "}" && --depth === 0) break;
        }
        if (selector.trim().startsWith("@")) walk(cursor + 1, close);
        else
          rules.push({
            selector,
            body: src.slice(cursor + 1, close),
            start: selBegin + (selector.length - selector.trimStart().length),
          });
        cursor = close + 1;
        selBegin = cursor;
      } else if (ch === "}" || ch === ";") {
        cursor++;
        if (ch === "}") selBegin = cursor;
      } else cursor++;
    }
  };
  walk(0, src.length);
  return rules;
}
