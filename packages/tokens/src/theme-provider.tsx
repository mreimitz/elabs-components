"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_DENSITY,
  DEFAULT_MOTION_PREFERENCE,
  DEFAULT_TASTE_REGISTER,
  DEFAULT_THEME,
  isDecorationLevel,
  isDensity,
  isMotionPreference,
  isTasteRegister,
  isThemeName,
  THEME_META,
  THEMES,
  type DecorationLevel,
  type DensityMode,
  type MotionPreference,
  type TasteProfile,
  type TasteRegister,
  type ThemeName,
} from "./theme-types";

interface ThemeContextValue {
  /** The active theme. */
  theme: ThemeName;
  /**
   * The theme names this provider exposes — every shipped theme by default, or
   * the `allowedThemes` subset when the provider was given one. Read this (not
   * `THEMES`) when building a switcher, so a product that ships a subset lists
   * only what it ships.
   */
  themes: readonly ThemeName[];
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
   * Restrict this provider to a SUBSET of the shipped themes (#355). When set:
   * `useTheme().themes` lists only these, a persisted value outside the list is
   * rejected during the same mount pass that applies the theme (so there is no
   * flash of a theme the product doesn't ship), and `setTheme` with a
   * disallowed name is a no-op that warns in development.
   *
   * Omit it (the default) for the previous behaviour: every shipped theme.
   * Unknown names and an empty list are ignored — a provider always exposes at
   * least one theme.
   *
   * `ThemeSwitcher` (`@elabs/components-ui`) automatically inherits this
   * subset (#384): it narrows its offered themes to the intersection of the
   * `themes` prop and the provider's allowed list when the provider is genuinely
   * restricting (a strict subset of every shipped theme). A non-restricting
   * provider leaves the `themes` prop untouched for backward compatibility. Passing
   * `themes={useTheme().themes}` explicitly is still allowed and works, but is no
   * longer required.
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
   * follow the active theme's own level (blueprint = 10, others = 0), writing no
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
}

/**
 * Narrow the shipped theme list to the provider's `allowedThemes` (#355).
 * Preserves THEMES order, drops unknown names, and falls back to the full list
 * when the subset would be empty — a provider must always expose a theme.
 */
function resolveAllowedThemes(allowed: readonly ThemeName[] | undefined): readonly ThemeName[] {
  if (!allowed) return THEMES;
  const subset = THEMES.filter((name) => allowed.includes(name));
  return subset.length > 0 ? subset : THEMES;
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
 * `process` is deliberately NOT in this package's type surface — it is a browser
 * package and its tsconfig lists only the React types, so the `dist` type build
 * has no `@types/node`. Declaring the one shape used here keeps the expression
 * `process.env.NODE_ENV` intact, which is what every bundler replaces at build
 * time (so the diagnostics below compile out of production bundles). Mirrors the
 * same guard in `@elabs/components-data`'s DataTable.
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

/**
 * Applies a theme by writing `data-theme` onto the target element (the document
 * root by default) and a motion preference via `data-motion-pref`. Persists both
 * choices to localStorage (separate keys, so changing one never clobbers the
 * other) and tracks the OS `prefers-reduced-motion` setting live. Safe to render
 * on the server (no-ops until mounted; the "system" default writes no attribute
 * so the first paint defers to the OS media query — no hydration flash).
 *
 * A product that ships only SOME of the themes passes `allowedThemes`: the
 * context's `themes` list, the persisted-value hydration and `setTheme` all
 * honour it, so a subset needs no consumer-side defenses (#355).
 */
export function ThemeProvider({
  children,
  // NOT defaulted in the destructure: the effect below must be able to tell an
  // EXPLICIT `defaultTheme` from the library's own, so a subset that simply
  // excludes "light" doesn't warn a consumer about a prop they never passed.
  defaultTheme,
  storageKey = "brand-ui-theme",
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
}: ThemeProviderProps) {
  // The themes THIS provider exposes (#355). Keyed by VALUE, not identity, so an
  // inline `allowedThemes={["light", "dark"]}` literal — which is a new
  // array on every render — doesn't churn `setTheme`/the context value.
  const allowedKey = allowedThemes?.join(",") ?? null;
  const themes = useMemo<readonly ThemeName[]>(
    () => resolveAllowedThemes(allowedThemes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allowedKey],
  );

  const requestedTheme = defaultTheme ?? DEFAULT_THEME;

  // Coerced BEFORE the first render, not in a corrective effect: a disallowed
  // `defaultTheme` never reaches the context, and no `data-theme` is written
  // until the hydration effect below picks the (also coerced) initial value.
  const [theme, setThemeState] = useState<ThemeName>(() =>
    resolveDefaultTheme(requestedTheme, resolveAllowedThemes(allowedThemes)),
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
      if (isThemeName(stored) && themes.includes(stored)) initial = stored;
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

  const setTheme = useCallback(
    (next: ThemeName) => {
      // #355 — a theme this provider doesn't expose is a no-op, not a silent
      // apply-and-persist (which would also poison storage for the next boot).
      if (!themes.includes(next)) {
        warnDev(
          `ThemeProvider: setTheme("${next}") ignored — not in allowedThemes ` +
            `[${themes.join(", ")}].`,
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
    const effectiveDecoration = decoration ?? THEME_META[theme].decorationLevel ?? 0;
    return {
      theme,
      themes,
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
