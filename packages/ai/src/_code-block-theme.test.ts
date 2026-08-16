import { afterEach, describe, expect, it } from "vitest";

import {
  buildCodeBlockTheme,
  codeBlockThemeId,
  getActiveThemeName,
  getThemeScopeKey,
} from "./_code-block-theme";

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("style");
});

describe("getActiveThemeName", () => {
  it("defaults to qlik-bright when no data-theme is set", () => {
    expect(getActiveThemeName()).toBe("qlik-bright");
  });

  it("reads a valid data-theme off the root element", () => {
    document.documentElement.setAttribute("data-theme", "qlik-dark");
    expect(getActiveThemeName()).toBe("qlik-dark");
  });

  it("falls back to the default for an unknown data-theme value", () => {
    document.documentElement.setAttribute("data-theme", "not-a-real-theme");
    expect(getActiveThemeName()).toBe("qlik-bright");
  });
});

// #315 blocker fix — the highlight-cache scoping key must NOT collapse "no
// data-theme attribute" and an explicit "data-theme=qlik-bright" into the same
// value the way `getActiveThemeName` does, or the pre-ThemeProvider-mount
// render's `:root`-tokenized colors would poison the cache under the key
// ThemeProvider later writes explicitly.
describe("getThemeScopeKey", () => {
  it("returns a distinct sentinel when no data-theme attribute is set", () => {
    expect(getThemeScopeKey()).toBe("__root__");
  });

  it("returns the RAW attribute value when data-theme is set, even though it narrows to the same ThemeName as unset", () => {
    document.documentElement.setAttribute("data-theme", "qlik-bright");
    expect(getThemeScopeKey()).toBe("qlik-bright");
  });

  it("differs between unset and explicit qlik-bright (the exact collision the fix closes)", () => {
    const unset = getThemeScopeKey();
    document.documentElement.setAttribute("data-theme", "qlik-bright");
    const explicitBright = getThemeScopeKey();
    expect(unset).not.toBe(explicitBright);
    // Meanwhile the validated name IS the same for both — that's the trap.
    expect(getActiveThemeName()).toBe("qlik-bright");
  });
});

describe("codeBlockThemeId", () => {
  it("namespaces the theme name so it can't collide with a bundled Shiki theme", () => {
    expect(codeBlockThemeId("qlik-bright")).toBe("brand-code-qlik-bright");
    expect(codeBlockThemeId("qlik-dark")).toBe("brand-code-qlik-dark");
  });
});

describe("buildCodeBlockTheme", () => {
  it("derives colors from the active theme's --code-* custom properties, not a github-* literal", () => {
    document.documentElement.setAttribute("data-theme", "qlik-bright");
    document.documentElement.style.setProperty("--code-background", "oklch(1 0 0)");
    document.documentElement.style.setProperty("--code-foreground", "oklch(0.21 0.02 264)");
    document.documentElement.style.setProperty("--code-keyword", "oklch(0.38 0.16 264)");
    document.documentElement.style.setProperty("--code-string", "oklch(0.42 0.14 150)");

    const theme = buildCodeBlockTheme();

    expect(theme.name).toBe("brand-code-qlik-bright");
    expect(theme.bg).toBe("#ffffff");
    expect(theme.fg).toMatch(/^#[0-9a-f]{6}$/);
    // Never the hardcoded third-party palette (#315).
    expect(JSON.stringify(theme)).not.toMatch(/github/i);

    const keywordRule = theme.settings?.find((s) => {
      const scope = s.scope;
      return Array.isArray(scope) ? scope.includes("keyword") : scope === "keyword";
    });
    expect(keywordRule?.settings.foreground).toMatch(/^#[0-9a-f]{6}$/);
    expect(keywordRule?.settings.foreground).not.toBe(theme.fg);
  });

  // #315 blocker fix — `theme.name` (the highlight-cache key) must differ
  // between "no data-theme attribute" and an explicit "qlik-bright", even
  // though both resolve to the same `THEME_META[...].dark` light/dark flag.
  it("gives the unset-attribute render a distinct theme name from explicit qlik-bright", () => {
    const unset = buildCodeBlockTheme();
    expect(unset.name).toBe("brand-code-__root__");

    document.documentElement.setAttribute("data-theme", "qlik-bright");
    const explicitBright = buildCodeBlockTheme();
    expect(explicitBright.name).toBe("brand-code-qlik-bright");
    expect(explicitBright.name).not.toBe(unset.name);

    // Both are still "light" — the collision was in the CACHE KEY, not the flag.
    expect(unset.type).toBe("light");
    expect(explicitBright.type).toBe("light");
  });

  it("marks qlik-dark as a dark Shiki theme (THEME_META-driven, not guessed)", () => {
    document.documentElement.setAttribute("data-theme", "qlik-dark");
    const theme = buildCodeBlockTheme();
    expect(theme.type).toBe("dark");
  });

  it("marks qlik-bright as a light Shiki theme", () => {
    document.documentElement.setAttribute("data-theme", "qlik-bright");
    const theme = buildCodeBlockTheme();
    expect(theme.type).toBe("light");
  });

  it("re-derives different colors when the active theme changes", () => {
    document.documentElement.setAttribute("data-theme", "qlik-bright");
    document.documentElement.style.setProperty("--code-keyword", "oklch(0.38 0.16 264)");
    const bright = buildCodeBlockTheme();

    document.documentElement.setAttribute("data-theme", "qlik-dark");
    document.documentElement.style.setProperty("--code-keyword", "oklch(0.7 0.16 264)");
    const dark = buildCodeBlockTheme();

    const keywordOf = (theme: typeof bright) =>
      theme.settings?.find(
        (s) => s.scope === "keyword" || (s.scope as string[])?.includes?.("keyword"),
      )?.settings.foreground;

    expect(keywordOf(bright)).not.toBe(keywordOf(dark));
  });

  // #315 follow-up — the theme id/type and the resolved colors must ALWAYS
  // come from the SAME element, so a region-scoped `data-theme` (a supported
  // ThemeProvider/decorator pattern, see @.claude/rules/theming.md) resolves
  // ITS OWN theme, never the document root's, and the two can never disagree.
  it("resolves a region-scoped data-theme (not the document root's) when passed that region's element", () => {
    document.documentElement.setAttribute("data-theme", "qlik-bright");
    const region = document.createElement("div");
    region.setAttribute("data-theme", "qlik-dark");
    document.body.appendChild(region);

    const theme = buildCodeBlockTheme(region);
    expect(theme.name).toBe("brand-code-qlik-dark");
    expect(theme.type).toBe("dark"); // the region's theme, not qlik-bright's "light"

    document.body.removeChild(region);
  });
});
