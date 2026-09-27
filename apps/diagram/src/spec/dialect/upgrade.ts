/**
 * DG-26 — dialect 0 → 1 as a text edit (N3: an upgrader for every major step; DG-60 chains the
 * next). v1 is a superset of v0: the version key changes and, on line 1 only, a
 * yaml-language-server modeline that names the v0 schema. Never a yaml Document round trip
 * (write-back.ts). React-free.
 */
import { parseArchYaml } from "./parse";
import { normalizeArch } from "./normalize"; // DG-26 (1b.8)
import { suppliedBy, type CatalogLookup, type Supplied } from "./catalog-refs"; // DG-26 (1b.8)
import { renameEntryKey, setEntryKeys, valueAt, type WriteValue } from "./write-back";
import { DIALECT_VERSION, READ_VERSIONS, type DialectVersion } from "./types";

export type UpgradeReason =
  | "yaml-error"
  | "not-a-diagram"
  | "unsupported-version"
  | "no-exact-edit";

export interface UpgradeResult {
  text: string;
  /** What the file said; null when it is not a readable diagram. */
  from: DialectVersion | null;
  changed: boolean;
  /** 1-based lines that changed. */
  lines: number[];
  reason?: UpgradeReason;
}

const MODELINE_V0 = /^(# yaml-language-server: \$schema=\S*)arch-diagram\.v0\.schema\.json(\s*)$/;

export function upgradeText(text: string): UpgradeResult {
  const same = (from: DialectVersion | null, reason?: UpgradeReason): UpgradeResult => ({
    text,
    from,
    changed: false,
    lines: [],
    ...(reason !== undefined && { reason }),
  });
  const { raw } = parseArchYaml(text);
  if (raw === undefined) return same(null, "yaml-error");
  if (raw === null || typeof raw !== "object" || Array.isArray(raw) || !("diagram" in raw)) {
    return same(null, "not-a-diagram");
  }
  const version = String((raw as Record<string, unknown>).diagram);
  if (!(READ_VERSIONS as readonly string[]).includes(version))
    return same(null, "unsupported-version");
  const from = version as DialectVersion;
  if (from === DIALECT_VERSION) return same(from);
  const edited = setEntryKeys(text, "", { diagram: DIALECT_VERSION });
  if (edited === null) return same(from, "no-exact-edit");
  const after = edited.split("\n");
  const modeline = MODELINE_V0.exec(after[0] ?? "");
  if (modeline) after[0] = `${modeline[1]}arch-diagram.v1.schema.json${modeline[2] ?? ""}`;
  const before = text.split("\n");
  const lines = after.flatMap((line, i) => (line === before[i] ? [] : [i + 1]));
  return { text: after.join("\n"), from, changed: true, lines };
}

// ── DG-26 (1b.8) — the reference-first migration ────────────────────────────────────────
// A one-time, per-file rewrite (scripts/upgrade-workspace.mjs --ref-first --choices), never
// run on open (Ruling 1). Per node, in document order: skip a node that already has `ref`;
// `name = choices[id] ?? <the written icon>`, skip when undefined, "custom", or not a known
// catalog name (a glyph is never one, Ruling 7); when the written icon equals the entry's own
// icon or name, rename `icon:` to `ref:` in place (keeps the line, position and any trailing
// comment); otherwise add `ref:` after `id:` and keep `icon:` as a deliberate override; then
// drop title/subtitle/type/badges/description/docs whose written value equals what the entry
// now supplies, unless the key's own line or the line above carries a comment. Comments, blank
// lines, every other node and the file's layout stay byte-identical.

/** node id → the catalog name to use (`"aws/glue"`), or `"custom"` to leave the node as it is. */
export type RefChoices = Readonly<Record<string, string>>;

export interface RefFirstChange {
  id: string;
  ref: string;
  /** title/subtitle/type/badges/description/docs removed because the reference now supplies the same value. */
  dropped: readonly string[];
}

export interface RefFirstResult {
  text: string;
  changed: boolean;
  changes: readonly RefFirstChange[];
  reason?: "no-exact-edit";
}

const sameList = (a: readonly string[] | undefined, b: readonly string[] | undefined) =>
  a !== undefined && b !== undefined && a.length === b.length && a.every((v, i) => v === b[i]);

const SUPPLIED_DROP_KEYS = ["title", "subtitle", "type", "badges", "description", "docs"] as const;

function rawEntryOf(raw: unknown, path: string): Record<string, unknown> | undefined {
  const value = valueAt(raw, path);
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** A trailing `#` on the key's own line, or a comment-only line directly above it. */
function commentGuards(text: string, keyStart: number, valueEnd: number): boolean {
  const lineEnd = text.indexOf("\n", valueEnd);
  if (text.slice(valueEnd, lineEnd === -1 ? text.length : lineEnd).includes("#")) return true;
  const thisLineStart = text.lastIndexOf("\n", keyStart - 1) + 1;
  if (thisLineStart === 0) return false;
  const aboveEnd = thisLineStart - 1;
  const aboveStart = text.lastIndexOf("\n", aboveEnd - 1) + 1;
  return /^\s*#/.test(text.slice(aboveStart, aboveEnd));
}

/**
 * Rewrite `icon:` as `ref:` for each node the rules above resolve to a catalog reference (a
 * diagram reference is written by hand; this never touches `ws/…`), then drop the keys the
 * reference now supplies identically. Pure; never run on open (Ruling 1).
 */
export function refFirstText(
  text: string,
  catalog: CatalogLookup,
  choices: RefChoices = {},
): RefFirstResult {
  const { raw, sourceMap } = parseArchYaml(text);
  if (raw === undefined) return { text, changed: false, changes: [] };
  const { ast } = normalizeArch(raw, sourceMap);
  if (!ast) return { text, changed: false, changes: [] };
  const changes: RefFirstChange[] = [];
  let out = text;
  // Node ids/paths only (to enumerate what to touch); every read of a value below re-parses
  // `out`, since each edit shifts every later offset.
  for (const node of ast.nodes) {
    if (node.ref !== undefined) continue;
    const { raw: rawNow } = parseArchYaml(out);
    if (rawNow === undefined)
      return { text: out, changed: changes.length > 0, changes, reason: "no-exact-edit" };
    const entryRaw = rawEntryOf(rawNow, node.path);
    if (!entryRaw) continue;
    const choice = choices[node.id];
    if (choice === "custom") continue;
    const writtenIcon = typeof entryRaw.icon === "string" ? entryRaw.icon : undefined;
    const name = choice ?? writtenIcon;
    if (name === undefined) continue;
    const entry = catalog.get(name);
    if (!entry) continue;
    const ref = `catalog/${entry.name}`;
    const renamed =
      writtenIcon === entry.icon || writtenIcon === entry.name
        ? renameEntryKey(out, node.path, "icon", "ref", ref)
        : setEntryKeys(out, node.path, { ref }, { after: "id" });
    if (renamed === null)
      return { text: out, changed: changes.length > 0, changes, reason: "no-exact-edit" };
    out = renamed;
    const supplied: Supplied = suppliedBy(entry, catalog);
    const { raw: rawAfterRef, sourceMap: mapAfterRef } = parseArchYaml(out);
    if (rawAfterRef === undefined) {
      return { text: out, changed: changes.length > 0, changes, reason: "no-exact-edit" };
    }
    const entryAfterRef = rawEntryOf(rawAfterRef, node.path);
    const patch: Record<string, WriteValue | undefined> = {};
    const dropped: string[] = [];
    for (const key of SUPPLIED_DROP_KEYS) {
      if (!entryAfterRef || !(key in entryAfterRef)) continue;
      const writtenValue = entryAfterRef[key];
      const suppliedValue = supplied[key as keyof Supplied];
      const equal = Array.isArray(writtenValue)
        ? sameList(writtenValue as string[], suppliedValue as readonly string[] | undefined)
        : writtenValue === suppliedValue;
      if (!equal) continue;
      const keyRange = mapAfterRef.keys.get(node.path ? `${node.path}.${key}` : key);
      const valueRange = mapAfterRef.values.get(node.path ? `${node.path}.${key}` : key);
      if (keyRange && valueRange && commentGuards(out, keyRange[0], valueRange[1])) continue;
      patch[key] = undefined;
      dropped.push(key);
    }
    if (dropped.length > 0) {
      const patched = setEntryKeys(out, node.path, patch);
      if (patched !== null) out = patched;
      else dropped.length = 0; // could not drop exactly: keep the keys, keep the ref
    }
    changes.push({ id: node.id, ref, dropped });
  }
  return { text: out, changed: changes.length > 0, changes };
}
