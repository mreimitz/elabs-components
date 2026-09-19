/**
 * Map a validator's error `path` onto a line of the JSON text it came from, so clicking an
 * error can put the caret there. Paths are JSON-path-like and tolerant of both house styles:
 * `root.children[2].props.variant` (A2UI) and `$.tiles[3].layout.w` (DashboardSpec).
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

/** The line a `JSON.parse` error message points at (`position 42`, `line 3 column 5`), if any. */
export function lineOfParseError(text: string, message: string): number | undefined {
  const lineCol = /line (\d+) column \d+/.exec(message);
  if (lineCol) return Number(lineCol[1]);
  const position = /position (\d+)/.exec(message);
  if (position) return lineOfOffset(text, Number(position[1]));
  return undefined;
}
