/**
 * DG-26 — dialect 0 → 1 as a text edit (N3: an upgrader for every major step; DG-60 chains the
 * next). v1 is a superset of v0: the version key changes and, on line 1 only, a
 * yaml-language-server modeline that names the v0 schema. Never a yaml Document round trip
 * (write-back.ts). React-free.
 */
import { parseArchYaml } from "./parse";
import { normalizeArch } from "./normalize"; // DG-26 (1b.8)
import { catalogNameOf } from "./ids"; // DG-26 (1b.8)
import { suppliedBy, type CatalogLookup } from "./catalog-refs"; // DG-26 (1b.8)
import { renameEntryKey, setEntryKeys, type WriteValue } from "./write-back";
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
// run on open. `choices` names the ref for the nodes an author (or the maintainer's ruling)
// picked; a node not named is left exactly as it is written — a stand-in with no catalog
// item, a custom node with no equivalent, a zone.

/** node id → the ref to write (`catalog/aws/glue`, `ws/components/qlik-cloud-tenant`). */
export type RefChoices = Readonly<Record<string, string>>;

export interface RefFirstChange {
  id: string;
  ref: string;
  /** title/subtitle/type/badges removed because the reference now supplies the same value. */
  dropped: readonly string[];
}

export interface RefFirstResult {
  text: string;
  changed: boolean;
  changes: readonly RefFirstChange[];
}

const sameList = (a: readonly string[] | undefined, b: readonly string[] | undefined) =>
  a !== undefined && b !== undefined && a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * Rewrite `icon:` as `ref:` for each id `choices` names to a CATALOG reference (a diagram
 * reference is Part 2's to fill and is left as `icon:` until then); drop title, subtitle,
 * type and badges only where the written value equals what the catalog entry now supplies.
 * Comments, blank lines, every other node and the file's layout stay byte-identical.
 */
export function refFirstText(
  text: string,
  choices: RefChoices,
  catalog: CatalogLookup,
): RefFirstResult {
  const { raw, sourceMap } = parseArchYaml(text);
  if (raw === undefined) return { text, changed: false, changes: [] };
  const { ast } = normalizeArch(raw, sourceMap);
  if (!ast) return { text, changed: false, changes: [] };
  const changes: RefFirstChange[] = [];
  let out = text;
  for (const node of ast.nodes) {
    const ref = choices[node.id];
    if (ref === undefined || node.icon === undefined || node.ref !== undefined) continue;
    const name = catalogNameOf(ref);
    const entry = name !== undefined ? catalog.get(name) : undefined;
    if (!entry) continue; // not a catalog reference (yet): leave icon: as it is written
    const renamed = renameEntryKey(out, node.path, "icon", "ref", ref);
    if (renamed === null) continue;
    out = renamed;
    const supplied = suppliedBy(entry, catalog);
    const patch: Record<string, WriteValue | undefined> = {};
    const dropped: string[] = [];
    if (node.title !== undefined && node.title === supplied.title) {
      patch.title = undefined;
      dropped.push("title");
    }
    if (node.subtitle !== undefined && node.subtitle === supplied.subtitle) {
      patch.subtitle = undefined;
      dropped.push("subtitle");
    }
    if (node.type !== undefined && node.type === supplied.type) {
      patch.type = undefined;
      dropped.push("type");
    }
    if (node.badges !== undefined && sameList(node.badges, supplied.badges)) {
      patch.badges = undefined;
      dropped.push("badges");
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
