/**
 * DG-26 — dialect 0 → 1 as a text edit (N3: an upgrader for every major step; DG-60 chains the
 * next). v1 is a superset of v0: the version key changes and, on line 1 only, a
 * yaml-language-server modeline that names the v0 schema. Never a yaml Document round trip
 * (write-back.ts). React-free.
 */
import { parseArchYaml } from "./parse";
import { normalizeArch } from "./normalize"; // DG-26 (1b.8)
import { suppliedBy, type CatalogLookup, type Supplied } from "./catalog-refs"; // DG-26 (1b.8)
import { CATALOG_REF_ROOT } from "./ids"; // DG-26 (review round 0 F3)
import { renameEntryKey, setEntryKeys, valueAt, type WriteValue } from "./write-back";
import {
  DIALECT_VERSION,
  isSuppliedKeyWritten,
  READ_VERSIONS,
  SUPPLIED_KEYS,
  type DialectVersion,
} from "./types";

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
// `name = choices[id] ?? <the written icon>` (a leading "catalog/" on a choice is stripped, so
// either form of the entry's name works — review round 0 F3), skip when undefined, "custom", or
// not a known catalog name (a glyph is never one, Ruling 7); when the written icon equals the
// entry's own icon or name, rename `icon:` to `ref:` in place (keeps the line, position and any
// comment); otherwise add `ref:` after `id:` and keep `icon:` as a deliberate override; then
// drop title/subtitle/type/badges whose written value equals what the entry now supplies,
// unless the key's own line or the line above carries a comment. `description` and `docs` are
// never dropped even when they match: nothing reads a reference's `description`/`docs` yet
// (DG-25 will), so dropping one today would blank a hover card with nothing to put it back.
// Comments, blank lines, every other node and the file's layout stay byte-identical.

/** node id → the catalog name to use (`"aws/glue"`), or `"custom"` to leave the node as it is. */
export type RefChoices = Readonly<Record<string, string>>;

export interface RefFirstChange {
  id: string;
  ref: string;
  /** title/subtitle/type/badges removed because the reference now supplies the same value. */
  dropped: readonly string[];
  /**
   * title/type written, matching what the node already drew (its id, or "service"), because
   * without them the reference would have started supplying a different value for a key the
   * node never wrote (review round 1 F1, verify-r1 — every drawing stays identical).
   */
  pinned?: readonly string[];
  /** A drop that could not be spliced exactly: the keys stayed, unremarked otherwise (review round 1 N1). */
  reason?: "no-exact-edit";
}

/** A node left custom on purpose, and why (review round 1 F1, verify-r1). Never a failure. */
export interface RefFirstSkip {
  id: string;
  reason: string;
}

export interface RefFirstResult {
  text: string;
  changed: boolean;
  changes: readonly RefFirstChange[];
  /**
   * Nodes the migration chose not to convert even though a catalog name resolved, because
   * doing so would have changed the drawing and nothing could be pinned to prevent that
   * (subtitle, icon or badges: unlike title/type, there is no written value that means "no
   * value" — review round 1 F1, verify-r1). Informational; never makes the script fail.
   */
  skipped: readonly RefFirstSkip[];
  /**
   * `choices` entries this call could not use: a node id not in this file, or a name (or ref)
   * that names no catalog entry. A node simply not mentioned in `choices` at all is normal
   * (it falls back to its own written icon) and is never reported here (review round 1 F3 /
   * verify-r1 F2 — these ARE reported, because they read as typos).
   */
  badChoices: readonly string[];
  /**
   * Set when nothing could be read or edited: the same three unreadable-file reasons
   * `upgradeText` reports (review round 0 F2 — a parse/AST failure is a failure, never a
   * quiet "unchanged"), plus `"no-exact-edit"` when a write-back splice could not be made
   * exactly.
   */
  reason?: UpgradeReason;
}

const sameList = (a: readonly string[] | undefined, b: readonly string[] | undefined) =>
  a !== undefined && b !== undefined && a.length === b.length && a.every((v, i) => v === b[i]);

