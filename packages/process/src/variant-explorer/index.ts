/**
 * VariantExplorer (RM-054) — public surface: the explorer, its labels, and the pure
 * coverage-selection helper a host can reuse to preselect "the top N % of paths".
 */
export {
  VARIANT_EXPLORER_DEFAULT_LABELS,
  VARIANT_EXPLORER_ROW_HEIGHT,
  VariantExplorer,
} from "./variant-explorer";
export type {
  VariantExplorerLabels,
  VariantExplorerProps,
  VariantSelectMode,
} from "./variant-explorer";
export { selectVariantsByCoverage, VARIANT_EXPLORER_COLUMNS } from "./variant-explorer-model";
export type { VariantExplorerColumn } from "./variant-explorer-model";
