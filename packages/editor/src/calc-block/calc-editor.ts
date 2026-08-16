/**
 * Shared, engine-agnostic helpers for the calc AUTHORING surfaces (#220).
 *
 * Both editor surfaces — the Monaco source editor and the Milkdown WYSIWYG
 * editor — need the same things: find the ```calc fences, ask the consumer's
 * hooks for highlight tokens + results, and turn those into decorations. The
 * decoration *application* differs per engine (Monaco `inlineClassName` vs a
 * ProseMirror `DecorationSet`), but the *logic* here is pure and shared, so it is
 * unit-testable without rendering either engine (Monaco can't render in jsdom).
 *
 * Governing rule (D5): the library decorates, the consumer computes. Nothing here
 * does any math — it only calls the consumer-supplied {@link CalcEditorHooks} and
 * shapes the results. A throwing hook degrades to "no decorations" rather than
 * blanking the editor (mirrors how `CalcBlock` never throws on a bad block).
 */
import type {
  CalcContext,
  CalcEditorHooks,
  CalcLineResult,
  CalcSheet,
  CalcToken,
  CalcTokenKind,
} from "./types";

/** The fenced-code-block info string this feature decorates. */
export const CALC_FENCE_LANG = "calc";

/** A located ```calc fence within a markdown document. Lines are 1-based. */
export interface CalcFence {
  /** 1-based line of the opening fence (` ```calc `). */
  openLine: number;
  /** 1-based line of the closing fence, or `lines + 1` when unterminated. */
  closeLine: number;
  /** 1-based line of the first body line (`openLine + 1`). */
  bodyStartLine: number;
  /** 1-based line of the last body line (`closeLine - 1`); `< bodyStartLine` if empty. */
  bodyEndLine: number;
  /** The fence body (body lines joined by `"\n"`). */
  source: string;
}

