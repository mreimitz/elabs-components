"use client";
/**
 * story-theme.ts — which theme to ask the embedded Storybook for.
 *
 * The deployed Storybook is released less often than this site, so it can lack a brand theme
 * the site already ships. Asked for a theme it does not have, Storybook sets `data-theme` and
 * renders its DEFAULT LIGHT tokens — a white example on a dark page. Nothing lists the themes
 * a Storybook build contains, so the first rendered example is the probe: its `--background`
 * is compared with the one this site generated for that theme. A mismatch marks the theme as
 * missing (for every frame, and for the rest of the session) and the frames fall back to the
 * library's default theme in the SAME mode, so dark stays dark.
 */
import { useSyncExternalStore } from "react";
import themesJson from "../content/generated/themes.json";

interface ThemeMode {
  mode: string;
  value: string;
  background: string;
}
const THEMES = themesJson as { isDefault: boolean; modes: ThemeMode[] }[];
const MODES = THEMES.flatMap((theme) => theme.modes);
const DEFAULTS = THEMES.find((theme) => theme.isDefault)?.modes ?? [];

const STORE_KEY = "brand-ui:storybook-missing-themes";
const missing = new Set<string>();
const listeners = new Set<() => void>();
let hydrated = false;

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    for (const value of JSON.parse(window.sessionStorage.getItem(STORE_KEY) ?? "[]") as string[])
      missing.add(value);
  } catch {
    // Storage is a convenience here; without it the first frame probes again.
  }
}

/** The lightness of an `oklch(L …)` colour, 0–1, or null when it is another syntax. */
function lightness(color: string): number | null {
  const match = color.trim().match(/^oklch\(\s*([0-9.]+)(%?)/i);
  if (!match) return null;
  return match[2] ? Number(match[1]) / 100 : Number(match[1]);
}

const fallbackFor = (value: string): string => {
  const mode = MODES.find((item) => item.value === value)?.mode ?? "light";
  return DEFAULTS.find((item) => item.mode === mode)?.value ?? value;
};

/** The theme to put in a story URL: the site's, or the default in the same mode when the live Storybook lacks it. */
export function useStoryTheme(theme: string): string {
  const isMissing = useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    () => {
      hydrate();
      return missing.has(theme);
    },
    () => false,
  );
  return isMissing ? fallbackFor(theme) : theme;
}

/**
 * Call with a rendered story document: learns whether the live Storybook has `theme`.
 * Answers `true` when it does NOT — the frame is about to reload with the fallback, so the
 * caller should keep it hidden.
 */
export function reportStoryTheme(theme: string, doc: Document | null | undefined): boolean {
  if (!doc || missing.has(theme) || fallbackFor(theme) === theme) return false;
  const expected = lightness(MODES.find((item) => item.value === theme)?.background ?? "");
  const view = doc.defaultView;
  if (expected === null || !view) return false;
  const actual = lightness(
    view.getComputedStyle(doc.documentElement).getPropertyValue("--background"),
  );
  // Only a polarity-sized gap counts: themes are retuned between releases, never inverted.
  if (actual === null || Math.abs(actual - expected) < 0.3) return false;
  missing.add(theme);
  try {
    window.sessionStorage.setItem(STORE_KEY, JSON.stringify([...missing]));
  } catch {
    // See `hydrate`.
  }
  for (const notify of listeners) notify();
  return true;
}
