/**
 * @elabs-ai/components-tokens — theme types
 *
 * ## Theming is OPEN (ADR 0029)
 *
 * A theme is **not** a member of a closed union. `ThemeName` is `string`, and a
 * theme is anything that has a `[data-theme="<name>"]` block covering the token
 * contract (`THEME_TOKEN_NAMES`). A consumer authors one, registers it with
 * `<ThemeProvider themes={[...]}>`, and every component themes correctly with no
 * change to this package.
 *
 * `:root` holds a neutral light BASE/fallback — not a selectable theme — so a
 * consumer who imports only `styles.css` still renders correctly.
 *
 * `BUILT_IN_THEMES` are the two REFERENCE themes this package ships (`light`,
 * `dark`). They are the default registry and the worked example, not a
 * restriction. Every gate, test, story, doc and release enumerates them.
 *
 * ## Light or dark is a CSS fact, not a registry fact
 *
 * Every theme block declares `color-scheme: light|dark`, so `resolveThemeIsDark`
 * answers "is the active theme dark" for ANY theme — including one this package
 * has never heard of. Components that need to swap an asset, a Monaco base or a
 * basemap flavour call that, NOT a registry lookup. A registry lookup is a
 * hard-coded guess about a name; the computed `color-scheme` is what the theme
 * itself says.
 */

/**
 * A theme name is any string with a matching `[data-theme="…"]` block. It is
 * deliberately OPEN (it was a closed union before ADR 0029) — a consumer theme
 * is a first-class theme, not a cast.
 *
 * Because this no longer narrows, there is no `isThemeName` guard: "is this a
 * string" is not a useful check. Validate against a REGISTRY instead —
 * `useTheme().themes` at runtime, or `isBuiltInThemeName` when you specifically
 * mean one of the two shipped reference themes.
 */
export type ThemeName = string;

/**
 * What a theme declares ABOUT ITSELF to the UI — the registry entry. The colours
 * live in CSS (`[data-theme="<value>"]`); this is the switcher-facing descriptor.
 *
 * Pass an array of these to `<ThemeProvider themes={…}>` to register consumer
 * themes. Build them with `defineTheme` so a typo is a compile error.
 */
export interface ThemeDefinition {
  /** The value written to `data-theme` — must match the CSS block's selector. */
  value: ThemeName;
  /** Human-readable label for theme switchers. */
  label: string;
  /**
   * Whether the theme is predominantly dark. Drives switcher ICONOGRAPHY and
   * `pickByDarkness` (which theme "System" resolves to).
   *
   * It is NOT how a component decides to swap an asset, a Monaco base or a
   * basemap flavour — those call `resolveThemeIsDark`, which reads the theme's
   * own `color-scheme` and therefore works for a theme that was never
   * registered. Keep this in agreement with the CSS block's `color-scheme`.
   */
  dark: boolean;
  /** One-line description for docs/UX. Optional for consumer themes. */
  description?: string;
  /**
   * Default decoration dial (0–10) for this theme. Both reference themes are 0;
   * a theme that wants ambient reprographic texture declares it here AND in its
   * `themes.css` block (locked by theme-decoration-parity.test.ts). The dial
   * itself is set per region/document — see @.claude/rules/decoration.md.
   */
  decorationLevel?: DecorationLevel;
}

/**
 * Identity helper: types and validates a consumer theme at AUTHOR time.
 *
 * ```ts
 * const midnight = defineTheme({ value: "midnight", label: "Midnight", dark: true });
 * <ThemeProvider themes={[...BUILT_IN_THEME_DEFINITIONS, midnight]} />
 * ```
 *
 * It deliberately does not check that the CSS block exists or that the token
 * contract is covered — that is a build-time property, asserted by testing your
 * stylesheet against `THEME_TOKEN_NAMES` (see ADR 0029 §"Validating your theme").
 */
export function defineTheme(definition: ThemeDefinition): ThemeDefinition {
  return definition;
}

/**
 * The REFERENCE themes shipped in this package. Two, by design: enough to prove
 * the light/dark contract, few enough that a consumer reads them as examples
 * rather than as the menu.
 */
export const BUILT_IN_THEMES = ["light", "dark"] as const;

