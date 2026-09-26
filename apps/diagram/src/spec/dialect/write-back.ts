/**
 * DG-14 — write-back. An edit made on the canvas or in the inspector is a TEXT edit (plan
 * D2): every function here parses the text, finds the entry at its DG-09 path and splices
 * new characters in at the source-map offsets, so every line the edit does not touch stays
 * byte-identical. Never a `yaml` Document round trip: `String(doc)` rewrote 29 of 78 lines
 * of the plan sample in hardening (docs/verified-apis.md → yaml). React-free.
 *
 * Every function returns the new text, or `null` when it cannot edit exactly (YAML errors,
 * a path that is not there, a shape it does not write) — the caller then leaves the text
 * alone.
 */
import { parse } from "yaml";
import { parseArchYaml } from "./parse";
import { joinPath, type SourceMap } from "./source-map";
import type { ArchFlowSpec } from "./types";

/** Replace `[from, to)` with `insert`. */
export interface TextEdit {
  from: number;
  to: number;
  insert: string;
}

/** What the inspector and the canvas write: a scalar, a list of words, or a position. */
export type WriteValue =
  | string
  | number
  | boolean
  | readonly string[]
  | { readonly x: number; readonly y: number };

/** Key → new value; `undefined` removes the key. */
export type EntryPatch = Readonly<Record<string, WriteValue | undefined>>;

/** Applies non-overlapping edits back to front. `null` when two edits overlap. */
export function applyEdits(text: string, edits: readonly TextEdit[]): string | null {
  const sorted = [...edits].sort((a, b) => b.from - a.from || b.to - a.to);
  let out = text;
  let floor = Number.POSITIVE_INFINITY;
  for (const edit of sorted) {
    if (edit.to > floor) return null;
    out = out.slice(0, edit.from) + edit.insert + out.slice(edit.to);
    floor = edit.from;
  }
  return out;
}

// ── Values ──────────────────────────────────────────────────────────────────

type Quote = '"' | "'" | "";

function roundTrips(candidate: string, value: string, flow: boolean): boolean {
  try {
    const parsed: unknown = flow ? (parse(`[${candidate}]`) as unknown[])[0] : parse(candidate);
    return parsed === value;
  } catch {
    return false;
  }
}

/**
 * A scalar as YAML. Strings keep the entry's quote style; a plain string is written plain
 * only when it reads back as the same string in its context (`flow`: inside `{…}` or
 * `[…]`), else double-quoted (JSON's string syntax is valid YAML).
 */
export function yamlScalar(
  value: string | number | boolean,
  flow = false,
  quote: Quote = "",
): string {
  if (typeof value !== "string") return String(value);
  if (quote === "'" && !value.includes("\n")) return `'${value.replaceAll("'", "''")}'`;
  if (quote === "" && value !== "" && !value.includes("\n") && roundTrips(value, value, flow)) {
    return value;
  }
  return JSON.stringify(value);
}

const isList = (value: WriteValue): value is readonly string[] => Array.isArray(value);

function yamlValue(value: WriteValue, flow: boolean, quote: Quote = ""): string {
  if (isList(value)) return `[${value.map((item) => yamlScalar(item, true)).join(", ")}]`;
  if (typeof value === "object") {
    return `{ x: ${Math.round(value.x)}, y: ${Math.round(value.y)} }`;
  }
  return yamlScalar(value, flow, quote);
}

// ── Reading ─────────────────────────────────────────────────────────────────

/** `zones[0].children[1]` → `["zones", 0, "children", 1]`. */
function segments(path: string): (string | number)[] {
  const out: (string | number)[] = [];
  for (const part of path.match(/[^.[\]]+|\[\d+\]/g) ?? []) {
    out.push(part.startsWith("[") ? Number(part.slice(1, -1)) : part);
  }
  return out;
}

/** The plain value at `path` in a parsed document's `raw`. */
export function valueAt(raw: unknown, path: string): unknown {
  let node = raw;
  for (const segment of segments(path)) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string | number, unknown>)[segment];
  }
  return node;
}

interface KeyInfo {
  key: string;
  keyStart: number;
  keyEnd: number;
  /** `[start, end)` of the value; absent for `key:` with no value. */
  value?: readonly [number, number];
}

