/**
 * @elabs/components-tokens
 *
 * Token-driven theming for the brand-ui design system.
 *
 * Consumers MUST import the stylesheet once at the app root:
 *   import "@elabs/components-tokens/styles.css";
 *
 * Then wrap the app in <ThemeProvider> and switch themes with useTheme().
 */
export {
  ThemeProvider,
  useTheme,
  useMotionPreference,
  useReducedMotion,
  useDecoration,
  useDensity,
  useTasteProfile,
  type ThemeProviderProps,
} from "./theme-provider";

export { DecorationProvider, type DecorationProviderProps } from "./decoration-provider";

export {
  oklchToHex,
  resolveTokenColor,
  type ResolveTokenColorOptions,
} from "./resolve-token-color";

export {
  BUILT_IN_THEMES,
  BUILT_IN_THEME_META,
  BUILT_IN_THEME_DEFINITIONS,
  DEFAULT_THEME,
  defineTheme,
  isBuiltInThemeName,
  resolveThemeIsDark,
  type ThemeName,
  type BuiltInThemeName,
  type ThemeDefinition,
  PAUSED_THEMES,
  isPausedThemeName,
  type PausedThemeName,
  MOTION_PREFERENCES,
  MOTION_PREFERENCE_META,
  DEFAULT_MOTION_PREFERENCE,
  isMotionPreference,
  type MotionPreference,
  type MotionPreferenceMeta,
  DECORATION_LEVELS,
  DEFAULT_DECORATION_LEVEL,
  isDecorationLevel,
  type DecorationLevel,
  DENSITIES,
  DENSITY_META,
  DEFAULT_DENSITY,
  isDensity,
  type DensityMode,
  type DensityMeta,
  TASTE_REGISTERS,
  TASTE_REGISTER_META,
  DEFAULT_TASTE_REGISTER,
  isTasteRegister,
  type TasteRegister,
  type TasteRegisterMeta,
  DEFAULT_TASTE_PROFILE,
  type TasteProfile,
} from "./theme-types";

/**
 * The token contract every theme must cover (ADR 0029) — GENERATED from
 * `themes.css`, kept fresh by `pnpm token-contract:check`. Assert your own
 * theme's stylesheet against it so a missing token fails your build instead of
 * falling back to `:root` and rendering wrong.
 */
export { THEME_TOKEN_NAMES, type ThemeTokenName } from "./theme-token-names.generated";