const SUPPLIED_DROP_KEYS = ["title", "subtitle", "type", "badges"] as const;

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
  if (raw === undefined)
    return { text, changed: false, changes: [], skipped: [], badChoices: [], reason: "yaml-error" };
  const { ast, issues } = normalizeArch(raw, sourceMap);
  if (!ast) {
    const reason =
      issues[0]?.code === "unsupported-version" ? "unsupported-version" : "not-a-diagram";
    return { text, changed: false, changes: [], skipped: [], badChoices: [], reason };
  }
  const changes: RefFirstChange[] = [];
  const skipped: RefFirstSkip[] = [];
  // review round 1 F3 (review-r1) / F2 (verify-r1) — a `choices` id this file has no node for
  // is a typo worth reporting, same as a name below that names no catalog entry; a node simply
  // absent from `choices` (the common case) is never in this list.
  const nodeIds = new Set(ast.nodes.map((n) => n.id));
  const badChoices: string[] = Object.keys(choices)
    .filter((id) => !nodeIds.has(id))
    .map((id) => `"${id}" is not a node in this file`);
  let out = text;
  // Node ids/paths only (to enumerate what to touch); every read of a value below re-parses
  // `out`, since each edit shifts every later offset.
  for (const node of ast.nodes) {
    if (node.ref !== undefined) continue;
    const { raw: rawNow } = parseArchYaml(out);
    if (rawNow === undefined)
      return {
        text: out,
        changed: changes.length > 0,
        changes,
        skipped,
        badChoices,
        reason: "no-exact-edit",
      };
    const entryRaw = rawEntryOf(rawNow, node.path);
    if (!entryRaw) continue;
    const choice = choices[node.id];
    if (choice === "custom") continue;
    const writtenIcon = typeof entryRaw.icon === "string" ? entryRaw.icon : undefined;
    // review round 0 F3 — a choice written in the documented ref form ("catalog/aws/rds")
    // names the same catalog entry as the bare name ("aws/rds"); accept either.
    const catalogPrefix = `${CATALOG_REF_ROOT}/`;
    const chosenName = choice?.startsWith(catalogPrefix)
      ? choice.slice(catalogPrefix.length)
      : choice;
    const name = chosenName ?? writtenIcon;
    if (name === undefined) continue;
    const entry = catalog.get(name);
    if (!entry) {
      // review round 1 F3 (review-r1) / F2 (verify-r1) — an EXPLICIT choice that names no
      // catalog entry is reported; a node with no `choices` entry that simply has no catalog
      // icon (the ordinary case) stays silently custom, as always.
      if (chosenName !== undefined)
        badChoices.push(`"${node.id}": "${choice}" is not a catalog item`);
      continue;
    }
    const supplied: Supplied = suppliedBy(entry, catalog);

    // review round 1 F1 (verify-r1) — an unwritten key (`isSuppliedKeyWritten`, types.ts:
    // missing, or YAML null; never an explicit "", which is a written override) would start
    // drawing the reference's value once `ref:` lands (`resolveCatalogRefs` fills every
    // SUPPLIED_KEY the node's `unwritten` names); every drawing stays identical (maintainer
    // ruling 2026-09-27). `title` and `type` always have a value to pin (the id / "service"
    // fallback, `normalize.ts`), unless that fallback value is itself "" (impossible today,
    // since an id and "service" are never blank, but a pinned "" would become a written
    // override of its own instead of preserving "no value"); `subtitle`, `icon` and `badges`
    // never have a written value that means "no value" at all. Either way, a node needing one
    // of those is left custom.
    const pin: Record<string, WriteValue> = {};
    let unsafe: string | undefined;
    for (const key of SUPPLIED_KEYS) {
      if (isSuppliedKeyWritten(entryRaw, key)) continue; // the drop loop below decides whether it stays
      const after = supplied[key];
      if (after === undefined) continue; // nothing would change
      const before = node[key];
      const same = Array.isArray(after)
        ? sameList(before as readonly string[] | undefined, after as readonly string[])
        : before === after;
      if (same) continue;
      if ((key === "title" || key === "type") && before !== "") pin[key] = before as WriteValue;
      else unsafe = key;
    }
    if (unsafe !== undefined) {
      skipped.push({
        id: node.id,
        reason: `"${unsafe}" has no value of its own; the reference would newly draw one, so the node stayed custom`,
      });
      continue;
    }

    const ref = `catalog/${entry.name}`;
    const renamed =
      writtenIcon === entry.icon || writtenIcon === entry.name
        ? renameEntryKey(out, node.path, "icon", "ref", ref)
        : setEntryKeys(out, node.path, { ref }, { after: "id" });
    if (renamed === null)
      return {
        text: out,
        changed: changes.length > 0,
        changes,
        skipped,
        badChoices,
        reason: "no-exact-edit",
      };
    out = renamed;
    const pinned = Object.keys(pin);
    if (pinned.length > 0) {
      // Anchor on "ref" (just inserted above), not "id": the default written order is "id"
      // then "ref", so a pin belongs after "ref", not between it and "id".
      const withPins = setEntryKeys(out, node.path, pin, { after: "ref" });
      if (withPins === null)
        return {
          text: out,
          changed: changes.length > 0,
          changes,
          skipped,
          badChoices,
          reason: "no-exact-edit",
        };
      out = withPins;
    }
    const { raw: rawAfterRef, sourceMap: mapAfterRef } = parseArchYaml(out);
    if (rawAfterRef === undefined) {
      return {
        text: out,
        changed: changes.length > 0,
        changes,
        skipped,
        badChoices,
        reason: "no-exact-edit",
      };
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
    // review round 1 N1 (review-r1) — a drop that could not be spliced exactly is reported,
    // never silently left in place unremarked.
    let dropFailed = false;
    if (dropped.length > 0) {
      const patched = setEntryKeys(out, node.path, patch);
      if (patched !== null) out = patched;
      else {
        dropped.length = 0;
        dropFailed = true;
      }
    }
    changes.push({
      id: node.id,
      ref,
      dropped,
      ...(pinned.length > 0 && { pinned }),
      ...(dropFailed && { reason: "no-exact-edit" as const }),
    });
  }
  return { text: out, changed: changes.length > 0, changes, skipped, badChoices };
}
