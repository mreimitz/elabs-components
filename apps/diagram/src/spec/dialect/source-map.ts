/** Path → source offsets, and offsets → 1-based line/col (Monaco-ready). React-free. */
import type { LineCounter } from "yaml";

export interface SourcePos {
  line: number;
  col: number;
}

export interface SourceRange {
  start: SourcePos;
  end: SourcePos;
  offset: readonly [number, number];
}

export interface SourceMap {
  readonly text: string;
  readonly lineCounter: LineCounter;
  /** path → [start, valueEnd) of the value node. */
  readonly values: Map<string, readonly [number, number]>;
  /** path → [start, end) of the mapping key. */
  readonly keys: Map<string, readonly [number, number]>;
}

export function joinPath(base: string, key: string): string {
  return base ? `${base}.${key}` : key;
}

export function indexPath(base: string, index: number): string {
  return `${base}[${index}]`;
}

/** Offsets → range; trailing whitespace/newlines are trimmed so a block ends on its last character. */
export function toSourceRange(
  map: SourceMap,
  [start, rawEnd]: readonly [number, number],
): SourceRange {
  let end = rawEnd;
  while (end > start && /\s/.test(map.text[end - 1] ?? "")) end--;
  const s = map.lineCounter.linePos(start);
  const e = map.lineCounter.linePos(end);
  return {
    start: { line: s.line, col: s.col },
    end: { line: e.line, col: e.col },
    offset: [start, end],
  };
}

const LAST_SEGMENT = /(\.[^.[\]]*|\[\d+\])$/;

/** The range for `path`: its key or value; falls back to the nearest recorded ancestor, then line 1. */
export function locate(map: SourceMap, path: string, anchor: "key" | "value"): SourceRange {
  const own =
    anchor === "key" ? (map.keys.get(path) ?? map.values.get(path)) : map.values.get(path);
  if (own) return toSourceRange(map, own);
  let p = path;
  while (p) {
    p = p.replace(LAST_SEGMENT, "");
    const hit = map.values.get(p);
    if (hit) return toSourceRange(map, hit);
    if (!LAST_SEGMENT.test(p)) break;
  }
  return toSourceRange(map, map.values.get("") ?? [0, 0]);
}

/** Copies every entry under `from` to the same suffix under `to` (flow shorthand → flat paths). */
export function aliasPaths(map: SourceMap, from: string, to: string): void {
  for (const table of [map.values, map.keys]) {
    for (const [path, range] of [...table]) {
      if (path.startsWith(`${from}.`) || path.startsWith(`${from}[`)) {
        table.set(to + path.slice(from.length), range);
      }
    }
  }
}
