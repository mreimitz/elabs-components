/**
 * DG-26 — dialect 0 → 1 as a text edit (N3: an upgrader for every major step; DG-60 chains the
 * next). v1 is a superset of v0: the version key changes and, on line 1 only, a
 * yaml-language-server modeline that names the v0 schema. Never a yaml Document round trip
 * (write-back.ts). React-free.
 */
import { parseArchYaml } from "./parse";
import { setEntryKeys } from "./write-back";
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