/** One of the two reference themes this package ships. */
export type BuiltInThemeName = (typeof BUILT_IN_THEMES)[number];

export const BUILT_IN_THEME_META: Record<BuiltInThemeName, ThemeDefinition> = {
  light: {
    value: "light",
    label: "Light",
    dark: false,
    description:
      "Reference light theme — brand primary on near-white neutral surfaces; neutral grey text, 4px radius.",
  },
  dark: {
    value: "dark",
    label: "Dark",
    dark: true,
    description:
      "Reference dark theme — warm charcoal surfaces with off-white text; the same brand primary, 4px radius.",
  },
};

/**
 * The default `ThemeProvider` registry, in switcher order. Spread it to KEEP the
 * reference themes alongside your own; omit it to ship only your own.
 */
export const BUILT_IN_THEME_DEFINITIONS: readonly ThemeDefinition[] = BUILT_IN_THEMES.map(
  (name) => BUILT_IN_THEME_META[name],
);

/** Default theme applied when nothing is persisted. */
export const DEFAULT_THEME: ThemeName = "light";

/** True for one of the two reference themes this package ships. */
export function isBuiltInThemeName(value: unknown): value is BuiltInThemeName {
  return typeof value === "string" && (BUILT_IN_THEMES as readonly string[]).includes(value);
}

/**
 * Is the theme in effect on `el` a DARK theme? Works for ANY theme, including
 * one this package has never heard of — which is the whole point.
 *
 * Resolution order:
 *
 * 1. **The computed `color-scheme`** on the element. Every theme block is
 *    required to declare `color-scheme: light|dark` (@.claude/rules/theming.md),
 *    and the property inherits, so this is the theme telling you directly. It is
 *    authoritative because it survives a consumer OVERRIDING a built-in theme's
 *    block — a registry lookup would not.
 * 2. **The built-in registry**, keyed off `data-theme`. Covers jsdom and any
 *    environment where computed styles are not resolvable (the tokens
 *    stylesheet is usually not loaded in unit tests).
 * 3. **`prefers-color-scheme`**, when no theme is applied at all.
 *
 * Defaults to `false` (light) with no DOM — SSR-safe.
 */
export function resolveThemeIsDark(el?: Element | null): boolean {
  if (typeof document === "undefined") return false;
  const target = el ?? document.documentElement;
  if (!target) return false;

  // 1. The theme's own declaration. jsdom returns "" here (no stylesheet
  //    applied), which correctly falls through rather than reporting "light".
  if (typeof window !== "undefined" && typeof window.getComputedStyle === "function") {
    const scheme = window.getComputedStyle(target).colorScheme;
    // `color-scheme` may legitimately be a LIST ("light dark") meaning "either
    // is fine" — that is not a claim about this theme, so only a single,
    // unambiguous keyword counts.
    if (scheme === "dark") return true;
    if (scheme === "light") return false;
  }

  // 2. A registered reference theme, read off the nearest `data-theme`.
  const themed = target.closest?.("[data-theme]") ?? document.querySelector("[data-theme]");
  const name = themed?.getAttribute("data-theme");
  if (name && isBuiltInThemeName(name)) return BUILT_IN_THEME_META[name].dark;

  // 3. No theme applied — follow the OS.
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return false;
}

/* ==========================================================================
   MOTION PREFERENCE
   A user-facing override for micro-interaction motion, layered over the OS
   `prefers-reduced-motion` setting and the per-theme default. Mirrors the
   BUILT_IN_THEMES / meta / guard surface above. The ThemeProvider persists
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
   The drafting-texture dial (0–10), ORTHOGONAL to color: 0 = plain themed UI,
   10 = full reprographic drafting (grid, hatch, drawn-not-filled, squared). Set
   it on any theme/region/document to add gentle texture in ANY color.
   Mirrors the MOTION surface above; the ThemeProvider persists the choice and
   writes `data-decoration`, defaulting to the ACTIVE REGISTRY ENTRY's
   `decorationLevel` — so a consumer theme declares its own default the same way
   a built-in does. See themes.css "DECORATION DIAL" + .claude/rules/decoration.md.
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