interface MapInfo {
  path: string;
  start: number;
  end: number;
  /** `{ … }` rather than one key per line. */
  flow: boolean;
  /** The map's own keys, in text order. */
  keys: KeyInfo[];
}

/** End of `[start, end)` without trailing whitespace (a block value ends on its last character). */
function trimEnd(text: string, start: number, end: number): number {
  let at = end;
  while (at > start && /\s/.test(text[at - 1] ?? "")) at -= 1;
  return at;
}

const lineStart = (text: string, at: number) => text.lastIndexOf("\n", at - 1) + 1;

/** Offset just past the newline that ends the line holding `at` (or the text's end). */
function nextLine(text: string, at: number): number {
  const newline = text.indexOf("\n", at);
  return newline === -1 ? text.length : newline + 1;
}

function mapAt(map: SourceMap, path: string): MapInfo | null {
  const range = map.values.get(path);
  if (!range) return null;
  const prefix = path ? `${path}.` : "";
  const keys: KeyInfo[] = [];
  for (const [keyPath, keyRange] of map.keys) {
    if (!keyPath.startsWith(prefix)) continue;
    const key = keyPath.slice(prefix.length);
    if (key === "" || /[.[]/.test(key)) continue;
    keys.push({ key, keyStart: keyRange[0], keyEnd: keyRange[1], value: map.values.get(keyPath) });
  }
  keys.sort((a, b) => a.keyStart - b.keyStart);
  return { path, start: range[0], end: range[1], flow: map.text[range[0]] === "{", keys };
}

function quoteAt(text: string, at: number): Quote {
  const char = text[at];
  return char === '"' || char === "'" ? char : "";
}

/**
 * The quote style to keep for the scalar at `[start, end)`: the author's, but not double
 * quotes the old value needed anyway (a trailing space typed a keystroke earlier would
 * otherwise quote the value for good).
 */
function styleAt(text: string, start: number, end: number, flow: boolean): Quote {
  const quote = quoteAt(text, start);
  if (quote !== '"') return quote;
  try {
    const old: unknown = parse(text.slice(start, end));
    return typeof old === "string" && yamlScalar(old, flow) !== old ? "" : '"';
  } catch {
    return '"';
  }
}

// ── Map edits ───────────────────────────────────────────────────────────────

/** Remove `key: value` from its map. */
function removeKey(text: string, info: MapInfo, own: KeyInfo): TextEdit | null {
  const valueEnd = own.value ? trimEnd(text, own.value[0], own.value[1]) : own.keyEnd + 1;
  if (info.flow) {
    // `{ a: 1, b: 2 }`: take the comma after, else the one before.
    const after = /^\s*,\s*/.exec(text.slice(valueEnd));
    if (after) return { from: own.keyStart, to: valueEnd + after[0].length, insert: "" };
    const before = /,\s*$/.exec(text.slice(info.start, own.keyStart));
    const from = before ? info.start + before.index : own.keyStart;
    return { from, to: valueEnd, insert: "" };
  }
  const start = lineStart(text, own.keyStart);
  if (text.slice(start, own.keyStart).trim() === "") {
    return { from: start, to: nextLine(text, valueEnd), insert: "" };
  }
  // The first key of a `- key: value` item: the next key moves up behind the dash.
  const next = info.keys.find((k) => k.keyStart > own.keyStart);
  return next ? { from: own.keyStart, to: next.keyStart, insert: "" } : null;
}

/** Replace the value of an existing key. */
function replaceValue(text: string, info: MapInfo, own: KeyInfo, value: WriteValue): TextEdit {
  if (!own.value) {
    const colon = text.indexOf(":", own.keyEnd);
    return { from: own.keyEnd, to: colon + 1, insert: `: ${yamlValue(value, info.flow)}` };
  }
  const [start, rawEnd] = own.value;
  const end = trimEnd(text, start, rawEnd);
  const first = text[start];
  const scalar = !isList(value) && typeof value !== "object";
  if (scalar || first === "[" || first === "{") {
    return {
      from: start,
      to: end,
      insert: yamlValue(value, info.flow, styleAt(text, start, end, info.flow)),
    };
  }
  // A block list or map becomes a flow one on the key's line.
  return { from: own.keyEnd, to: end, insert: `: ${yamlValue(value, info.flow)}` };
}

export interface SetKeysOptions {
  /** Insert new keys after this key's line (default: after the last key but `children`). */
  after?: string;
}

/** The edits that apply `patch` to the map at `info`. `null` when one cannot be exact. */
function setKeysEdits(
  text: string,
  info: MapInfo,
  patch: EntryPatch,
  options: SetKeysOptions = {},
): TextEdit[] | null {
  const edits: TextEdit[] = [];
  const inserts: string[] = [];
  for (const [key, value] of Object.entries(patch)) {
    const own = info.keys.find((k) => k.key === key);
    if (value === undefined) {
      if (!own) continue;
      const edit = removeKey(text, info, own);
      if (!edit) return null;
      edits.push(edit);
    } else if (own) {
      edits.push(replaceValue(text, info, own, value));
    } else {
      inserts.push(`${key}: ${yamlValue(value, info.flow)}`);
    }
  }
  if (inserts.length === 0) return edits;
  const kept = info.keys.filter((k) => patch[k.key] !== undefined || !(k.key in patch));
  if (info.flow) {
    const last = kept.at(-1);
    if (!last) {
      return [...edits, { from: info.start, to: info.end, insert: `{ ${inserts.join(", ")} }` }];
    }
    const at = last.value ? trimEnd(text, last.value[0], last.value[1]) : last.keyEnd + 1;
    return [...edits, { from: at, to: at, insert: `, ${inserts.join(", ")}` }];
  }
  const first = info.keys[0];
  if (!first) return null;
  const anchor =
    kept.find((k) => k.key === options.after) ?? kept.filter((k) => k.key !== "children").at(-1);
  if (!anchor) return null;
  const indent = " ".repeat(first.keyStart - lineStart(text, first.keyStart));
  const anchorEnd = anchor.value
    ? trimEnd(text, anchor.value[0], anchor.value[1])
    : anchor.keyEnd + 1;
  const newline = text.indexOf("\n", anchorEnd);
  const at = newline === -1 ? text.length : newline;
  const lines = inserts.map((line) => `\n${indent}${line}`).join("");
  return [...edits, { from: at, to: at, insert: lines }];
}

/**
 * Set or remove keys of the mapping at `path` (a zone, a node, an object-form flow, or `""`
 * for the top level). Existing keys change in place; new keys go on new lines after the
 * last key (before `children:`) at the entry's indent, or inside `{ … }` for a flow map.
 */
export function setEntryKeys(
  text: string,
  path: string,
  patch: EntryPatch,
  options?: SetKeysOptions,
): string | null {
  const { raw, sourceMap } = parseArchYaml(text);
  if (raw === undefined) return null;
  const info = mapAt(sourceMap, path);
  if (!info) return null;
  const edits = setKeysEdits(text, info, patch, options);
  return edits && applyEdits(text, edits);
}

/** `{ label: …, kind: … }` for a flow written as `a -> b: …`, label first. */
function flowMap(record: Readonly<Record<string, WriteValue>>): string {
  const keys = Object.keys(record).sort((a, b) => Number(b === "label") - Number(a === "label"));
  return `{ ${keys.map((key) => `${key}: ${yamlValue(record[key] as WriteValue, true)}`).join(", ")} }`;
}

function withPatch(
  base: Readonly<Record<string, WriteValue>>,
  patch: EntryPatch,
): Record<string, WriteValue> {
  const out: Record<string, WriteValue> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete out[key];
    else out[key] = value;
  }
  return out;
}

