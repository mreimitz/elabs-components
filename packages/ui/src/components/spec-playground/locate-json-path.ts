/**
 * Map a validator's error `path` onto a line of the JSON text it came from, so clicking an
 * error can put the caret there. Paths are JSON-path-like and tolerant of both house styles:
 * `root.children[2].props.variant` (A2UI) and `$.tiles[3].layout.w` (any tile spec).
 *
 * The scanner is deliberately small: it walks well-formed JSON, recording where each key or
 * array element starts, and returns the DEEPEST prefix of the path that exists — a
 * `missing` prop's path points at a key that is not there, so its owning object is the best
 * place to land. Malformed text returns `undefined` (the caller shows the error without a line).
 */

type Segment = string | number;

/** Split `$.a.b[2].c` / `root.children[0]` / `a/b/0` into segments. */
export function parseJsonPath(path: string): Segment[] {
  const segments: Segment[] = [];
  const re = /\[(\d+)\]|([^.[\]/]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(path)) !== null) {
    if (match[1] !== undefined) segments.push(Number(match[1]));
    else if (match[2] !== undefined && match[2] !== "$") {
      const key = match[2];
      segments.push(/^\d+$/.test(key) ? Number(key) : key);
    }
  }
  return segments;
}

class Scanner {
  i = 0;
  constructor(
    readonly text: string,
    readonly target: Segment[],
  ) {}
  /** Offset of the deepest matched prefix, and how many segments it matched. */
  best = { offset: 0, depth: 0 };

  ws() {
    while (this.i < this.text.length && /\s/.test(this.text[this.i]!)) this.i++;
  }

  string(): string {
    const start = this.i;
    this.i++; // opening quote
    while (this.i < this.text.length && this.text[this.i] !== '"') {
      if (this.text[this.i] === "\\") this.i++;
      this.i++;
    }
    this.i++; // closing quote
    return JSON.parse(this.text.slice(start, this.i)) as string;
  }

  value(depth: number, onPath: boolean) {
    this.ws();
    const ch = this.text[this.i];
    if (ch === "{") return this.object(depth, onPath);
    if (ch === "[") return this.array(depth, onPath);
    if (ch === '"') return void this.string();
    while (this.i < this.text.length && !/[,\]}\s]/.test(this.text[this.i]!)) this.i++;
  }

  private mark(depth: number, offset: number) {
    if (depth > this.best.depth) this.best = { offset, depth };
  }

  object(depth: number, onPath: boolean) {
    this.i++; // {
    for (;;) {
      this.ws();
      if (this.text[this.i] === "}") return void this.i++;
      const keyStart = this.i;
      const key = this.string();
      const hit = onPath && this.target[depth] === key;
      if (hit) this.mark(depth + 1, keyStart);
      this.ws();
      this.i++; // :
      this.value(depth + 1, hit);
      this.ws();
      if (this.text[this.i] === ",") this.i++;
      else if (this.text[this.i] === "}") return void this.i++;
      else throw new Error("malformed");
    }
  }

  array(depth: number, onPath: boolean) {
    this.i++; // [
    let index = 0;
    for (;;) {
      this.ws();
      if (this.text[this.i] === "]") return void this.i++;
      const hit = onPath && this.target[depth] === index;
      if (hit) this.mark(depth + 1, this.i);
      this.value(depth + 1, hit);
      this.ws();
      index++;
      if (this.text[this.i] === ",") this.i++;
      else if (this.text[this.i] === "]") return void this.i++;
      else throw new Error("malformed");
    }
  }
}

/** 1-based line of `offset` in `text`. */
export function lineOfOffset(text: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) if (text[i] === "\n") line++;
  return line;
}

/** 0-based offset where 1-based `line` starts in `text`. */
export function offsetOfLine(text: string, line: number): number {
  let current = 1;
  for (let i = 0; i < text.length; i++) {
    if (current === line) return i;
    if (text[i] === "\n") current++;
  }
  return current === line ? text.length : 0;
}

/**
 * The 1-based line in `text` that best matches `path` — the deepest existing prefix, the
 * document root's line when nothing below it matches — or `undefined` for text that is not
 * well-formed JSON.
 */
export function locateJsonPath(text: string, path: string): number | undefined {
  const scanner = new Scanner(text, parseJsonPath(path));
  try {
    scanner.ws();
    const rootOffset = scanner.i;
    scanner.value(0, true);
    return lineOfOffset(text, scanner.best.depth > 0 ? scanner.best.offset : rootOffset);
  } catch {
    return undefined;
  }
}

/**
 * True when `JSON.parse(prefix)` failed only because it ran out of characters before finishing a
 * token or structure — never because of a token that does not belong. V8 reports these either as
 * the generic "Unexpected end of JSON input" or as a message whose own `position` sits exactly at
 * the end of `prefix`; anything else — including the position-free "Unexpected token …" shape — is
 * a problem already inside `prefix`, not a symptom of `prefix` being cut short.
 */
function endsPrematurely(prefix: string): boolean {
  try {
    JSON.parse(prefix);
    return true; // valid so far — any problem is later in the text
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/unexpected end of json input/i.test(message)) return true;
    const position = /position (\d+)/.exec(message);
    return position !== null && Number(position[1]) >= prefix.length;
  }
}

/**
 * Offset of the first token `JSON.parse` cannot get past, found by growing a prefix of `text`
 * until it stops looking merely incomplete (`endsPrematurely`). Used when the browser's own
 * message carries no position at all — V8's "Unexpected token …" shape. `endsPrematurely` is
 * monotone in the prefix length (once a real problem is reached, every longer prefix reports the
 * same one, since `JSON.parse` always stops at the first bad token), so a binary search finds the
 * boundary in O(log n) parses instead of re-parsing every prefix.
 */
function offsetOfUnexpectedToken(text: string): number {
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (endsPrematurely(text.slice(0, mid))) lo = mid + 1;
    else hi = mid;
  }
  return Math.max(0, lo - 1);
}

/**
 * The line a `JSON.parse` error message points at: `position 42`/`line 3 column 5` read directly;
 * Chromium's other two message shapes carry no position, so "Unexpected end of JSON input" (V8
 * gave up with nothing left to read) defaults to the last line, and "Unexpected token …" (a
 * concrete bad character, but V8 does not say where) falls back to a tolerant scan.
 */
export function lineOfParseError(text: string, message: string): number | undefined {
  const lineCol = /line (\d+) column \d+/.exec(message);
  if (lineCol) return Number(lineCol[1]);
  const position = /position (\d+)/.exec(message);
  if (position) return lineOfOffset(text, Number(position[1]));
  if (/unexpected end of json input/i.test(message)) return lineOfOffset(text, text.length);
  if (/unexpected token/i.test(message)) return lineOfOffset(text, offsetOfUnexpectedToken(text));
  return undefined;
}
