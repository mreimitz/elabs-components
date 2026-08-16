/**
 * @qlik-coe-emea/qlabs-components-tokens — theme types
 *
 * The set of themes shipped with the design system. Each has a matching
 * `[data-theme="..."]` block in `themes.css`. `:root` holds a neutral light
 * BASE/fallback (not a selectable theme); the default is `qlik-bright`.
 * Adding a theme = add a value here + a block in themes.css.
 *
 * `THEMES` is the ACTIVE set — the one every gate, test, story, doc and release
 * enumerates. A theme that is experimental or on hold moves to `PAUSED_THEMES`
 * below; its CSS block stays in `themes.css` untouched, but nothing enumerates
 * it. See @.claude/rules/paused-surfaces.md.
 */

export const THEMES = ["qlik-bright", "qlik-dark"] as const;

export type ThemeName = (typeof THEMES)[number];

/**
 * Themes kept as SOURCE but paused — experimental / on hold by maintainer
 * decision. A paused theme:
 *
 * - keeps its `[data-theme="…"]` block in `themes.css` (pause ≠ delete),
 * - is NOT in `THEMES`, so `ThemeName`, `THEME_META`, `isThemeName`,
 *   `ThemeProvider`, `ThemeSwitcher` and the Storybook theme toolbar never
 *   offer it,
 * - is excluded from every gate, contrast test, theme sweep, doc and release,
 * - is NOT deleted, so un-pausing is a one-line move back into `THEMES`.
 *
 * `blueprint` is paused as of 2026-08-09 (maintainer decision — experimental
 * testing theme). Do not re-enumerate it anywhere; `pnpm paused:check` fails
 * the build if you do. See @.claude/rules/paused-surfaces.md.
 */
export const PAUSED_THEMES = ["blueprint"] as const;

/** A theme that exists in `themes.css` but is excluded from the active set. */
export type PausedThemeName = (typeof PAUSED_THEMES)[number];

/** True for a theme name that is paused (kept as source, never enumerated). */
export function isPausedThemeName(value: unknown): value is PausedThemeName {
  return typeof value === "string" && (PAUSED_THEMES as readonly string[]).includes(value);
}

export interface ThemeMeta {
  /** The value written to `data-theme`. */
  value: ThemeName;
  /** Human-readable label for theme switchers. */
  label: string;
  /** Whether the theme is predominantly dark (useful for image/asset swaps). */
  dark: boolean;
  /** One-line description for docs/UX. */
  description: string;
  /**
   * Default decoration dial (0–10) for this theme. The active themes are all 0;
   * a theme that wants ambient reprographic texture declares it here AND in its
   * `themes.css` block (locked by theme-decoration-parity.test.ts). The dial
   * itself stays fully live and is set per region/document — see
   * @.claude/rules/blueprint-decoration.md.
   */
  decorationLevel?: DecorationLevel;
}

export const THEME_META: Record<ThemeName, ThemeMeta> = {
  "qlik-bright": {
    value: "qlik-bright",
    label: "Qlik Bright",
    dark: false,
    description:
      "Qlik Cloud light theme — Qlik Green primary on near-white neutral surfaces; neutral grey text, 4px radius, blue focus ring, Qlik chart palette, Source Sans Pro.",
  },
  "qlik-dark": {
    value: "qlik-dark",
    label: "Qlik Dark",
    dark: true,
    description:
      "Qlik Cloud dark theme on warm charcoal surfaces with off-white ivory text — bright Qlik Green, blue focus ring, Qlik chart palette, Source Sans Pro, 4px radius.",
  },
  // `blueprint` is PAUSED (see PAUSED_THEMES) — its `themes.css` block stays,
  // but it has no THEME_META entry, so no switcher, toolbar or sweep offers it.
  // Un-pausing = restore this entry (label "Blueprint", dark, decorationLevel 10
  // — which MUST equal the `--decoration` its themes.css block sets, since
  // ThemeProvider derives `effectiveDecoration` from here) and move the name back
  // into THEMES.
};

/** Default theme applied when nothing is persisted. */
export const DEFAULT_THEME: ThemeName = "qlik-bright";

/** Runtime guard for narrowing unknown strings (e.g. persisted values). */
export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/* ==========================================================================
   MOTION PREFERENCE
   A user-facing override for micro-interaction motion, layered over the OS
   `prefers-reduced-motion` setting and the per-theme default. Mirrors the
   THEMES / ThemeName / isThemeName surface above. The ThemeProvider persists
   the choice and writes `data-motion-pref` (see themes.css "MOTION GATE").
   ========================================================================== */

