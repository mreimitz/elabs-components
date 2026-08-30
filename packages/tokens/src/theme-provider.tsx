"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  BUILT_IN_THEME_DEFINITIONS,
  DEFAULT_DENSITY,
  DEFAULT_MOTION_PREFERENCE,
  DEFAULT_TASTE_REGISTER,
  DEFAULT_THEME,
  isDecorationLevel,
  isDensity,
  isMotionPreference,
  isTasteRegister,
  type DecorationLevel,
  type DensityMode,
  type MotionPreference,
  type TasteProfile,
  type TasteRegister,
  type ThemeDefinition,
  type ThemeName,
} from "./theme-types";
import { THEME_TOKEN_NAMES, type ThemeTokenName } from "./theme-token-names.generated";

interface ThemeContextValue {
  /** The active theme. */
  theme: ThemeName;
  /**
   * The theme names this provider exposes — its registry, narrowed by
   * `allowedThemes` when one was given. Read this (never a module-level
   * constant) when building a switcher: with theming open (ADR 0029) the
   * provider's registry is the only thing that knows what this app ships.
   */
  themes: readonly ThemeName[];
  /**
   * The same themes as full descriptors, in the same order — label, `dark`
   * flag, description. A switcher renders straight off this and needs no
   * import; a consumer theme appears here exactly like a built-in one.
   */
  themeDefinitions: readonly ThemeDefinition[];
  /** Set the active theme. */
  setTheme: (theme: ThemeName) => void;
  /** The user's motion preference (over the OS setting and theme default). */
  motionPreference: MotionPreference;
  /** Set the motion preference. */
  setMotionPreference: (preference: MotionPreference) => void;
  /** Whether the OS currently requests reduced motion (live, via matchMedia). */
  prefersReducedMotion: boolean;
  /** Decoration dial override (0–10), or null = follow the active theme's default. */
  decoration: DecorationLevel | null;
  /** The EFFECTIVE decoration level in effect (override ?? theme default ?? 0). */
  effectiveDecoration: DecorationLevel;
  /** Set the decoration override (null = follow the theme default). */
  setDecoration: (level: DecorationLevel | null) => void;
  /** Active density mode — spacing AND type scale (#340). "comfortable" is the identity. */
  density: DensityMode;
  /** Set the density mode. */
  setDensity: (mode: DensityMode) => void;
  /** Which bar this app is judged against ("product" = restrained default). */
  register: TasteRegister;
  /** Set the taste register. */
  setRegister: (register: TasteRegister) => void;
  /**
   * The four taste axes assembled from the state above — the machine-readable
   * "what does this app want to feel like". `expressiveness` IS
   * `effectiveDecoration` (one dial, two names; see ADR 0020).
   */
  tasteProfile: TasteProfile;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export interface ThemeProviderProps {
  children: ReactNode;
  /**
   * Initial theme when nothing is persisted. Defaults to `DEFAULT_THEME`
   * ("light"). Passing one that `allowedThemes` excludes falls back to the
   * first allowed theme and warns in development; leaving it unset never warns
   * (the library default yielding to a subset is not a consumer mistake).
   */
  defaultTheme?: ThemeName;
  /** localStorage key used to persist the theme. Set `null` to disable. */
  storageKey?: string | null;
  /**
   * The theme REGISTRY — every theme this app offers (ADR 0029). Defaults to
   * `BUILT_IN_THEME_DEFINITIONS` (the two reference themes).
   *
   * Supplying it REPLACES the default rather than extending it, so shipping
   * only your own themes is expressible. Spread the built-ins to keep them:
   *
   * ```tsx
   * const midnight = defineTheme({ value: "midnight", label: "Midnight", dark: true });
   * <ThemeProvider themes={[...BUILT_IN_THEME_DEFINITIONS, midnight]} />  // both
   * <ThemeProvider themes={[midnight]} />                                 // only yours
   * ```
   *
   * Each entry's `value` must match a `[data-theme="<value>"]` block your app
   * has loaded, covering `THEME_TOKEN_NAMES`. An empty array is ignored — a
   * provider always exposes at least one theme.
   */
  themes?: readonly ThemeDefinition[];
  /**
   * Restrict this provider to a SUBSET of its registry (#355). When set:
   * `useTheme().themes` lists only these, a persisted value outside the list is
   * rejected during the same mount pass that applies the theme (so there is no
   * flash of a theme the product doesn't ship), and `setTheme` with a
   * disallowed name is a no-op that warns in development.
   *
   * Omit it (the default) for the whole registry. Names not in the registry and
   * an empty list are ignored — a provider always exposes at least one theme.
   *
   * With an open registry this is now the NARROWER of the two knobs, and mostly
   * redundant: pass the themes you ship as `themes` and you rarely need it. It
   * stays for the case it was built for (#355) — one registry, several products
   * each surfacing a slice of it.
   *
   * `ThemeSwitcher` (`@elabs-ai/components-ui`) automatically inherits this subset
   * (#384): it narrows its offered themes to the intersection of its own
   * `themes` prop and the provider's allowed list whenever the provider is
   * genuinely restricting (a strict subset of its registry). A non-restricting
   * provider leaves the prop untouched for backward compatibility.
   */
  allowedThemes?: readonly ThemeName[];
  /**
   * Initial motion preference when nothing is persisted. Defaults to "system".
   * Keep this "system" for zero-flash SSR: "system" writes no attribute, so the
   * first paint is governed purely by the OS `prefers-reduced-motion` media query.
   */
  defaultMotionPreference?: MotionPreference;
  /** localStorage key used to persist the motion preference. Set `null` to disable. */
  motionStorageKey?: string | null;
  /**
   * Initial decoration override when nothing is persisted. `null` (default) =
   * follow the active theme's own level (both reference themes = 0), writing no
   * attribute for zero-flash SSR.
   */
  defaultDecoration?: DecorationLevel | null;
  /** localStorage key used to persist the decoration override. Set `null` to disable. */
  decorationStorageKey?: string | null;
  /**
   * Initial density when nothing is persisted. Defaults to "comfortable"
   * (identity — the attribute is omitted so the first paint is unchanged).
   */
  defaultDensity?: DensityMode;
  /** localStorage key used to persist the density mode. Set `null` to disable. */
  densityStorageKey?: string | null;
  /**
   * Initial taste register when nothing is persisted. Defaults to "product"
   * (restrained; expressive is opt-in). Purely a judgment setting — no CSS keys
   * off it, so it can never cause a hydration flash.
   */
  defaultRegister?: TasteRegister;
  /** localStorage key used to persist the taste register. Set `null` to disable. */
  registerStorageKey?: string | null;
  /**
   * Element that receives the `data-theme` and `data-motion-pref` attributes.
   * Defaults to the document root (`<html>`). Pass a ref'd element for scoped
   * theming. NOTE: the OS-reduce backstop in themes.css is keyed off `:root`, so
   * a scoped target still honors per-instance theme/motion but the document-level
   * backstop continues to track the document root.
   */
  attributeTarget?: HTMLElement | null;
  /**
   * Runtime CSS custom-property overrides (#17,
   * `docs/ADR/0031-runtime-token-overrides.md`), layered OVER the active
   * `[data-theme]` block as inline properties on `attributeTarget` — for a
   * multi-tenant/white-label consumer who wants to patch 1-2 brand colors
   * without authoring a whole theme covering every `THEME_TOKEN_NAMES` entry.
   *
   * **Partial, not a replacement.** Only the keys you pass are forced; every
   * other token keeps coming from the active theme's own CSS block. This is
   * the point of the mechanism — unlike a hand-authored `[data-theme]` block, a
   * missing key here does NOT fall through to the neutral `:root` base, it
   * simply isn't overridden.
   *
   * **Keys are validated against `THEME_TOKEN_NAMES`.** A key this package
   * does not recognize as a theme token is REJECTED (not applied) with a dev
   * warning — the failure mode this guards against is a typo'd `--foo` that
   * silently does nothing because nothing in `themes.css` reads it, which
   * would otherwise look identical to success.
   *
   * **Values are ALSO checked, not just keys.** Every `THEME_TOKEN_NAMES`
   * entry except `--shadow-strength` resolves through a color-typed CSS
   * property somewhere in `themes.css`, so a value is checked with
   * `CSS.supports("color", value)` before it is applied; `--shadow-strength`
   * (a bare multiplier — `themes.css` § ELEVATION RAMP:
   * `calc(1% * var(--shadow-strength))`) is checked against a numeric CSS
   * grammar instead, since a plain number is not a valid CSS color. Either
   * way, a value that fails is REJECTED (not applied) with a dev warning, the
   * same treatment as an unknown key. This closes the more likely footgun
   * than a bad key: unlike an unrecognized custom-property NAME, `setProperty`
   * never rejects an invalid VALUE (custom properties accept any token
   * stream), so a typo'd color would otherwise silently compute to `unset` at
   * the point of use — transparent for a `background-color`, inherited for
   * `color` — and a typo'd `--shadow-strength` would invalidate every
   * `calc()` that references it, silently zeroing elevation. Where
   * `CSS.supports` itself is unavailable (some legacy runtimes; also this
   * package's own jsdom test environment, which does not implement it) a
   * COLOR value is applied UNCHECKED rather than blocked — this package has
   * no way to validate it there, and refusing every value on an engine that
   * can't answer the question would be worse than the risk it's declining to
   * check. `--shadow-strength`'s grammar check needs no `CSS` global, so it
   * is always enforced regardless.
   *
   * **Reactive, not mount-once.** Every render where this prop's content
   * changes re-applies it; a key removed between renders has its inline
   * property cleared so the theme's own value governs again. Overrides
   * survive a `setTheme` call — they are orthogonal to which theme is active,
   * which is what makes them useful for a tenant whose accent color must hold
   * across a light/dark toggle.
   *
   * **Cleared when the target changes, and on unmount — RESTORED, not just
   * deleted.** If `attributeTarget` resolves late (the callback-ref pattern
   * ADR 0029 documents: `null` on the first render, a real element once the
   * ref lands), the properties this provider forced on the FIRST target are
   * put back to whatever they held immediately before this provider touched
   * them — not simply removed — before anything is written to the new one.
   * The same restore runs when the provider unmounts, so closing a tenant
   * theme preview (e.g. an admin settings screen) restores the region to
   * whatever it carried before the preview, rather than either leaving the
   * previewed colors on the page OR erasing an unrelated inline value that
   * happened to occupy the same property first (e.g. the SSR-authored
   * anti-flash override `docs/CONSUMING.md` §5.2 recommends). Only a property
   * that was genuinely unset beforehand is removed outright.
   *
   * **SSR flashes.** Like every other apply in this provider, this runs in a
   * `useEffect` — never during server rendering. The first paint (and the
   * hydration frame) therefore shows the UN-overridden theme; the override
   * appears one paint later. For a tenant whose brand color must be correct
   * on the very first paint, emit the same custom properties in server-
   * rendered `<html>`/`<head>` (a small inline `<style>` or attribute keyed
   * off the same tenant data) — this prop does not do that for you. See
   * `docs/CONSUMING.md` § 5.2 and ADR 0031.
   *
   * **Uses `CSSStyleDeclaration.setProperty`/`removeProperty`, never
   * `style.cssText` or a `style="…"` attribute string.** Confirmed against
   * `docs/csp-policy.json`: a CSP `style-src` directive restricts parsing CSS
   * text from an HTML `style` attribute or a `<style>` element; it does not
   * restrict a script calling `setProperty` on the CSSOM directly (that is
   * gated by `script-src` alone, since a script that can call it already runs
   * under whatever `script-src` allows). So this needs no NEW CSP relaxation
   * beyond what `script-src` already grants the app's own bundle.
   */
  tokenOverrides?: Partial<Record<ThemeTokenName, string>>;
}

/**
 * The provider's REGISTRY: the supplied definitions, or the built-in reference
 * themes. An empty array falls back to the built-ins — "expose no theme at all"
 * is never a useful state, and silently rendering an unthemed app is worse than
 * ignoring the empty list. Duplicate `value`s collapse to the first entry, so a
 * consumer who spreads the built-ins AND redefines `light` gets their own.
 */
function resolveRegistry(
  themes: readonly ThemeDefinition[] | undefined,
): readonly ThemeDefinition[] {
  if (!themes || themes.length === 0) return BUILT_IN_THEME_DEFINITIONS;
  const seen = new Set<string>();
  const unique = themes.filter((t) => !seen.has(t.value) && seen.add(t.value));
  return unique.length > 0 ? unique : BUILT_IN_THEME_DEFINITIONS;
}

/**
 * Narrow a registry to the provider's `allowedThemes` (#355). Preserves registry
 * order, drops names the registry doesn't define, and falls back to the whole
 * registry when the subset would be empty — a provider must always expose a
 * theme.
 */
function resolveAllowedThemes(
  registry: readonly ThemeDefinition[],
  allowed: readonly ThemeName[] | undefined,
): readonly ThemeDefinition[] {
  if (!allowed) return registry;
  const subset = registry.filter((t) => allowed.includes(t.value));
  return subset.length > 0 ? subset : registry;
}

/**
 * The theme to start from: the requested default when it is allowed, otherwise
 * the first allowed theme. Used for BOTH the initial `useState` value and the
 * hydration fallback, so no render — not even the first — carries a theme the
 * product doesn't ship.
 */
function resolveDefaultTheme(requested: ThemeName, allowedThemes: readonly ThemeName[]): ThemeName {
  if (allowedThemes.includes(requested)) return requested;
  return allowedThemes[0] ?? DEFAULT_THEME;
}

/**
 * Identity key for a registry, so an INLINE `themes={[...]}` literal — a new
 * array on every render — doesn't churn `setTheme` and the context value. Keyed
 * on the fields that actually affect behaviour (`value` picks the theme,
 * `decorationLevel` feeds `effectiveDecoration`) plus `label`/`dark`, which a
 * switcher renders. A changed description alone is not worth a re-render.
 */
function registryKey(themes: readonly ThemeDefinition[] | undefined): string | null {
  if (!themes) return null;
  return themes.map((t) => `${t.value}|${t.label}|${t.dark}|${t.decorationLevel ?? ""}`).join(",");
}

/**
 * `process` is deliberately NOT in this package's type surface — it is a browser
 * package and its tsconfig lists only the React types, so the `dist` type build
 * has no `@types/node`. Declaring the one shape used here keeps the expression
 * `process.env.NODE_ENV` intact, which is what every bundler replaces at build
 * time (so the diagnostics below compile out of production bundles). Mirrors the
 * same guard in `@elabs-ai/components-data`'s DataTable.
 */
declare const process: { env: { NODE_ENV?: string } };

/** Dev-only diagnostic; compiled out of production bundles. */
function warnDev(message: string) {
  if (process.env.NODE_ENV !== "production") console.warn(`[brand-ui] ${message}`);
}

function applyTheme(theme: ThemeName, target: HTMLElement | null) {
  const el = target ?? (typeof document !== "undefined" ? document.documentElement : null);
  if (el) el.setAttribute("data-theme", theme);
}

function applyMotionPreference(preference: MotionPreference, target: HTMLElement | null) {
  const el = target ?? (typeof document !== "undefined" ? document.documentElement : null);
  if (!el) return;
  // "system" defers to the OS media query — remove the attribute entirely.
  if (preference === "system") el.removeAttribute("data-motion-pref");
  else el.setAttribute("data-motion-pref", preference);
}

function applyDecoration(level: DecorationLevel | null, target: HTMLElement | null) {
  const el = target ?? (typeof document !== "undefined" ? document.documentElement : null);
  if (!el) return;
  // null = follow the theme's own --decoration (remove the attribute) — zero-flash.
  if (level === null) el.removeAttribute("data-decoration");
  else el.setAttribute("data-decoration", String(level));
}

function applyRegister(register: TasteRegister, target: HTMLElement | null) {
  const el = target ?? (typeof document !== "undefined" ? document.documentElement : null);
  if (!el) return;
  // ALWAYS written (unlike density/decoration, which omit their identity value
  // to avoid a first-paint flash): no CSS keys off `data-register`, so there is
  // nothing to flash — and an explicit attribute lets an audit read the active
  // register instead of inferring it from the attribute's absence.
  el.setAttribute("data-register", register);
}

function applyDensity(mode: DensityMode, target: HTMLElement | null) {
  const el = target ?? (typeof document !== "undefined" ? document.documentElement : null);
  if (!el) return;
  // "comfortable" is the identity — omit the attribute so the first paint is
  // pixel-identical to a pre-density build (zero-flash, mirrors decoration's null).
  if (mode === "comfortable") el.removeAttribute("data-density");
  else el.setAttribute("data-density", mode);
}

/** O(1) membership check for `tokenOverrides` key validation. */
const KNOWN_THEME_TOKEN_NAMES = new Set<string>(THEME_TOKEN_NAMES);

/**
 * A stable, order-independent string key for a `tokenOverrides` object, so the
 * apply effect below can depend on CONTENT rather than object identity — an
 * inline `tokenOverrides={{...}}` literal is a new object on every render, the
 * same problem `registryKey`/`allowedKey` solve for the theme registry above.
 *
 * `JSON.stringify` of the sorted `[key, value]` pairs, not a hand-joined
 * `"k=v"` string — a delimiter-joined key can collide (`{"--a": "x --b=y"}`
 * and `{"--a": "x", "--b": "y"}` would otherwise produce the same key).
 */
function tokenOverridesKey(overrides: Partial<Record<ThemeTokenName, string>> | undefined): string {
  if (!overrides) return "";
  return JSON.stringify(
    Object.entries(overrides)
      .filter((entry): entry is [string, string] => entry[1] !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

/**
 * `THEME_TOKEN_NAMES` entries whose value is NOT a color — the
 * `CSS.supports("color", …)` check below only makes sense for the other 129.
 * `--shadow-strength` is a bare multiplier (`themes.css` § ELEVATION RAMP:
 * "0 = shadowless"), the one non-color token in the contract; it gets its own
 * numeric grammar check (`isValidShadowStrengthValue`) instead of being
 * exempted from validation entirely.
 */
const NON_COLOR_TOKEN_NAMES = new Set<string>(["--shadow-strength"]);

/**
 * A bare CSS `<number>` token — signed, optional fractional part, optional
 * exponent — the grammar `--shadow-strength` requires, since `themes.css` §
 * ELEVATION RAMP multiplies it directly: `calc(1% * var(--shadow-strength))`.
 * A non-numeric value (a typo like `"oops"`) would make every `calc()` that
 * references it invalid, silently zeroing elevation everywhere.
 */
const CSS_NUMBER_RE = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;

/**
 * A `var(--x)` reference — valid syntax for ANY property, color or numeric,
 * until it resolves (mirrors the `CSS.supports`-based color check below) —
 * so an intentional alias like `{"--shadow-strength": "var(--some-token)"}`
 * still validates.
 */
const CSS_VAR_REF_RE = /^var\(\s*--[\w-]+\s*(?:,[^)]*)?\)$/i;

/**
 * Validates `--shadow-strength`'s numeric grammar. `CSS.supports("color", …)`
 * cannot be reused here — a bare number like `"2"` is not a valid CSS color,
 * so routing a legitimate multiplier through the color check would reject
 * it. This check is a plain regex, so (unlike the color branch) it applies
 * consistently whether or not the `CSS` global/`CSS.supports` exists.
 */
function isValidShadowStrengthValue(value: string): boolean {
  return CSS_NUMBER_RE.test(value) || CSS_VAR_REF_RE.test(value);
}

/**
 * Is `value` a plausible value for token `key` — the check `tokenOverrides`
 * needs on top of key validation (§ `ThemeProviderProps.tokenOverrides`,
 * "Values are ALSO checked"). `setProperty` never rejects a bad VALUE the way
 * key validation rejects a bad NAME, but an invalid color computes to `unset`
 * at the point of use with no signal anything went wrong — this is the
 * failure mode this closes.
 *
 * Uses `CSS.supports("color", value)`, which also accepts `var(--x)` (a
 * custom-property reference is valid syntax for any property until it's
 * resolved) — so an intentional alias like `{"--ring": "var(--primary)"}`
 * (the pattern `.claude/rules/theming.md` recommends for a mirrored token)
 * still validates.
 *
 * Where `CSS.supports` is unavailable — some legacy runtimes, and this
 * package's own jsdom test environment, which implements no `CSS` global at
 * all — a COLOR value is treated as valid (unchecked): this package cannot
 * validate it there, and refusing every override on an engine that can't
 * answer the question would regress every consumer on that engine from
 * "unchecked" to "the feature never applies." `--shadow-strength` is exempt
 * from that fallback — its regex check needs no `CSS` global, so it is
 * always enforced.
 */
function isValidTokenValue(key: string, value: string): boolean {
  if (NON_COLOR_TOKEN_NAMES.has(key)) return isValidShadowStrengthValue(value);
  if (typeof CSS === "undefined" || typeof CSS.supports !== "function") return true;
  return CSS.supports("color", value);
}

/**
 * One `tokenOverrides` key this call forced onto `target`, plus a snapshot of
 * whatever that property held on `target` immediately BEFORE this call —
 * `prevValue`/`prevPriority` straight from `CSSStyleDeclaration`. Cleanup
 * restores this snapshot instead of unconditionally deleting the property, so
 * a pre-existing inline value on the target — a hand-authored `style=` prop,
 * the SSR-authored anti-flash override `docs/CONSUMING.md` §5.2 recommends,
 * or (the callback-ref case) unrelated document-level branding another script
 * put on `document.documentElement` before this ran — survives a mount/target
 * -change/unmount cycle instead of being erased. `prevValue === ""` means the
 * property was unset before, so cleanup removes it rather than restoring "".
 */
interface AppliedTokenOverrideEntry {
  key: string;
  prevValue: string;
  prevPriority: string;
}

/**
 * Applies `tokenOverrides` as inline custom properties on `target` (§
 * `ThemeProviderProps.tokenOverrides` for the full contract). Returns the
 * entries actually applied, each carrying the pre-override snapshot cleanup
 * needs to restore rather than delete (see `AppliedTokenOverrideEntry` and
 * `clearAppliedTokenOverrides`).
 *
 * Unknown keys (not in `THEME_TOKEN_NAMES`) and invalid values (rejected by
 * `isValidTokenValue`) are REJECTED, not applied: setting an unrecognized
 * custom property, or one with a syntactically-invalid value, "succeeds" at
 * the DOM level but does nothing visually (or resolves to `unset`) — silent
 * failure is exactly what the dev warning here prevents. An empty-string
 * value is skipped outright: `setProperty(key, "")` actually REMOVES the
 * property per CSSOM, so applying it would leave nothing to track as
 * "applied."
 */
function applyTokenOverrides(
  overrides: Partial<Record<ThemeTokenName, string>> | undefined,
  target: HTMLElement | null,
): AppliedTokenOverrideEntry[] {
  const el = target ?? (typeof document !== "undefined" ? document.documentElement : null);
  if (!el) return [];

  const applied: AppliedTokenOverrideEntry[] = [];
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (value === undefined || value === "") continue;
    if (!KNOWN_THEME_TOKEN_NAMES.has(key)) {
      warnDev(
        `ThemeProvider: tokenOverrides key "${key}" is not one of THEME_TOKEN_NAMES — ` +
          `ignored (setting it would create a custom property no theme rule reads).`,
      );
      continue;
    }
    if (!isValidTokenValue(key, value)) {
      const expectation = NON_COLOR_TOKEN_NAMES.has(key)
        ? "not a valid CSS number (or var() reference)"
        : "not a valid CSS color";
      warnDev(
        `ThemeProvider: tokenOverrides["${key}"] = "${value}" is ${expectation} — ` +
          `ignored (it would compute to \`unset\` wherever this token is used).`,
      );
      continue;
    }
    // Snapshot what this property held BEFORE we overwrite it — the only way
    // cleanup can tell "nothing was here" from "something else was here" (see
    // `AppliedTokenOverrideEntry`).
    const prevValue = el.style.getPropertyValue(key);
    const prevPriority = el.style.getPropertyPriority(key);
    // CSSStyleDeclaration.setProperty, never `style.cssText`/a `style="…"`
    // attribute string — see the CSP note on `ThemeProviderProps.tokenOverrides`.
    el.style.setProperty(key, value);
    applied.push({ key, prevValue, prevPriority });
  }

  return applied;
}

/**
 * What `tokenOverrides` last forced, and on which element — tracked so the
 * effect below can clear exactly those properties from exactly that element,
 * whether the CONTENT changed, the TARGET changed, or the provider unmounted.
 */
interface AppliedTokenOverrides {
  el: HTMLElement | null;
  entries: readonly AppliedTokenOverrideEntry[];
}

/**
 * Undoes every entry in `applied.entries` on `applied.el` — the single
 * cleanup primitive shared by a target change and an unmount (§
 * `ThemeProviderProps.tokenOverrides`, "Cleared when the target changes, and
 * on unmount"). RESTORES each property to its pre-override snapshot rather
 * than deleting it outright — an empty `prevValue` means the property was
 * genuinely unset before, so only that case removes it; otherwise the prior
 * value/priority is written back verbatim so unrelated inline state (see
 * `AppliedTokenOverrideEntry`) comes back exactly as it was. A no-op when
 * nothing has been applied yet.
 */
function clearAppliedTokenOverrides(applied: AppliedTokenOverrides): void {
  if (!applied.el) return;
  for (const { key, prevValue, prevPriority } of applied.entries) {
    if (prevValue === "") {
      applied.el.style.removeProperty(key);
    } else {
      applied.el.style.setProperty(key, prevValue, prevPriority);
    }
  }
}

/**
 * Applies a theme by writing `data-theme` onto the target element (the document
 * root by default) and a motion preference via `data-motion-pref`. Persists both
 * choices to localStorage (separate keys, so changing one never clobbers the
 * other) and tracks the OS `prefers-reduced-motion` setting live. Safe to render
 * on the server (no-ops until mounted; the "system" default writes no attribute
 * so the first paint defers to the OS media query — no hydration flash).
 *
 * Theming is OPEN (ADR 0029): pass `themes` to register your own theme
 * definitions instead of the two reference themes. A product that surfaces only
 * part of its registry passes `allowedThemes` on top — the context's `themes`
 * list, the persisted-value hydration and `setTheme` all honour it, so a subset
 * needs no consumer-side defenses (#355).
 */
export function ThemeProvider({
  children,
  // NOT defaulted in the destructure: the effect below must be able to tell an
  // EXPLICIT `defaultTheme` from the library's own, so a subset that simply
  // excludes "light" doesn't warn a consumer about a prop they never passed.
  defaultTheme,
  storageKey = "brand-ui-theme",
  themes: themeRegistry,
  allowedThemes,
  defaultMotionPreference = DEFAULT_MOTION_PREFERENCE,
  motionStorageKey = "brand-ui-motion-pref",
  defaultDecoration = null,
  decorationStorageKey = "brand-ui-decoration",
  defaultDensity = DEFAULT_DENSITY,
  densityStorageKey = "brand-ui-density",
  defaultRegister = DEFAULT_TASTE_REGISTER,
  registerStorageKey = "brand-ui-taste-register",
  attributeTarget = null,
  tokenOverrides,
}: ThemeProviderProps) {
  // The themes THIS provider exposes: its registry (ADR 0029), narrowed by
  // `allowedThemes` (#355). BOTH are keyed by VALUE, not identity, so an inline
  // `themes={[...]}` / `allowedThemes={["light","dark"]}` literal — a new array
  // on every render — doesn't churn `setTheme`/the context value.
  const allowedKey = allowedThemes?.join(",") ?? null;
  const themeRegistryKey = registryKey(themeRegistry);
  const themeDefinitions = useMemo<readonly ThemeDefinition[]>(
    () => resolveAllowedThemes(resolveRegistry(themeRegistry), allowedThemes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allowedKey, themeRegistryKey],
  );
  const themes = useMemo<readonly ThemeName[]>(
    () => themeDefinitions.map((t) => t.value),
    [themeDefinitions],
  );
  /** `value` → definition, for the O(1) `effectiveDecoration` lookup below. */
  const themesByName = useMemo(
    () => new Map(themeDefinitions.map((t) => [t.value, t])),
    [themeDefinitions],
  );

  const requestedTheme = defaultTheme ?? DEFAULT_THEME;

  // Coerced BEFORE the first render, not in a corrective effect: a disallowed
  // `defaultTheme` never reaches the context, and no `data-theme` is written
  // until the hydration effect below picks the (also coerced) initial value.
  const [theme, setThemeState] = useState<ThemeName>(() =>
    resolveDefaultTheme(
      requestedTheme,
      resolveAllowedThemes(resolveRegistry(themeRegistry), allowedThemes).map((t) => t.value),
    ),
  );
  const [motionPreference, setMotionState] = useState<MotionPreference>(defaultMotionPreference);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [decoration, setDecorationState] = useState<DecorationLevel | null>(defaultDecoration);
  const [density, setDensityState] = useState<DensityMode>(defaultDensity);
  const [register, setRegisterState] = useState<TasteRegister>(defaultRegister);

  // Hydrate the theme from storage on mount, then apply.
  //
  // #355 — the allow-list check lives HERE, in the same pass that resolves and
  // applies the initial theme, NOT in a second corrective effect: a persisted
  // value for a theme this product no longer ships is rejected before any
  // `data-theme` is written, so it can never flash on boot.
  useEffect(() => {
    // Only an EXPLICIT defaultTheme can be "wrong" here. Warning when the prop
    // was omitted would fire on every provider whose subset excludes
    // DEFAULT_THEME — a false positive naming a prop the consumer never passed.
    if (defaultTheme !== undefined && !themes.includes(defaultTheme)) {
      warnDev(
        `ThemeProvider: defaultTheme "${defaultTheme}" is not in allowedThemes ` +
          `[${themes.join(", ")}] — using "${themes[0]}".`,
      );
    }
    let initial = resolveDefaultTheme(requestedTheme, themes);
    if (storageKey && typeof window !== "undefined") {
      const stored = window.localStorage.getItem(storageKey);
      // Registry membership IS the validation now — there is no closed union to
      // guard against (ADR 0029). A persisted name this provider doesn't offer
      // (a theme the app dropped, or one from a different app on the same
      // origin) is rejected before any `data-theme` is written.
      if (stored !== null && themes.includes(stored)) initial = stored;
    }
    setThemeState(initial);
    applyTheme(initial, attributeTarget);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hydrate the motion preference from storage, apply it, and track the OS
  // reduced-motion setting live (so "system" and useReducedMotion stay correct).
  useEffect(() => {
    let initial = defaultMotionPreference;
    if (motionStorageKey && typeof window !== "undefined") {
      const stored = window.localStorage.getItem(motionStorageKey);
      if (isMotionPreference(stored)) initial = stored;
    }
    setMotionState(initial);
    applyMotionPreference(initial, attributeTarget);

    // Same feature detection as `useReducedMotion` below — jsdom has no
    // `matchMedia`, and a provider that throws on mount takes the whole app's
    // test suite with it.
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(REDUCED_MOTION_QUERY);
    const onChange = () => setPrefersReducedMotion(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hydrate the decoration override from storage, then apply (null follows theme).
  useEffect(() => {
    let initial = defaultDecoration;
    if (decorationStorageKey && typeof window !== "undefined") {
      const stored = window.localStorage.getItem(decorationStorageKey);
      const n = stored === null ? null : Number(stored);
      if (n !== null && isDecorationLevel(n)) initial = n;
    }
    setDecorationState(initial);
    applyDecoration(initial, attributeTarget);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hydrate the density mode from storage, then apply ("comfortable" omits attr).
  useEffect(() => {
    let initial = defaultDensity;
    if (densityStorageKey && typeof window !== "undefined") {
      const stored = window.localStorage.getItem(densityStorageKey);
      if (isDensity(stored)) initial = stored;
    }
    setDensityState(initial);
    applyDensity(initial, attributeTarget);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hydrate the taste register from storage, then apply (always writes the attr).
  useEffect(() => {
    let initial = defaultRegister;
    if (registerStorageKey && typeof window !== "undefined") {
      const stored = window.localStorage.getItem(registerStorageKey);
      if (isTasteRegister(stored)) initial = stored;
    }
    setRegisterState(initial);
    applyRegister(initial, attributeTarget);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply `tokenOverrides` (#17) — unlike theme/decoration/density/register
  // above, this is a plain CONTROLLED prop (no internal state, no setter, no
  // persistence): the consumer already owns the source of truth (e.g. fetched
  // tenant branding), so the provider's only job is to keep the DOM in sync
  // with it. Keyed on CONTENT (`tokenOverridesKeyValue`), not the object
  // reference, so an inline literal doesn't churn the effect every render; runs
  // on every render where the content or target actually changes — not
  // mount-once — so it stays reactive to prop changes and survives a
  // `setTheme` call untouched (overrides are orthogonal to which theme block
  // is active).
  //
  // The effect's cleanup clears exactly what THIS run applied, from exactly
  // the element it applied it to (`appliedTokenOverridesRef`) — React invokes
  // that cleanup before the effect re-runs on a dependency change AND on
  // unmount, so it is the single mechanism behind both fixes below:
  //   - `attributeTarget` resolving from `null` to a real node (the
  //     callback-ref pattern in `BringYourOwnThemeDemo`/
  //     `RuntimeTokenOverridesDemo`) no longer leaves the first run's
  //     properties stuck on `document.documentElement` — the cleanup removes
  //     them from THAT element before the next run applies to the new one.
  //   - Unmounting the provider restores the target to its plain theme
  //     value instead of leaving the override in place forever.
  const tokenOverridesKeyValue = tokenOverridesKey(tokenOverrides);
  const appliedTokenOverridesRef = useRef<AppliedTokenOverrides>({ el: null, entries: [] });
  useEffect(() => {
    const el =
      attributeTarget ?? (typeof document !== "undefined" ? document.documentElement : null);
    const entries = applyTokenOverrides(tokenOverrides, attributeTarget);
    appliedTokenOverridesRef.current = { el, entries };
    return () => {
      clearAppliedTokenOverrides(appliedTokenOverridesRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenOverridesKeyValue, attributeTarget]);

  const setTheme = useCallback(
    (next: ThemeName) => {
      // #355 — a theme this provider doesn't expose is a no-op, not a silent
      // apply-and-persist (which would also poison storage for the next boot).
      // With an open registry this is also the ONLY check: an unregistered name
      // would write a `data-theme` with no matching CSS block, silently
      // rendering the `:root` base and looking like a broken theme.
      if (!themes.includes(next)) {
        warnDev(
          `ThemeProvider: setTheme("${next}") ignored — not one of this provider's ` +
            `themes [${themes.join(", ")}]. Register it via the \`themes\` prop.`,
        );
        return;
      }
      setThemeState(next);
      applyTheme(next, attributeTarget);
      if (storageKey && typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, next);
      }
    },
    [storageKey, attributeTarget, themes],
  );

  const setMotionPreference = useCallback(
    (next: MotionPreference) => {
      setMotionState(next);
      applyMotionPreference(next, attributeTarget);
      if (motionStorageKey && typeof window !== "undefined") {
        window.localStorage.setItem(motionStorageKey, next);
      }
    },
    [motionStorageKey, attributeTarget],
  );

  const setDecoration = useCallback(
    (next: DecorationLevel | null) => {
      setDecorationState(next);
      applyDecoration(next, attributeTarget);
      if (decorationStorageKey && typeof window !== "undefined") {
        if (next === null) window.localStorage.removeItem(decorationStorageKey);
        else window.localStorage.setItem(decorationStorageKey, String(next));
      }
    },
    [decorationStorageKey, attributeTarget],
  );

  const setDensity = useCallback(
    (next: DensityMode) => {
      setDensityState(next);
      applyDensity(next, attributeTarget);
      if (densityStorageKey && typeof window !== "undefined") {
        if (next === "comfortable") window.localStorage.removeItem(densityStorageKey);
        else window.localStorage.setItem(densityStorageKey, next);
      }
    },
    [densityStorageKey, attributeTarget],
  );

  const setRegister = useCallback(
    (next: TasteRegister) => {
      setRegisterState(next);
      applyRegister(next, attributeTarget);
      if (registerStorageKey && typeof window !== "undefined") {
        window.localStorage.setItem(registerStorageKey, next);
      }
    },
    [registerStorageKey, attributeTarget],
  );

  const value = useMemo<ThemeContextValue>(() => {
    // `?.` is load-bearing, not defensive noise: with an open registry the
    // active theme may be one this provider doesn't define (a stale name during
    // a registry swap), and the old `THEME_META[theme].decorationLevel` would
    // throw and take the whole tree down.
    const effectiveDecoration = decoration ?? themesByName.get(theme)?.decorationLevel ?? 0;
    return {
      theme,
      themes,
      themeDefinitions,
      setTheme,
      motionPreference,
      setMotionPreference,
      prefersReducedMotion,
      decoration,
      effectiveDecoration,
      setDecoration,
      density,
      setDensity,
      register,
      setRegister,
      // `expressiveness` is the decoration dial — assembled here, never a
      // separate knob (ADR 0020).
      tasteProfile: {
        register,
        density,
        motion: motionPreference,
        expressiveness: effectiveDecoration,
      },
    };
  }, [
    theme,
    themes,
    themeDefinitions,
    themesByName,
    setTheme,
    motionPreference,
    setMotionPreference,
    prefersReducedMotion,
    decoration,
    setDecoration,
    density,
    setDensity,
    register,
    setRegister,
  ]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Access the active theme and a setter. Must be used inside <ThemeProvider>. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a <ThemeProvider>.");
  }
  return ctx;
}

/**
 * Access the motion preference, its setter, and the live OS reduced-motion flag.
 * A thin alias over the theme context for settings UIs (mirrors `useTheme`).
 */
export function useMotionPreference() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useMotionPreference must be used within a <ThemeProvider>.");
  }
  return {
    motionPreference: ctx.motionPreference,
    setMotionPreference: ctx.setMotionPreference,
    prefersReducedMotion: ctx.prefersReducedMotion,
  };
}

/**
 * Access the decoration dial (override, effective level, setter). A thin alias
 * over the theme context for settings UIs (mirrors `useMotionPreference`).
 */
export function useDecoration() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useDecoration must be used within a <ThemeProvider>.");
  }
  return {
    decoration: ctx.decoration,
    effectiveDecoration: ctx.effectiveDecoration,
    setDecoration: ctx.setDecoration,
  };
}

/**
 * Access the density mode and its setter. A thin alias over the theme context
 * for settings UIs (mirrors `useDecoration`). The dial rescales spacing AND the
 * type scale (#340), so a compact surface tightens as a whole. "comfortable" is
 * the identity on both channels — no visual change from pre-density builds.
 */
export function useDensity() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useDensity must be used within a <ThemeProvider>.");
  }
  return {
    density: ctx.density,
    setDensity: ctx.setDensity,
  };
}

/**
 * Access the assembled **taste profile** (register × density × motion ×
 * expressiveness) and the register setter. A thin alias over the theme context
 * for settings UIs and audits (mirrors `useDensity`).
 *
 * `profile.expressiveness` IS the effective decoration level — one dial, two
 * names; change it with `useDecoration().setDecoration`, not a second knob.
 * Change density/motion with `useDensity`/`useMotionPreference`; only the
 * register is owned here (it is the one axis with no dial of its own).
 */
export function useTasteProfile(): {
  profile: TasteProfile;
  setRegister: (register: TasteRegister) => void;
} {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTasteProfile must be used within a <ThemeProvider>.");
  }
  return { profile: ctx.tasteProfile, setRegister: ctx.setRegister };
}

/**
 * Resolve the EFFECTIVE reduced-motion boolean for JS-driven animation (the CSS
 * `--motion-factor` gate cannot reach a JS timeline, e.g. Motion/Framer). Same
 * precedence as the CSS gate: user-explicit beats the OS setting.
 *
 * - `reduced` → true   (user forces reduced)
 * - `full`    → false  (user forces full motion)
 * - `system`  → the OS `prefers-reduced-motion` value
 *
 * Use for JS animations and to feed `<MotionConfig reducedMotion>`. CSS
 * transitions/animations do NOT need this — they gate via `--motion-factor`.
 *
 * Provider-OPTIONAL: unlike `useMotionPreference`, this does not throw outside a
 * `<ThemeProvider>`. Without one it degrades to OS-only detection (preference
 * "system"), so it is safe to call from any library component (e.g. Shimmer).
 */
export function useReducedMotion(): boolean {
  const ctx = useContext(ThemeContext);
  const [osReducedMotion, setOsReducedMotion] = useState(false);

  useEffect(() => {
    // Feature-detected, not just SSR-guarded: this hook is documented as safe
    // to call from ANY library component, and jsdom (every consumer package's
    // test environment) implements no `matchMedia`. A bare call here crashes
    // the consumer's tests on mount — and a stub in one package's test setup
    // would only hide it from that package.
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(REDUCED_MOTION_QUERY);
    const onChange = () => setOsReducedMotion(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const preference = ctx?.motionPreference ?? "system";
  if (preference === "reduced") return true;
  if (preference === "full") return false;
  return osReducedMotion;
}
