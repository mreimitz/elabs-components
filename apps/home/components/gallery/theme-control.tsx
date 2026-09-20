"use client";
/**
 * The site theme as it is safe to RENDER. The inline init script picks the theme before first
 * paint, which the server cannot see, so until mount this reports the neutral default and the
 * server and client markup agree (no hydration mismatch on a `?theme=` or stored theme). The
 * switching control itself is the library's `ThemeSwitcher`.
 */
import { useEffect, useState } from "react";
import { useSiteTheme, type SiteThemeMode } from "../../lib/theme-state";

export function useHydratedSiteTheme() {
  const state = useSiteTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const mode: SiteThemeMode = mounted ? state.mode : "light";
  return { ...state, family: mounted ? state.family : "default", mode };
}