/**
 * The three motion settings a user can choose, in precedence-neutral order:
 * - `system`  — follow the OS `prefers-reduced-motion` setting (no attribute).
 * - `reduced` — minimize motion regardless of the OS.
 * - `full`    — always animate, even if the OS asks to reduce (informed consent).
 */
export const MOTION_PREFERENCES = ["system", "reduced", "full"] as const;

export type MotionPreference = (typeof MOTION_PREFERENCES)[number];

export interface MotionPreferenceMeta {
  /** The value written to `data-motion-pref` (`system` writes no attribute). */
  value: MotionPreference;
  /** Human-readable label for settings UIs. */
  label: string;
  /** One-line description for docs/UX. */
  description: string;
}

export const MOTION_PREFERENCE_META: Record<MotionPreference, MotionPreferenceMeta> = {
  system: {
    value: "system",
    label: "System",
    description: "Follow the operating system's reduce-motion setting.",
  },
  reduced: {
    value: "reduced",
    label: "Reduce motion",
    description: "Minimize animation regardless of the system setting.",
  },
  full: {
    value: "full",
    label: "Full motion",
    description: "Always animate, even when the system requests reduced motion.",
  },
};

/** Default motion preference when nothing is persisted. */
export const DEFAULT_MOTION_PREFERENCE: MotionPreference = "system";

/** Runtime guard for narrowing unknown strings (e.g. persisted values). */
export function isMotionPreference(value: unknown): value is MotionPreference {
  return typeof value === "string" && (MOTION_PREFERENCES as readonly string[]).includes(value);
}

/* ==========================================================================
   DECORATION LEVEL
   The "blueprint-ness" dial (0–10), ORTHOGONAL to color: 0 = plain themed UI,
   10 = full reprographic drafting (grid, hatch, drawn-not-filled, squared). Set
   it on any theme/region/document to add gentle blueprint texture in ANY color.
   Mirrors the MOTION surface above; the ThemeProvider persists the choice and
   writes `data-decoration`, defaulting to THEME_META[theme].decorationLevel
   (blueprint = 10). See themes.css "DECORATION DIAL" + .claude/rules/blueprint-decoration.md.
   ========================================================================== */

export const DECORATION_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export type DecorationLevel = (typeof DECORATION_LEVELS)[number];

/** Default decoration when nothing is persisted (the theme's own default wins). */
export const DEFAULT_DECORATION_LEVEL: DecorationLevel = 0;

/** Runtime guard for narrowing unknown values (e.g. persisted strings/numbers). */
export function isDecorationLevel(value: unknown): value is DecorationLevel {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 10;
}

/* ==========================================================================
   DENSITY MODE
   The density dial, ORTHOGONAL to color and decoration. It rescales BOTH size
   channels so a surface tightens or opens up as a whole, with zero component
   edits: Tailwind v4's global `--spacing` (every height/padding/gap/margin/
   space utility) AND the type scale (#340 — `--type-factor` multiplies every
   `--text-<role>` size + line-height; weight and tracking are untouched).
   Type moves at roughly half spacing's rate (±6.25% vs ~11-12%) and is capped
   by a legibility floor — body never below 13px.
   `comfortable` is the identity value on both channels (0.25rem = Tailwind's
   default, factor 1) so the default render is pixel-identical to pre-density
   builds.
   Mirrors the DECORATION surface above; the ThemeProvider persists the choice
   and writes `data-density` (omitting it for `comfortable` to avoid flash).
   See density.css and @.claude/rules/styling-and-tokens.md.
   ========================================================================== */

export const DENSITIES = ["compact", "comfortable", "spacious"] as const;

export type DensityMode = (typeof DENSITIES)[number];

export interface DensityMeta {
  /** The value written to `data-density`. */
  value: DensityMode;
  /** Human-readable label for density switchers. */
  label: string;
  /** One-line description for docs/UX. */
  description: string;
}

export const DENSITY_META: Record<DensityMode, DensityMeta> = {
  compact: {
    value: "compact",
    label: "Compact",
    description: "Tighter spacing (~11%) and smaller type (~6%) — denser tables and toolbars.",
  },
  comfortable: {
    value: "comfortable",
    label: "Comfortable",
    description: "Default spacing and type size (identity — no change from the baseline).",
  },
  spacious: {
    value: "spacious",
    label: "Spacious",
    description: "Roomier spacing (~12%) and larger type (~6%) — touch-friendly dashboards.",
  },
};