/**
 * Set or remove keys of a flow in any of DG-09's three forms. A flow written as a string
 * (`- a -> b`) or with a label (`- a -> b: Label`) becomes `- a -> b: { … }` only when a key
 * other than `label` is set; a label alone stays `a -> b: Label`; a shorthand whose last key
 * is removed goes back to `- a -> b`. `from`, `to` and `direction` are the arrow's: never here.
 */
export function setFlowKeys(
  text: string,
  flow: Pick<ArchFlowSpec, "path" | "form">,
  patch: EntryPatch,
): string | null {
  if (flow.form === "object") return setEntryKeys(text, flow.path, patch);
  const { raw, sourceMap } = parseArchYaml(text);
  if (raw === undefined) return null;
  const item = valueAt(raw, flow.path);
  const outer = sourceMap.values.get(flow.path);
  if (!outer) return null;
  const outerEnd = trimEnd(text, outer[0], outer[1]);
  const rewrite = (arrow: string, record: Readonly<Record<string, WriteValue>>) => {
    const keys = Object.keys(record);
    const label = record.label;
    const body =
      keys.length === 0
        ? arrow
        : keys.length === 1 && typeof label === "string"
          ? `${arrow}: ${yamlScalar(label)}`
          : `${arrow}: ${flowMap(record)}`;
    return applyEdits(text, [{ from: outer[0], to: outerEnd, insert: body }]);
  };
  if (typeof item === "string") return rewrite(item, withPatch({}, patch));
  if (item === null || typeof item !== "object") return null;
  const arrow = Object.keys(item)[0];
  if (arrow === undefined) return null;
  const value = (item as Record<string, unknown>)[arrow];
  if (value !== null && typeof value === "object") {
    const inner = mapAt(sourceMap, joinPath(flow.path, arrow));
    if (!inner) return null;
    const left = inner.keys.filter((k) => !(k.key in patch) || patch[k.key] !== undefined);
    const added = Object.entries(patch).some(
      ([key, v]) => v !== undefined && !inner.keys.some((k) => k.key === key),
    );
    if (left.length === 0 && !added) return rewrite(arrow, {});
    const edits = setKeysEdits(text, inner, patch);
    return edits && applyEdits(text, edits);
  }
  const base: Record<string, WriteValue> =
    value === null || value === undefined ? {} : { label: String(value) };
  const next = withPatch(base, patch);
  const labelRange = sourceMap.values.get(joinPath(flow.path, arrow));
  if (labelRange && Object.keys(next).length === 1 && typeof next.label === "string") {
    const end = trimEnd(text, labelRange[0], labelRange[1]);
    const quote = styleAt(text, labelRange[0], end, false);
    return applyEdits(text, [
      { from: labelRange[0], to: end, insert: yamlScalar(next.label, false, quote) },
    ]);
  }
  return rewrite(arrow, next);
}

