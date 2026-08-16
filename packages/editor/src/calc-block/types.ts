/**
 * CalcBlock contracts — the shape the consumer's `evaluate` hook returns.
 *
 * The library RENDERS; the consumer EVALUATES. The math engine is app/domain
 * logic and must NOT live in the design system — so these are pure types and the
 * library never bundles a calculator (mirrors how `resolveUrl` keeps URL
 * resolution in the consumer). A consumer produces a `CalcSheet` from a ```calc
 * source; CalcBlock paints it.
 */

export type CalcValueKind =
  | "number"
  | "quantity"
  | "currency"
  | "date"
  | "duration"
  | "percent"
  | "text"
  | "error";

/** A typed result value; `display` is the locale-formatted, tabular-ready string. */
export interface CalcValue {
  kind: CalcValueKind;
  raw: number | string;
  unit?: string;
  display: string;
}

export type CalcTokenKind =
  | "number"
  | "unit"
  | "currency"
  | "operator"
  | "function"
  | "constant"
  | "comment"
  | "var-def"
  | "var-ref"
  | "line-ref"
  | "unknown";

/** One highlighted span within a source line — 0-based columns, `end` exclusive. */
export interface CalcToken {
  start: number;
  end: number;
  kind: CalcTokenKind;
  /** `false` → a non-fatal warning style (unknown identifier / dangling ref). */
  resolved: boolean;
}

/**
 * Presentation hint: a rule (horizontal divider) drawn below a row — a `"dotted"`
 * hairline, a `"single"` solid line, or a `"double"` line (e.g. above a subtotal).
 * Pure presentation: the library renders it; the evaluator decides which rows get one.
 */
export type CalcRule = "dotted" | "single" | "double";

/**
 * Presentation hint: tint a row's background with a semantic status wash
 * (theme-safe `bg-<token>/10`, matching the house status vocabulary). `"muted"`
 * is a neutral, non-status tint. The evaluator decides; the library paints.
 */
export type CalcTint = "primary" | "success" | "warning" | "destructive" | "info" | "muted";

/** One evaluated source line: its highlight tokens, and a value OR an error. */
export interface CalcLineResult {
  /** 1-based line within the calc source. */
  line: number;
  tokens: CalcToken[];
  value?: CalcValue;
  /** A per-line error rendered inline; never thrown. */
  error?: { message: string };
  /** Presentation hint: draw a rule (divider) below this row. */
  rule?: CalcRule;
  /** Presentation hint: tint this row's background with a semantic wash. */
  tint?: CalcTint;
}

export interface CalcSheet {
  results: CalcLineResult[];
  /** Running total for the block. */
  total?: CalcValue;
}

export interface CalcContext {
  docPath?: string;
}

/** The consumer-supplied evaluator (sync, like `resolveUrl`). */
export type EvaluateCalc = (source: string, ctx?: CalcContext) => CalcSheet;

/* ------------------------------------------------------------------------- *
 * Authoring hooks (#220) — the EDITOR side of calc.
 *
 * The render side (`CalcBlock`/`CalcInline`) takes `evaluate`; the editor side
 * adds live highlighting + autocomplete + result inlays inside ```calc fences,
 * in both the Monaco source surface and the Milkdown WYSIWYG surface. Same
 * governing rule: the library DECORATES, the consumer COMPUTES — these are pure
 * function types and the package bundles no calc engine (mirrors `resolveUrl`).
 * ------------------------------------------------------------------------- */

/**
 * Tokenize ONE calc source line into highlight spans (the columns the library
 * paints). Called per line, so the returned {@link CalcToken} `start`/`end`
 * columns are relative to `line` — the same shape `evaluate` already returns on
 * each `CalcLineResult.tokens`. Sync, like `resolveUrl`.
 */
export type CalcTokenize = (line: string, ctx?: CalcContext) => CalcToken[];

/** A completion category — drives the icon (Monaco) / glyph + label (WYSIWYG). */
export type CalcCompletionKind =
  | "variable"
  | "function"
  | "unit"
  | "currency"
  | "constant"
  | "reference"
  | "keyword"
  | "snippet";

/** One autocomplete suggestion offered inside a ```calc fence. */
export interface CalcCompletion {
  /** Text shown in the completion list. */
  label: string;
  /** Text inserted when the item is chosen (replaces the typed `prefix`). */
  insert: string;
  /** Secondary detail shown muted beside the label (e.g. a type or preview). */
  detail?: string;
  /** Category; selects the suggestion icon. Defaults to `"variable"`. */
  kind?: CalcCompletionKind;
}

/** What the editor knows at the caret when it asks the consumer for completions. */
export interface CalcCompletionContext extends CalcContext {
  /** The full calc fence body (all lines). */
  source: string;
  /** The current line's text (the line the caret is on). */
  line: string;
  /** 1-based line of the caret within the fence body. */
  lineNumber: number;
  /** 0-based caret column within `line`. */
  column: number;
  /** The identifier characters immediately before the caret (the word typed). */
  prefix: string;
}

/** Suggest completions at the caret inside a ```calc fence (sync). */
export type CalcComplete = (ctx: CalcCompletionContext) => CalcCompletion[];

/**
 * The opt-in authoring hooks threaded onto `MarkdownEditor` / `MarkdownWorkspace`
 * via the `calc` prop (off by default). Each capability is independent:
 *   - `tokenize` → syntax highlighting (falls back to `evaluate`'s per-line
 *     `tokens` when omitted, so a consumer who already wrote `evaluate` gets
 *     highlighting for free).
 *   - `evaluate` → per-line result inlays (the computed answer, shown after the
 *     line). Reuses the existing {@link EvaluateCalc} contract.
 *   - `complete` → autocomplete inside the fence (Monaco surface).
 */
export interface CalcEditorHooks {
  tokenize?: CalcTokenize;
  complete?: CalcComplete;
  evaluate?: EvaluateCalc;
}
