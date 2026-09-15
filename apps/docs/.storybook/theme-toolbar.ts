/**
 * The Theme / Mode toolbar contract shared by `preview.tsx` and `manager.tsx`
 * (ADR 0036). The preview owns the registry (built-ins + the generated
 * downloadable families) and publishes a plain summary on the channel; the
 * manager renders from it without importing the token package.
 *
 * Globals:
 *   - `theme` — a FAMILY id picked in the toolbar (`default`, `ocean`), OR a
 *     variant name (`dark`, `ocean-dark`). A variant name always wins as-is, so
 *     `globals=theme:dark` URLs, the storybook-mcp `theme:<slug>` contract and
 *     per-story `globals: { theme: "dark" }` keep working unchanged.
 *   - `mode` — `light` | `dark`, applied only when `theme` is a family id.
 */
export const THEME_FAMILIES_EVENT = "brand-ui/theme-families";

export type ToolbarScheme = "light" | "dark";

export interface ToolbarThemeFamily {
  id: string;
  label: string;
  schemes: readonly ToolbarScheme[];
  /** Variant name per scheme present in the family. */
  variants: Partial<Record<ToolbarScheme, string>>;
}

/** The family a `theme` global names — directly, or through one of its variants. */
export function findFamily(
  families: readonly ToolbarThemeFamily[],
  theme: string | undefined,
): { family: ToolbarThemeFamily; variantScheme?: ToolbarScheme } | undefined {
  if (!theme) return undefined;
  for (const family of families) {
    if (family.id === theme) return { family };
    for (const scheme of family.schemes) {
      if (family.variants[scheme] === theme) return { family, variantScheme: scheme };
    }
  }
  return undefined;
}

/**
 * The `data-theme` value for a `theme` + `mode` global pair. An unknown value is
 * passed through untouched (a story may deliberately render an unregistered
 * theme); an empty one resolves the first family.
 */
export function resolveToolbarTheme(
  families: readonly ToolbarThemeFamily[],
  theme: string | undefined,
  mode: string | undefined,
): string {
  const found = findFamily(families, theme || families[0]?.id);
  if (!found) return theme ?? "";
  const { family, variantScheme } = found;
  if (variantScheme) return family.variants[variantScheme] ?? theme ?? "";
  const scheme: ToolbarScheme = mode === "dark" ? "dark" : "light";
  return family.variants[scheme] ?? family.variants[family.schemes[0] ?? "light"] ?? family.id;
}
