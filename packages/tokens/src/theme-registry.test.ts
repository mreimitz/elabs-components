// @vitest-environment jsdom
/**
 * theme-registry.test.ts — the OPEN theming contract (ADR 0029).
 *
 * What actually has to hold once `ThemeName` stops being a closed union:
 *
 *  1. A consumer theme is a first-class theme. Nothing narrows it away, and no
 *     helper needs to have heard of it.
 *  2. "Is this theme dark" is answered by the theme's OWN `color-scheme`, not by
 *     a lookup in a table this package controls — otherwise every asset-swapping
 *     component silently treats an unregistered dark theme as light.
 *  3. The token contract a theme must cover is exported and non-empty, so a
 *     consumer can assert coverage of their own stylesheet in their own test.
 *
 * Point 2 is the regression-prone one: a naive fix keeps the registry lookup and
 * just widens the type, which passes typecheck, passes every switcher test, and
 * still renders a light Monaco/basemap/toast inside a consumer's dark theme. So
 * the assertions below drive `color-scheme` directly and check that a name the
 * registry has never seen still resolves correctly.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BUILT_IN_THEMES,
  BUILT_IN_THEME_DEFINITIONS,
  BUILT_IN_THEME_META,
  DEFAULT_THEME,
  defineTheme,
  isBuiltInThemeName,
  resolveThemeIsDark,
  THEME_TOKEN_NAMES,
  type ThemeDefinition,
} from "./index";

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.removeProperty("color-scheme");
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Applies a real `color-scheme` the way a theme block does. */
function themed(name: string, scheme: "light" | "dark"): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("data-theme", name);
  el.style.colorScheme = scheme;
  document.body.appendChild(el);
  return el;
}

describe("defineTheme", () => {
  it("returns the definition unchanged (identity helper, author-time typing only)", () => {
    const midnight: ThemeDefinition = { value: "midnight", label: "Midnight", dark: true };
    expect(defineTheme(midnight)).toEqual(midnight);
  });

  it("accepts a name this package has never heard of", () => {
    const t = defineTheme({ value: "solarized-lagoon", label: "Solarized Lagoon", dark: false });
    expect(t.value).toBe("solarized-lagoon");
    // The point of ADR 0029: it is a real theme, not a built-in.
    expect(isBuiltInThemeName(t.value)).toBe(false);
  });
});

describe("the built-in registry", () => {
  it("ships exactly the two reference themes, in switcher order", () => {
    expect(BUILT_IN_THEME_DEFINITIONS.map((d) => d.value)).toEqual([...BUILT_IN_THEMES]);
  });

  it("defaults to a theme that is actually in the registry", () => {
    expect(BUILT_IN_THEME_DEFINITIONS.some((d) => d.value === DEFAULT_THEME)).toBe(true);
  });

  it("gives every built-in a label and a darkness flag", () => {
    for (const d of BUILT_IN_THEME_DEFINITIONS) {
      expect(d.label.length).toBeGreaterThan(0);
      expect(typeof d.dark).toBe("boolean");
    }
  });

  it("never enumerates a name outside the built-in registry", () => {
    const outsider = "midnight";
    expect(isBuiltInThemeName(outsider)).toBe(false);
    expect(BUILT_IN_THEME_DEFINITIONS.some((d) => d.value === outsider)).toBe(false);
    expect(Object.keys(BUILT_IN_THEME_META)).not.toContain(outsider);
  });
});

describe("resolveThemeIsDark", () => {
  it("reads the theme's own color-scheme, for a theme NOT in the registry", () => {
    // The load-bearing case. A registry lookup returns "light" here (the name is
    // unknown) and every asset swap goes wrong inside the consumer's dark theme.
    expect(resolveThemeIsDark(themed("midnight", "dark"))).toBe(true);
    expect(resolveThemeIsDark(themed("parchment", "light"))).toBe(false);
  });

  it("resolves a descendant of a region-scoped theme, not the document root's", () => {
    // Region-scoped `data-theme` is a supported ThemeProvider/decorator pattern
    // (@.claude/rules/theming.md), so a component deep inside one must see ITS
    // theme. In a browser `color-scheme` inherits and step 1 answers directly;
    // jsdom does not propagate inherited properties through getComputedStyle, so
    // what this asserts is step 2 — the `closest("[data-theme]")` walk. Both
    // paths must agree, which is why the region is a built-in name here.
    document.documentElement.setAttribute("data-theme", "light");
    const region = themed("dark", "dark");
    const child = document.createElement("span");
    region.appendChild(child);
    expect(resolveThemeIsDark(child)).toBe(true);
  });

  it("lets a consumer OVERRIDE a built-in theme's darkness", () => {
    // `light` is registered as dark:false — but the element says otherwise, and
    // the element is the one that renders. CSS wins over the table.
    expect(resolveThemeIsDark(themed("light", "dark"))).toBe(true);
  });

  it('ignores an ambiguous "light dark" list rather than guessing', () => {
    const el = themed("either", "light");
    el.style.colorScheme = "light dark"; // "either is fine" — not a claim
    // Falls through to the registry (unknown name) and then to the OS.
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: true, media: q }) as MediaQueryList);
    expect(resolveThemeIsDark(el)).toBe(true);
  });

  it("falls back to the built-in registry when no color-scheme is resolvable (jsdom/SSR-ish)", () => {
    // No `style.colorScheme` set: jsdom computes "", the documented step-2 path.
    document.documentElement.setAttribute("data-theme", "dark");
    expect(resolveThemeIsDark()).toBe(true);
    document.documentElement.setAttribute("data-theme", "light");
    expect(resolveThemeIsDark()).toBe(false);
  });

  it("falls back to prefers-color-scheme when no theme is applied at all", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: true, media: q }) as MediaQueryList);
    expect(resolveThemeIsDark()).toBe(true);
  });

  it("defaults to light when nothing can be resolved", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(resolveThemeIsDark()).toBe(false);
  });
});

describe("THEME_TOKEN_NAMES (the contract a theme must cover)", () => {
  it("is non-empty — an empty contract would make every coverage test vacuous", () => {
    // The generator refuses to emit an empty list for exactly this reason; this
    // is the consumer-side half of that guarantee.
    expect(THEME_TOKEN_NAMES.length).toBeGreaterThan(50);
  });

  it("lists CSS custom-property names, deduped and sorted", () => {
    for (const name of THEME_TOKEN_NAMES) expect(name).toMatch(/^--[\w-]+$/);
    expect(new Set(THEME_TOKEN_NAMES).size).toBe(THEME_TOKEN_NAMES.length);
    expect([...THEME_TOKEN_NAMES]).toEqual([...THEME_TOKEN_NAMES].sort());
  });

  it("includes the semantic roles a theme cannot omit", () => {
    for (const token of [
      "--background",
      "--foreground",
      "--primary",
      "--primary-foreground",
      "--border",
      "--ring",
      "--sidebar",
      "--chart-1",
    ]) {
      expect(THEME_TOKEN_NAMES).toContain(token);
    }
  });

  it("excludes root-only machinery (a theme does not redeclare the engine)", () => {
    // Timing/decoration/font/radix plumbing lives on `:root` only — see
    // ROOT_ONLY_RE in packages/tokens/scripts/lib/themes-io.mjs.
    for (const token of THEME_TOKEN_NAMES) {
      expect(token).not.toMatch(/^--(t|type|font|decoration|radix|spacing)-/);
    }
  });
});