/** Default density when nothing is persisted. Identity: comfortable = no change. */
export const DEFAULT_DENSITY: DensityMode = "comfortable";

/** Runtime guard for narrowing unknown strings (e.g. persisted values). */
export function isDensity(value: unknown): value is DensityMode {
  return typeof value === "string" && (DENSITIES as readonly string[]).includes(value);
}

/* ==========================================================================
   TASTE REGISTER
   WHICH BAR a surface is judged against — the ONE axis the design system was
   missing (#108). The other three taste axes already ship as token dials
   (density, motion, decoration); the register is a judgment setting, not a
   visual one, so it has NO CSS of its own. It is written to the root as
   `data-register` purely as an inspectable seam (an audit/agent can read the
   active register off the DOM); nothing in themes.css keys off it.
   Mirrors the MOTION / DECORATION / DENSITY surfaces above.
   ========================================================================== */

/**
 * The two bars a surface can be judged against:
 * - `product` — app UI, dashboards, admin, tools. The bar is EARNED FAMILIARITY:
 *   restrained color, one type family, every state present, quick state-only
 *   motion. brand-ui's default and the overwhelming majority of surfaces.
 * - `brand`   — marketing surfaces, landing pages, campaigns. The bar is
 *   DISTINCTIVENESS: committed color, real imagery, ambitious first-load motion,
 *   a point of view. "Restraint without intent reads as mediocre."
 */
export const TASTE_REGISTERS = ["product", "brand"] as const;

export type TasteRegister = (typeof TASTE_REGISTERS)[number];

export interface TasteRegisterMeta {
  /** The value written to `data-register`. */
  value: TasteRegister;
  /** Human-readable label for settings UIs / interviews. */
  label: string;
  /** One-line description for docs/UX. */
  description: string;
}

export const TASTE_REGISTER_META: Record<TasteRegister, TasteRegisterMeta> = {
  product: {
    value: "product",
    label: "Product",
    description:
      "App UI, dashboards, admin, tools. The bar is earned familiarity — restrained color, every state present, quick state-only motion.",
  },
  brand: {
    value: "brand",
    label: "Brand",
    description:
      "Marketing surfaces, landing pages, campaigns. The bar is distinctiveness — committed color, real imagery, ambitious first-load motion, a point of view.",
  },
};

/** Default register when nothing is persisted. Restrained by default. */
export const DEFAULT_TASTE_REGISTER: TasteRegister = "product";

/** Runtime guard for narrowing unknown strings (e.g. persisted/config values). */
export function isTasteRegister(value: unknown): value is TasteRegister {
  return typeof value === "string" && (TASTE_REGISTERS as readonly string[]).includes(value);
}

/* ==========================================================================
   TASTE PROFILE
   The four taste axes as ONE named, machine-readable object (#72 / #108).
   Three of the four are the dials above; `expressiveness` IS the decoration
   dial (0–10) — deliberately NOT a fourth CSS variable, because `--decoration`
   already encodes "how expressive is this surface" hue-independently. See
   docs/ADR/0020-taste-profile.md and @.claude/rules/theming.md.
   ========================================================================== */

export interface TasteProfile {
  /** Which bar the surface is judged against (product = restrained default). */
  register: TasteRegister;
  /** Density — the `data-density` dial (spacing AND type scale, #340). */
  density: DensityMode;
  /** Motion setting — the `data-motion-pref` dial. */
  motion: MotionPreference;
  /**
   * How expressive the surface is allowed to be, 0–10. This IS the decoration
   * dial (`--decoration` / `data-decoration`) — one dial, two names, never two
   * knobs. 0 = restrained (the default); 10 = full reprographic drafting.
   */
  expressiveness: DecorationLevel;
}

/**
 * The restrained default profile: product register, comfortable density, system
 * motion, expressiveness 0. Expressive is OPT-IN — a scaffold that asks for
 * nothing gets a calm, app-first surface.
 */
export const DEFAULT_TASTE_PROFILE: TasteProfile = {
  register: DEFAULT_TASTE_REGISTER,
  density: DEFAULT_DENSITY,
  motion: DEFAULT_MOTION_PREFERENCE,
  expressiveness: DEFAULT_DECORATION_LEVEL,
};
