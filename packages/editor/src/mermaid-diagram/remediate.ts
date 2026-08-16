/**
 * Mermaid reserved-identifier remediation.
 *
 * Authors routinely use flowchart KEYWORDS as node ids (`graph[Microsoft
 * Graph]`, `end[End]`, `class[...]`) — mermaid hard-fails ("got 'GRAPH'")
 * even though the intent is unambiguous. Instead of punting the error to the
 * reader, the diagram component extracts the offending token from the parse
 * error, rewrites that identifier with a trailing underscore, and retries
 * once. Labels, quoted strings and edge text (`|…|`) are never touched —
 * only the invisible id changes.
 */

export const FLOWCHART_RESERVED = new Set([
  "graph",
  "flowchart",
  "subgraph",
  "end",
  "style",
  "linkstyle",
  "classdef",
  "class",
  "click",
  "direction",
  "default",
  "state",
]);

/** Pull the offending token out of a mermaid parse error ("… got 'GRAPH'"). */
export function offendingToken(errorMessage: string): string | null {
  const m = /got '([A-Za-z_]+)'/.exec(errorMessage);
  return m ? m[1]!.toLowerCase() : null;
}

/** A true diagram declaration line: keyword + direction and nothing else. */
const DECLARATION_RE = /^(graph|flowchart)\s+(tb|td|bt|rl|lr)\s*;?\s*$/;

/**
 * Replace `re` matches only OUTSIDE label/quote/edge-text segments:
 * `[...]`, `(...)`, `{...}`, `"..."` and `|...|` contents stay verbatim.
 */
function replaceOutsideLabels(line: string, re: RegExp, repl: string): string {
  let out = "";
  let buf = "";
  let depth = 0;
  let inQuote = false;
  let inPipe = false;

  const flush = () => {
    out += buf.replace(re, repl);
    buf = "";
  };

  for (const ch of line) {
    if (inQuote) {
      out += ch;
      if (ch === '"') inQuote = false;
      continue;
    }
    if (depth === 0 && ch === "|") {
      if (!inPipe) flush();
      inPipe = !inPipe;
      out += ch;
      continue;
    }
    if (inPipe) {
      out += ch;
      continue;
    }
    if (ch === '"') {
      flush();
      out += ch;
      inQuote = true;
      continue;
    }
    if (ch === "[" || ch === "(" || ch === "{") {
      if (depth === 0) flush();
      depth++;
      out += ch;
      continue;
    }
    if (ch === "]" || ch === ")" || ch === "}") {
      if (depth > 0) depth--;
      if (depth === 0) {
        out += ch;
        continue;
      }
      out += ch;
      continue;
    }
    if (depth === 0) buf += ch;
    else out += ch;
  }
  flush();
  return out;
}

/**
 * Rewrite a reserved word used as a node id to `<word>_`. Structural keyword
 * positions are preserved: declaration lines (`flowchart TD`), `subgraph`
 * keyword lines and lone `end` terminators stay intact. Returns the
 * rewritten source, or null when nothing remediable changed.
 */
export function remediateReservedIds(chart: string, token: string): string | null {
  const t = token.toLowerCase();
  if (!FLOWCHART_RESERVED.has(t)) return null;
  const re = new RegExp(`\\b${t}\\b`, "gi");
  let changed = false;
  const repl = `${t}_`;

  const out = chart
    .split("\n")
    .map((line) => {
      const trimmed = line.trim().toLowerCase();
      if (trimmed === t) return line; // lone keyword (e.g. subgraph terminator `end`)
      if (DECLARATION_RE.test(trimmed)) return line; // `graph TD` / `flowchart LR`
      if (t === "subgraph" && trimmed.startsWith("subgraph")) return line;
      const next = replaceOutsideLabels(line, re, repl);
      if (next !== line) changed = true;
      return next;
    })
    .join("\n");

  return changed ? out : null;
}
