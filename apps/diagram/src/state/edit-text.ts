/**
 * DG-12 — top-bar toggles write the text, so the text stays the source of truth (plan D2).
 * Only the value's own characters change: a `yaml` `Document` round trip
 * (`doc.set(…); String(doc)`) re-flows flow maps, moves trailing comments and adds a
 * newline (tried on DG-09's `valid-full.yaml`), so the edit is spliced at DG-09's
 * source-map offsets instead. React-free.
 */
import { parseArchYaml } from "../spec/dialect";

export type TopLevelScalarKey = "direction" | "nodeStyle";

/**
 * `key: value` at the top level. Replaces the existing value, or inserts the line right
 * after `diagram:` when the key is absent. `null` when the text has YAML errors or no
 * `diagram:` key — the caller leaves the text alone.
 */
export function setTopLevelScalar(
  text: string,
  key: TopLevelScalarKey,
  value: string,
): string | null {
  const { raw, sourceMap } = parseArchYaml(text);
  if (raw === undefined) return null;
  const own = sourceMap.values.get(key);
  if (own) return text.slice(0, own[0]) + value + text.slice(own[1]);
  const version = sourceMap.values.get("diagram");
  if (!version) return null;
  const lineEnd = text.indexOf("\n", version[1]);
  const at = lineEnd === -1 ? text.length : lineEnd;
  return `${text.slice(0, at)}\n${key}: ${value}${text.slice(at)}`;
}