const OPEN_FENCE = /^(\s*)(`{3,}|~{3,})[ \t]*calc\b[ \t]*$/i;

/**
 * Scan a markdown string for ```calc fences. Tolerant of leading indentation,
 * `~~~` fences, and an unterminated trailing fence (treated as running to EOF) —
 * which is the normal state while the author is still typing the block.
 */
export function findCalcFences(text: string): CalcFence[] {
  const lines = text.split("\n");
  const fences: CalcFence[] = [];
  let i = 0;
  while (i < lines.length) {
    const open = OPEN_FENCE.exec(lines[i] ?? "");
    if (!open) {
      i++;
      continue;
    }
    const run = open[2] ?? "```";
    const marker = run[0] ?? "`";
    const closeRe = new RegExp(`^\\s*\\${marker}{${run.length},}\\s*$`);
    let j = i + 1;
    while (j < lines.length && !closeRe.test(lines[j] ?? "")) j++;
    const openLine = i + 1;
    const closeLine = j < lines.length ? j + 1 : lines.length + 1;
    fences.push({
      openLine,
      closeLine,
      bodyStartLine: openLine + 1,
      bodyEndLine: closeLine - 1,
      source: lines.slice(i + 1, j).join("\n"),
    });
    i = j + 1;
  }
  return fences;
}

/** One body line's text plus its character offset from the fence-body start. */
export interface CalcLineSpan {
  text: string;
  /** Character offset of this line's first char within `source` (newlines counted). */
  offset: number;
}

/** Lay out a fence body into per-line `{ text, offset }` — used to map columns to positions. */
export function calcLineLayout(source: string): CalcLineSpan[] {
  const spans: CalcLineSpan[] = [];
  let offset = 0;
  for (const text of source.split("\n")) {
    spans.push({ text, offset });
    offset += text.length + 1; // + the newline
  }
  return spans;
}

/** Evaluate `source` to a per-line result map (1-based line → result). Never throws. */
export function resolveResults(
  hooks: CalcEditorHooks,
  source: string,
  ctx?: CalcContext,
): Map<number, CalcLineResult> {
  const map = new Map<number, CalcLineResult>();
  if (!hooks.evaluate) return map;
  let sheet: CalcSheet;
  try {
    sheet = hooks.evaluate(source, ctx);
  } catch {
    return map;
  }
  for (const r of sheet.results ?? []) map.set(r.line, r);
  return map;
}

/**
 * Resolve highlight tokens for every body line. Prefers the per-line `tokenize`
 * hook (cheap, works mid-typing on a line that doesn't yet evaluate); falls back
 * to `evaluate`'s per-line `tokens` so a consumer who only wrote `evaluate` still
 * gets highlighting. Returns one `CalcToken[]` per line. Never throws.
 */
export function resolveHighlight(
  hooks: CalcEditorHooks,
  source: string,
  ctx?: CalcContext,
): CalcToken[][] {
  const lines = source.split("\n");
  if (hooks.tokenize) {
    const { tokenize } = hooks;
    return lines.map((line) => {
      try {
        return tokenize(line, ctx) ?? [];
      } catch {
        return [];
      }
    });
  }
  if (hooks.evaluate) {
    const byLine = resolveResults(hooks, source, ctx);
    return lines.map((_line, i) => byLine.get(i + 1)?.tokens ?? []);
  }
  return lines.map(() => []);
}

/** A resolved result inlay for one body line (the computed answer shown after it). */
export interface CalcInlay {
  /** 1-based line within the fence body. */
  lineNumber: number;
  /** The inlay text — `"= <display>"` for a value, `"error: …"` for a per-line error. */
  text: string;
  /** True when the line evaluated to an error rather than a value. */
  isError: boolean;
}

/** The inlay text for one result line, or `null` when there's nothing to show. */
export function inlayTextForResult(result: CalcLineResult | undefined): {
  text: string;
  isError: boolean;
} | null {
  if (!result) return null;
  if (result.error) return { text: `error: ${result.error.message}`, isError: true };
  if (result.value) return { text: `= ${result.value.display}`, isError: false };
  return null;
}

/** Resolve every body line's result inlay (skips lines with no value/error). */
export function resolveInlays(
  hooks: CalcEditorHooks,
  source: string,
  ctx?: CalcContext,
): CalcInlay[] {
  const byLine = resolveResults(hooks, source, ctx);
  const out: CalcInlay[] = [];
  for (const [lineNumber, result] of byLine) {
    const inlay = inlayTextForResult(result);
    if (inlay) out.push({ lineNumber, text: inlay.text, isError: inlay.isError });
  }
  out.sort((a, b) => a.lineNumber - b.lineNumber);
  return out;
}

/**
 * Class string for a highlight token. Hue comes from the `--calc-*` tokens (via
 * `calc-editor.css`), but — exactly like `CalcBlock.tokenClass` — hue is never
 * the SOLE cue: a `var-def` carries weight and an unresolved token a dotted
 * underline, so roles stay distinct in the high-contrast theme (where the calc
 * colors collapse toward the foreground).
 */
export function calcTokenClassName(kind: CalcTokenKind, resolved: boolean): string {
  const base = `brand-calc-tok brand-calc-tok--${kind}`;
  return resolved ? base : `${base} brand-calc-tok--unresolved`;
}

/** The identifier prefix immediately before `column` in `line` (the word being typed). */
export function identifierPrefix(line: string, column: number): string {
  const upto = line.slice(0, Math.max(0, column));
  const m = /[A-Za-z_][A-Za-z0-9_]*$/.exec(upto);
  return m ? m[0] : "";
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/**
 * An engine-neutral highlight span: a 1-based model line + 1-based start/end
 * columns (Monaco-style; `end` exclusive) + the CSS class. The Monaco layer maps
 * these to `monaco.Range` decorations; kept pure here so the column math is
 * unit-testable without rendering Monaco.
 */
export interface CalcDecorationSpec {
  lineNumber: number;
  startColumn: number;
  endColumn: number;
  className: string;
}

/**
 * Build highlight specs for one fence body. `bodyStartLine` is the 1-based model
 * line of the first body line; `bodyLineTexts` are the EOL-free line strings
 * (read from the model, so columns stay accurate regardless of CRLF/LF).
 */
export function calcDecorationSpecs(
  hooks: CalcEditorHooks,
  bodyStartLine: number,
  bodyLineTexts: string[],
  ctx?: CalcContext,
): CalcDecorationSpec[] {
  const tokensByLine = resolveHighlight(hooks, bodyLineTexts.join("\n"), ctx);
  const specs: CalcDecorationSpec[] = [];
  for (let i = 0; i < bodyLineTexts.length; i++) {
    const lineText = bodyLineTexts[i] ?? "";
    for (const t of tokensByLine[i] ?? []) {
      const start = clamp(t.start, 0, lineText.length);
      const end = clamp(t.end, start, lineText.length);
      if (end <= start) continue;
      specs.push({
        lineNumber: bodyStartLine + i,
        startColumn: start + 1,
        endColumn: end + 1,
        className: calcTokenClassName(t.kind, t.resolved),
      });
    }
  }
  return specs;
}

/** An engine-neutral inlay placement: a 1-based model line + end-of-line column. */
export interface CalcInlaySpec {
  lineNumber: number;
  /** 1-based column at the end of the line (where the inlay sits). */
  column: number;
  text: string;
  isError: boolean;
}

/** Build result-inlay specs for one fence body (positioned at each line's end). */
export function calcInlaySpecs(
  hooks: CalcEditorHooks,
  bodyStartLine: number,
  bodyLineTexts: string[],
  ctx?: CalcContext,
): CalcInlaySpec[] {
  return resolveInlays(hooks, bodyLineTexts.join("\n"), ctx).map((inlay) => {
    const i = inlay.lineNumber - 1;
    const lineText = bodyLineTexts[i] ?? "";
    return {
      lineNumber: bodyStartLine + i,
      column: lineText.length + 1,
      text: inlay.text,
      isError: inlay.isError,
    };
  });
}
