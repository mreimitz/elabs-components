/**
 * DG-26 — dialect 0 → 1 as a text edit (N3: an upgrader for every major step; DG-60 chains the
 * next). v1 is a superset of v0: the version key changes and, on line 1 only, a
 * yaml-language-server modeline that names the v0 schema. Never a yaml Document round trip
 * (write-back.ts). React-free.
 */
import { isAlias, isMap, isScalar, isSeq } from "yaml";
import { parseArchYaml } from "./parse";
import { checkText } from "../check-text";
import { ICON_NAMES } from "../../icons/icon-names";
import { normalizeArch } from "./normalize"; // DG-26 (1b.8)
import { suppliedBy, type CatalogLookup, type Supplied } from "./catalog-refs"; // DG-26 (1b.8)
import { CATALOG_REF_ROOT } from "./ids"; // DG-26
import { pathSegments, renameEntryKey, setEntryKeys, valueAt, type WriteValue } from "./write-back";
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
  | "no-exact-edit"
  /** The full file, re-compiled, would draw at least one node differently (the per-node and
   * whole-file safety nets in `refFirstText` below never let this reach disk). */
  | "drawing-changed";

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
// either form of the entry's name works), skip when undefined, "custom", or
// not a known catalog name (a glyph is never one, Ruling 7); when the written icon equals the
// entry's own icon, rename `icon:` to `ref:` in place (keeps the line, position and any comment)
// — the entry's own NAME is never enough on its own, because a part's name can differ from its
// drawn icon (`generic/users` names a part whose icon is `lucide/users`; renaming on the name
// alone would silently redraw it); otherwise add `ref:` after `id:`
// and keep `icon:` as a deliberate override; then drop title/subtitle/type/badges whose written
// value equals what the entry now supplies, unless the key's own line or the line above carries a
// comment, or the key is set through a YAML anchor or alias (rewriting or removing it as text
// could duplicate or corrupt the document, or strand another node's `*alias` — both keep the key
// as written and are named in `RefFirstChange.kept`). `description` and `docs` are never dropped
// even when they match: nothing reads a reference's `description`/`docs` yet (DG-25 will), so
// dropping one today would blank a hover card with nothing to put it back. Comments, blank lines,
// every other node and the file's layout stay byte-identical. As a last check, the whole
// rewritten file is re-compiled and compared node by node against the original; any drawing
// difference at all fails the file (`"drawing-changed"`) instead of writing it.

/** node id → the catalog name to use (`"aws/glue"`), or `"custom"` to leave the node as it is. */
export type RefChoices = Readonly<Record<string, string>>;

export interface RefFirstOptions {
  /**
   * The file already has at least one `ref:` node (`hasCatalogRef`), so it was migrated before:
   * only the ids `choices` names are candidates, never a node's own written `icon:`. Leaves a
   * custom stand-in a copy of an already-migrated file carries — `nat`, `replicate`, a
   * hand-written comment — alone unless the caller names it.
   */
  onlyNamed?: boolean;
}

export interface RefFirstChange {
  id: string;
  ref: string;
  /** title/subtitle/type/badges removed because the reference now supplies the same value. */
  dropped: readonly string[];
  /**
   * title/type written, matching what the node already drew (its id, or "service"), because
   * without them the reference would have started supplying a different value for a key the
   * node never wrote.
   */
  pinned?: readonly string[];
  /** title/subtitle/type/badges that equal what the reference now supplies but stayed written
   * because a YAML anchor or alias sets them, so rewriting the key as text is not safe. */
  kept?: readonly string[];
  /** A drop that could not be spliced exactly: the keys stayed, unremarked otherwise. */
  reason?: "no-exact-edit";
}

/** A node left custom on purpose, and why. Never a failure. */
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
   * value"). Informational; never makes the script fail.
   */
  skipped: readonly RefFirstSkip[];
  /**
   * `choices` entries this call could not use: a node id not in this file, or a name (or ref)
   * that names no catalog entry. A node simply not mentioned in `choices` at all is normal
   * (it falls back to its own written icon) and is never reported here.
   */
  badChoices: readonly string[];
  /**
   * Set when nothing was written: the same three unreadable-file reasons `upgradeText` reports
   * (a parse/AST failure is a failure, never a quiet "unchanged"), `"no-exact-edit"` when a
   * write-back splice could not be made exactly, or `"drawing-changed"` when the whole rewritten
   * file, re-compiled, would draw at least one node differently — `text` is the ORIGINAL text in
   * every case, and `changes`/`changed` are empty/false.
   */
  reason?: UpgradeReason;
}

