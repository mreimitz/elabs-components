// Theme state for the site (RM-091): `?theme=<family>&mode=<light|dark>` in the URL is the
// shareable source of truth; localStorage (ThemeProvider's key) is the fallback, then the OS
// colour scheme, then `default`/`light`. Deliberately NOT a client module: the root layout
// renders `siteThemeInitScript()` on the server so the theme is on <html> before first paint.
import { useTheme } from "@elabs-ai/components-tokens";
import { useThemeTransition } from "@elabs-ai/components-ui";
import { SITE_THEME_FAMILIES, type SiteThemeFamily } from "../themes";

export type SiteThemeMode = "light" | "dark";

export const THEME_PARAM = "theme";
export const MODE_PARAM = "mode";
/** ThemeProvider's default storage key — the init script and the provider must agree on it. */
export const THEME_STORAGE_KEY = "brand-ui-theme";

type FamilyThemes = Record<string, { light: string; dark: string }>;

const FAMILY_THEMES: FamilyThemes = Object.fromEntries(
  SITE_THEME_FAMILIES.map((f) => [f.id, f.themes]),
);

/** A `data-theme` value → its family and mode (`qlik-dark` → qlik/dark, `light` → default/light). */
export function familyOfTheme(theme: string): { family: string; mode: SiteThemeMode } | null {
  for (const f of SITE_THEME_FAMILIES) {
    if (f.themes.light === theme) return { family: f.id, mode: "light" };
    if (f.themes.dark === theme) return { family: f.id, mode: "dark" };
  }
  return null;
}

/**
 * Runs in the browser before first paint. Self-contained (it is serialised with
 * `Function.prototype.toString`) and every storage access is guarded.
 * `?theme=` accepts a family id (`qlik`) or a full theme value (`qlik-dark`).
 * It also writes the resolved theme to storage, so ThemeProvider's mount effect hydrates to the
 * SAME theme instead of re-applying its default (which would flash).
 */
function applyInitialTheme(map: FamilyThemes, themeParam: string, modeParam: string, key: string) {
  const root = document.documentElement;
  const query = new URLSearchParams(window.location.search);
  let family: string | null = null;
  let mode: string | null = null;
  const lookup = (value: string | null) => {
    for (const id in map) {
      const pair = map[id];
      if (pair && pair.light === value) return { f: id, m: "light" };
      if (pair && pair.dark === value) return { f: id, m: "dark" };
    }
    return null;
  };
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(key);
  } catch {
    stored = null;
  }
  const fromStorage = lookup(stored);
  if (fromStorage) {
    family = fromStorage.f;
    mode = fromStorage.m;
  }
  const qTheme = query.get(themeParam);
  const qMode = query.get(modeParam);
  const fromValue = lookup(qTheme);
  if (fromValue) {
    family = fromValue.f;
    mode = fromValue.m;
  } else if (qTheme && map[qTheme]) family = qTheme;
  if (qMode === "light" || qMode === "dark") mode = qMode;
  if (!family) family = "default";
  if (mode !== "light" && mode !== "dark")
    mode = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const pair = map[family];
  if (!pair) return;
  const theme = pair[mode as "light" | "dark"];
  root.setAttribute("data-theme", theme);
  try {
    window.localStorage.setItem(key, theme);
  } catch {
    // Storage blocked (private mode, sandboxed iframe): the attribute alone still paints.
  }
}

/** The inline pre-hydration script (rendered raw in <head> by the root layout). */
export function siteThemeInitScript(): string {
  const args = [FAMILY_THEMES, THEME_PARAM, MODE_PARAM, THEME_STORAGE_KEY].map((a) =>
    JSON.stringify(a),
  );
  return `(${applyInitialTheme.toString()})(${args.join(",")});`;
}

/** Keep the URL shareable: `?theme=<family>&mode=<mode>`, other params untouched. */
export function writeThemeToUrl(family: string, mode: SiteThemeMode) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set(THEME_PARAM, family);
  url.searchParams.set(MODE_PARAM, mode);
  window.history.replaceState(null, "", url);
}

export interface SiteThemeState {
  family: string;
  mode: SiteThemeMode;
  setFamily: (family: string) => void;
  setMode: (mode: SiteThemeMode) => void;
  families: readonly SiteThemeFamily[];
}

/** The site's family/mode over ThemeProvider, with the URL kept in sync. Client-only. */
export function useSiteTheme(): SiteThemeState {
  const { theme } = useTheme();
  // The same animated setter `ThemeSwitcher` uses, so a theme card switches exactly like the menu.
  const setTheme = useThemeTransition();
  const current = familyOfTheme(theme) ?? { family: "default", mode: "light" as const };
  const apply = (family: string, mode: SiteThemeMode) => {
    const next = FAMILY_THEMES[family]?.[mode];
    if (!next) return;
    setTheme(next);
    writeThemeToUrl(family, mode);
  };
  return {
    family: current.family,
    mode: current.mode,
    setFamily: (family) => apply(family, current.mode),
    setMode: (mode) => apply(current.family, mode),
    families: SITE_THEME_FAMILIES,
  };
}
