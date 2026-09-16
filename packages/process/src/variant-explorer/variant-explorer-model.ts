/**
 * Pure helpers behind `VariantExplorer` (RM-054) — no React, so the selection semantics
 * are unit-testable on their own and identical on every render.
 */
import type { Variant } from "../core/types";

/** The optional numeric columns a variant row can show, in display order. */
export type VariantExplorerColumn = "cases" | "coverage" | "medianDuration";

/** Every column, in the order the explorer renders them. */
export const VARIANT_EXPLORER_COLUMNS: readonly VariantExplorerColumn[] = Object.freeze([
  "cases",
  "coverage",
  "medianDuration",
]);

/**
 * The smallest prefix of `variants` whose `cumulativeShare` reaches `target`.
 *
 * `variants` is expected in `extractVariants` order (count descending, fully tie-broken),
 * so the prefix is the set of most frequent paths that together cover `target` of the
 * cases. Deterministic: the same variants and target always yield the same id list. A
 * target of `0` or less selects nothing; a target above the last variant's share selects
 * every variant. A tiny epsilon absorbs float noise in `cumulativeShare` so a `0.5`
 * target is met by a variant whose share prints as exactly 50 %.
 */
export function selectVariantsByCoverage(variants: readonly Variant[], target: number): string[] {
  if (!(target > 0)) return [];
  const ids: string[] = [];
  for (const variant of variants) {
    ids.push(variant.id);
    if (variant.cumulativeShare >= target - 1e-9) break;
  }
  return ids;
}

/** Fill `{name}` placeholders in a labels string. Unknown names are left as written. */
export function fillLabel(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}