/**
 * True once any node in the text already carries `ref:` (a catalog or a diagram reference) —
 * this file has already been through the reference-first migration, at least in part. The
 * script reads this to decide whether a bare `--ref-first` may still auto-detect a node's own
 * written `icon:`, or must only touch the ids `choices` names, so a copy of an already-migrated
 * file keeps its custom stand-ins. `false` for text that does not even parse as a diagram; the
 * caller's own read of it already says why.
 */
export function hasCatalogRef(text: string): boolean {
  const { raw, sourceMap } = parseArchYaml(text);
  if (raw === undefined) return false;
  const { ast } = normalizeArch(raw, sourceMap);
  return ast !== null && ast.nodes.some((n) => n.ref !== undefined);
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
 * The YAML node at `path` (`pathSegments`'s dotted/indexed form) in `doc.contents`, WITHOUT
 * resolving an alias to its anchor — the opposite of `parse.ts`'s own walk, which resolves every
 * alias so `raw`/`sourceMap` read as plain values. `isAnchorOrAlias` below needs the unresolved
 * node to tell "this key's value is `*name`" (an alias) from "this key's value is `&name …`" (an
 * anchor) apart from an ordinary scalar.
 */
function cstAt(doc: { contents: unknown }, path: string): unknown {
  let node: unknown = doc.contents;
  for (const segment of pathSegments(path)) {
    if (isMap(node)) {
      node = node.items.find(
        (pair) => (isScalar(pair.key) ? String(pair.key.value) : String(pair.key)) === segment,
      )?.value;
    } else if (isSeq(node) && typeof segment === "number") {
      node = node.items[segment];
    } else {
      return undefined;
    }
  }
  return node;
}

/** `*name` (an alias) or a node an anchor names (`&name`) elsewhere. Either makes a text-only
 * rename or removal of the key unsafe: the source map a resolved alias leaves behind points at
 * the ANCHOR's own location, not the alias's, so an edit built from it lands in the wrong place;
 * removing an anchor's own key can also strand another node's `*name`. */
function isAnchorOrAlias(node: unknown): boolean {
  if (isAlias(node)) return true;
  if (isScalar(node) || isMap(node) || isSeq(node)) {
    return typeof (node as { anchor?: unknown }).anchor === "string";
  }
  return false;
}

/** Whether `key` on the entry at `path` is set through a YAML anchor or alias. */
function keyIsAnchored(doc: { contents: unknown }, path: string, key: string): boolean {
  return isAnchorOrAlias(cstAt(doc, path ? `${path}.${key}` : key));
}

/** Compile the entire drawing, excluding only catalog provenance newly added by migration. */
function drawing(text: string, catalog: CatalogLookup): string | null {
  const checked = checkText(text, ICON_NAMES, { catalog });
  if (!checked.ok || !checked.spec) return null;
  return JSON.stringify({
    ...checked.spec,
    nodes: checked.spec.nodes.map((node) => {
      const { catalogEntry: _catalogEntry, ...data } = node.data;
      return { ...node, data };
    }),
  });
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
  options: RefFirstOptions = {},
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
  const beforeDrawing = drawing(text, catalog);
  if (beforeDrawing === null) {
    return {
      text,
      changed: false,
      changes: [],
      skipped: [],
      badChoices: [],
      reason: "drawing-changed",
    };
  }
  const changes: RefFirstChange[] = [];
  const skipped: RefFirstSkip[] = [];
  // a `choices` id this file has no node for
  // is a typo worth reporting, same as a name below that names no catalog entry; a node simply
  // absent from `choices` (the common case) is never in this list.
  const nodeIds = new Set(ast.nodes.map((n) => n.id));
  const badChoices: string[] = Object.keys(choices)
    .filter((id) => !nodeIds.has(id))
    .map((id) => `"${id}" is not a node in this file`);
  for (const [id, choice] of Object.entries(choices)) {
    if (!nodeIds.has(id) || choice === "custom") continue;
    const name = choice.startsWith("catalog/") ? choice.slice("catalog/".length) : choice;
    if (!catalog.has(name)) badChoices.push(`"${id}": "${choice}" is not a catalog item`);
  }
  let out = text;
  // Node ids/paths only (to enumerate what to touch); every read of a value below re-parses
  // `out`, since each edit shifts every later offset.
  for (const node of ast.nodes) {
    if (node.ref !== undefined) continue;
    const { raw: rawNow, doc: docNow } = parseArchYaml(out);
    if (rawNow === undefined)
      return {
        text,
        changed: false,
        changes: [],
        skipped,
        badChoices,
        reason: "no-exact-edit",
      };
    if (isAnchorOrAlias(cstAt(docNow, node.path))) {
      skipped.push({ id: node.id, reason: "the node uses a YAML anchor or alias" });
      continue;
    }
    const entryRaw = rawEntryOf(rawNow, node.path);
    if (!entryRaw) continue;
    const choice = choices[node.id];
    if (choice === "custom") continue;
    const writtenIcon = typeof entryRaw.icon === "string" ? entryRaw.icon : undefined;
    // a choice written in the documented ref form ("catalog/aws/rds")
    // names the same catalog entry as the bare name ("aws/rds"); accept either.
    const catalogPrefix = `${CATALOG_REF_ROOT}/`;
    const chosenName = choice?.startsWith(catalogPrefix)
      ? choice.slice(catalogPrefix.length)
      : choice;
    const onlyNamed = options.onlyNamed ?? ast.nodes.some((n) => n.ref !== undefined);
    const name = onlyNamed ? chosenName : (chosenName ?? writtenIcon);
    if (name === undefined) continue;
    const entry = catalog.get(name);
    if (!entry) {
      // an EXPLICIT choice that names no
      // catalog entry is reported; a node with no `choices` entry that simply has no catalog
      // icon (the ordinary case) stays silently custom, as always.
      continue;
    }
    const supplied: Supplied = suppliedBy(entry, catalog);

    // An unwritten key (`isSuppliedKeyWritten`, types.ts: missing, or YAML null; never an
    // explicit "", which is a written override) would start drawing the reference's value once
    // `ref:` lands (`resolveCatalogRefs` fills every SUPPLIED_KEY the node's `unwritten` names),
    // so every drawing stays identical. `title` and `type` always have a value to pin (the id /
    // "service" fallback, `normalize.ts`), unless that fallback value is itself "" (impossible
    // today, since an id and "service" are never blank, but a pinned "" would become a written
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
    // The entry's own NAME is never enough to rename on: a part's name can differ from its drawn
    // icon (`generic/users` → `lucide/users`), so only a written icon that already equals what
    // the reference draws is safe to fold away. Even then, an icon set through an anchor or
    // alias keeps `icon:` written: the source map an alias leaves behind points at the anchor,
    // not the alias, so a rename there would land in the wrong place.
    const renamed =
      writtenIcon === entry.icon && !keyIsAnchored(docNow, node.path, "icon")
        ? renameEntryKey(out, node.path, "icon", "ref", ref)
        : setEntryKeys(out, node.path, { ref }, { after: "id" });
    if (renamed === null)
      return {
        text,
        changed: false,
        changes: [],
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
          text,
          changed: false,
          changes: [],
          skipped,
          badChoices,
          reason: "no-exact-edit",
        };
      out = withPins;
    }
    const { raw: rawAfterRef, sourceMap: mapAfterRef, doc: docAfterRef } = parseArchYaml(out);
    if (rawAfterRef === undefined) {
      return {
        text,
        changed: false,
        changes: [],
        skipped,
        badChoices,
        reason: "no-exact-edit",
      };
    }
    const entryAfterRef = rawEntryOf(rawAfterRef, node.path);
    const patch: Record<string, WriteValue | undefined> = {};
    const dropped: string[] = [];
    const kept: string[] = [];
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
      // A key a YAML anchor or alias sets stays written: removing an anchor's own key can strand
      // another node's `*name`, and the source map cannot place an edit on an alias.
      if (keyIsAnchored(docAfterRef, node.path, key)) {
        kept.push(key);
        continue;
      }
      patch[key] = undefined;
      dropped.push(key);
    }
    // a drop that could not be spliced exactly is reported,
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
      ...(kept.length > 0 && { kept }),
      ...(dropFailed && { reason: "no-exact-edit" as const }),
    });
  }
  if (changes.length === 0) {
    return { text: out, changed: false, changes, skipped, badChoices };
  }
  // A last, whole-file check: every node must still draw exactly what it drew before this pass,
  // whether or not it is in `changes`. Catches anything the per-key guards above missed, rather
  // than trusting them to be exhaustive.
  const after = drawing(out, catalog);
  if (after === null || beforeDrawing !== after) {
    return {
      text,
      changed: false,
      changes: [],
      skipped,
      badChoices,
      reason: "drawing-changed",
    };
  }
  return { text: out, changed: true, changes, skipped, badChoices };
}
