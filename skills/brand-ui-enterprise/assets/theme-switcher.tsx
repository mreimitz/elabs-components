"use client";
/**
 * Theme switcher — System / Light / Dark (the baseline default).
 *
 * PREFER the library `<ThemeSwitcher />` from @elabs-ai/components-ui: it renders the
 * PROVIDER's theme registry (ADR 0029) with no `themes` prop at all, and `showSystem`
 * defaults to true, so it ALREADY renders exactly System / Light / Dark (whole-screen
 * animated, reduced-motion safe) — and picks up any theme you registered yourself. This
 * curated Select is an OPTIONAL alternative when you want explicit text labels instead
 * of the icon toggle.
 *
 * Labels come from `useTheme().themeDefinitions`, so this stays correct for a custom
 * registry too; the `light`/`dark` constants below name the two REFERENCE themes and
 * are what you change if your app ships different ones.
 */
import { useTheme, type ThemeName } from "@elabs-ai/components-tokens";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@elabs-ai/components-ui";
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
  const { setTheme, themeDefinitions } = useTheme();
  const [mode, setMode] = useState<ThemeMode>(storedMode);
  const labelOf = (name: ThemeName) =>
    themeDefinitions.find((d) => d.value === name)?.label ?? name;

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
        <SelectItem value="light">{labelOf(LIGHT)}</SelectItem>
        <SelectItem value="dark">{labelOf(DARK)}</SelectItem>
        <SelectItem value="system">System</SelectItem>
      </SelectContent>
    </Select>
  );
}