// ── Entries ─────────────────────────────────────────────────────────────────

const PARENT_SEQ = /^(.*)\[(\d+)\]$/;

/**
 * Remove whole list entries (zones, nodes, flows, notes) by path. An entry nested in another
 * removed one goes with it; a list left empty loses its key too (`children:` with no items
 * is not a list). Each entry must start on its own `- ` line.
 */
export function removeEntries(text: string, paths: readonly string[]): string | null {
  const { raw, sourceMap } = parseArchYaml(text);
  if (raw === undefined) return null;
  const unique = [...new Set(paths)].filter(
    (path) => !paths.some((other) => other !== path && path.startsWith(`${other}.`)),
  );
  const bySeq = new Map<string, string[]>();
  for (const path of unique) {
    const match = PARENT_SEQ.exec(path);
    if (!match) return null;
    const seq = match[1] ?? "";
    bySeq.set(seq, [...(bySeq.get(seq) ?? []), path]);
  }
  const edits: TextEdit[] = [];
  for (const [seq, items] of bySeq) {
    const list = valueAt(raw, seq);
    if (!Array.isArray(list)) return null;
    if (items.length === list.length) {
      // Every item goes: remove `seq:` itself from the map that holds it.
      const holder = seq.replace(/\.[^.[\]]+$/, "");
      const info = mapAt(sourceMap, holder === seq ? "" : holder);
      const own = info?.keys.find((k) => joinPath(info.path, k.key) === seq);
      const edit = info && own ? removeKey(text, info, own) : null;
      if (!edit) return null;
      edits.push(edit);
      continue;
    }
    for (const path of items) {
      const range = sourceMap.values.get(path);
      if (!range) return null;
      const start = lineStart(text, range[0]);
      if (!/^\s*-\s+$/.test(text.slice(start, range[0]))) return null;
      edits.push({
        from: start,
        to: nextLine(text, trimEnd(text, range[0], range[1])),
        insert: "",
      });
    }
  }
  return applyEdits(text, edits);
}
