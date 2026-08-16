"use client";
/**
 * Theme switcher — System / Light / Dark (the baseline default).
 * Grounded in a qLabs tool/workspace app's theme switcher.
 *
 * PREFER the library `<ThemeSwitcher />` from @elabs/components-ui: its `themes` defaults to the
 * Qlik light/dark pair and `showSystem` defaults to true, so it ALREADY renders exactly
 * System / Light / Dark (whole-screen animated, reduced-motion safe). This
 * curated Select is an OPTIONAL alternative when you want explicit text labels instead
 * of the icon toggle. (Verified against @elabs/components-* v1.0.0 source.)
 */
import { THEME_META, useTheme, type ThemeName } from "@elabs/components-tokens";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@elabs/components-ui";
import { useEffect, useState } from "react";

const MODE_KEY = "ui.themeMode";
const LIGHT: ThemeName = "light";
const DARK: ThemeName = "dark";
type ThemeMode = "light" | "dark" | "system";

function storedMode(): ThemeMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    return v === "dark" || v === "system" ? v : "light";
  } catch {
    return "light";
  }
}
function systemTheme(): ThemeName {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? DARK
    : LIGHT;
}

export function ThemeSwitcher() {
  const { setTheme } = useTheme();
  const [mode, setMode] = useState<ThemeMode>(storedMode);

  // Apply the mode; in System, follow OS appearance changes live.
  useEffect(() => {
    if (mode !== "system") {
      setTheme(mode);
      return;
    }
    setTheme(systemTheme());
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setTheme(systemTheme());
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [mode, setTheme]);

  const choose = (next: ThemeMode) => {
    setMode(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      // ignore
    }
  };

  return (
    <Select value={mode} onValueChange={(v) => choose(v as ThemeMode)}>
      <SelectTrigger size="sm" className="w-[150px]" aria-label="Appearance">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="light">{THEME_META[LIGHT].label}</SelectItem>
        <SelectItem value="dark">{THEME_META[DARK].label}</SelectItem>
        <SelectItem value="system">System</SelectItem>
      </SelectContent>
    </Select>
  );
}
