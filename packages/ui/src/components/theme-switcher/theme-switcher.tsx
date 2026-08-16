"use client";

import { forwardRef, useCallback, useEffect, useState, type HTMLAttributes } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { THEME_META, THEMES, useTheme, type ThemeName } from "@elabs/components-tokens";

import { Button } from "../button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../tooltip";
import { useThemeTransition, type ThemeTransitionEffect } from "./use-theme-transition";

const SYSTEM_STORAGE_KEY = "brand-ui-theme-system";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Default light/dark pair used when an app doesn't pass its own `themes`. */
export const DEFAULT_THEME_PAIR: ThemeName[] = ["light", "dark"];

type ButtonSize = "sm" | "default" | "lg";
const ICON_SIZE: Record<ButtonSize, "icon-sm" | "icon" | "icon-lg"> = {
  sm: "icon-sm",
  default: "icon",
  lg: "icon-lg",
};

/** A theme choice, or "system" to follow the OS color scheme. */
export type ThemePreference = ThemeName | "system";

export interface ThemeSwitcherProps extends Omit<HTMLAttributes<HTMLButtonElement>, "onChange"> {
  /** Themes to offer. ≤2 → toggle; >2 → dropdown. Defaults to the Qlik light/dark pair. */
  themes?: ThemeName[];
  /** Force presentation; "auto" (default) picks toggle vs dropdown by theme count. */
  mode?: "auto" | "toggle" | "dropdown";
  /** Offer a "System" option that follows the OS color scheme. Default true. */
  showSystem?: boolean;
  /** Whole-screen reveal effect for the animated switch. Default "polygon". */
  effect?: ThemeTransitionEffect;
  /** Control size. Default "default". */
  size?: ButtonSize;
  /**
   * Controlled preference (#366). When set, the switcher derives its "current"
   * state — including "system" — from this prop instead of its own internal,
   * `localStorage`-backed state, and reports every user pick via
   * `onPreferenceChange` instead of writing its own storage key. Pass this pair
   * when your app's actual source of truth is a different persisted preference
   * (a settings API, a different storage key, a server-synced setting). Omit
   * both for the default, uncontrolled behavior (unchanged).
   */
  preference?: ThemePreference;
  /** Called with the new preference on every user pick, when `preference` is controlled. */
  onPreferenceChange?: (preference: ThemePreference) => void;
}

function prefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia(DARK_QUERY).matches;
}

/** First theme in `list` matching `dark`, or the list's own first entry as a last resort. */
function pickByDarkness(list: readonly ThemeName[], dark: boolean): ThemeName | undefined {
  return list.find((t) => THEME_META[t].dark === dark) ?? list[0];
}

/**
 * Adaptive theme control. With ≤2 themes it renders a light/dark/system toggle
 * (a single icon button that cycles); with >2 it auto-upgrades to a dropdown
 * over the offered themes. Every switch animates the whole screen via
 * `useThemeTransition` (respecting reduced motion). Icons follow each theme's
 * `dark` flag, so it works for any of the six brand themes — not just light/dark.
 *
 * Uncontrolled by default (tracks its own "system" choice via `localStorage`).
 * Pass `preference`/`onPreferenceChange` to drive it from an external store
 * instead (#366) — see the `Controlled` story.
 *
 * When a `ThemeProvider` restricts `allowedThemes` (#355), this component
 * narrows to that subset automatically (#384): the `themes` prop is intersected
 * with `useTheme().themes` whenever the provider is genuinely restricting (a
 * strict subset of every shipped theme), so a disallowed theme is never
 * offered and never reachable via a menu item, the toggle, "System", or the OS
 * `prefers-color-scheme` listener. A provider exposing every theme (the
 * default, and every pre-#355 provider) leaves `themes` untouched, so existing
 * consumers keep today's presentation — including the light/dark toggle at the
 * default 2-theme `themes` prop.
 */
export const ThemeSwitcher = forwardRef<HTMLButtonElement, ThemeSwitcherProps>(
  function ThemeSwitcher(
    {
      themes = DEFAULT_THEME_PAIR,
      mode = "auto",
      showSystem = true,
      effect = "polygon",
      size = "default",
      preference,
      onPreferenceChange,
      className,
      ...props
    },
    ref,
  ) {
    const { theme, themes: providerThemes, setTheme } = useTheme();
    const switchTheme = useThemeTransition(effect);
    const isControlled = preference !== undefined;
    const [uncontrolledIsSystem, setUncontrolledIsSystem] = useState(false);
    const isSystem = isControlled ? preference === "system" : uncontrolledIsSystem;

    // Drop any unknown theme name (e.g. a stale prop) so a bad value degrades
    // to the default pair instead of crashing the whole render on THEME_META[t].
    const offered = themes.filter((t) => THEME_META[t]);
    const propThemes: ThemeName[] = offered.length > 0 ? offered : DEFAULT_THEME_PAIR;

    // #384 — the provider only CONSTRAINS when it is genuinely restricting (a
    // strict subset of every shipped theme). A provider exposing everything —
    // the default, and every pre-#355 provider — leaves `themes` untouched, so
    // existing 2-theme consumers keep their toggle presentation (the
    // breaking-change hazard #384 flags against naively defaulting to
    // `useTheme().themes`).
    const providerRestricts = providerThemes.length < THEMES.length;
    const allowedByProvider = providerRestricts
      ? propThemes.filter((t) => providerThemes.includes(t))
      : propThemes;
    // An empty intersection (the prop's themes and the provider's disagree
    // entirely) falls back to the PROVIDER's list, never to DEFAULT_THEME_PAIR —
    // falling back to the hardcoded pair could resurrect a disallowed theme.
    const safeThemes: ThemeName[] =
      providerRestricts && allowedByProvider.length === 0 ? [...providerThemes] : allowedByProvider;

    // Never fall back to the hardcoded "light"/"dark" literals when
    // the provider restricts — retry within the provider's own list first, so
    // "light"/"dark"/"System" can never resolve to a disallowed theme.
    const lightTheme: ThemeName =
      pickByDarkness(safeThemes, false) ??
      (providerRestricts ? pickByDarkness(providerThemes, false) : undefined) ??
      "light";
    const darkTheme: ThemeName =
      pickByDarkness(safeThemes, true) ??
      (providerRestricts ? pickByDarkness(providerThemes, true) : undefined) ??
      "dark";

    // The concrete theme to DISPLAY as current: the controlled preference when
    // it names one, otherwise the theme actually applied via the provider.
    const resolvedTheme: ThemeName =
      isControlled && preference !== undefined && preference !== "system" ? preference : theme;

    // Hydrate the "system" choice from localStorage and apply it on mount —
    // uncontrolled mode only. Controlled mode's "system" state comes from the
    // `preference` prop and never touches this component's own storage key.
    useEffect(() => {
      if (isControlled) return;
      if (typeof window === "undefined") return;
      const active = window.localStorage.getItem(SYSTEM_STORAGE_KEY) === "1";
      setUncontrolledIsSystem(active);
      if (active) setTheme(prefersDark() ? darkTheme : lightTheme);
      // Mount-once hydration by design (mirrors the pre-#366 behavior); a
      // component must not flip controlled/uncontrolled mid-lifecycle
      // (.claude/rules/component-api.md), so `isControlled` cannot change here.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Keep the applied theme tracking the OS scheme while "system" is active —
    // controlled or not. Depends on every value it reads (unlike the effect
    // above) so it never captures a stale `lightTheme`/`darkTheme` once those
    // become provider-derived (the staleness risk #384 flags).
    useEffect(() => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
      const mql = window.matchMedia(DARK_QUERY);
      const onChange = () => {
        const active = isControlled
          ? preference === "system"
          : window.localStorage.getItem(SYSTEM_STORAGE_KEY) === "1";
        if (active) setTheme(prefersDark() ? darkTheme : lightTheme);
      };
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }, [isControlled, preference, darkTheme, lightTheme, setTheme]);

    const pickTheme = useCallback(
      (next: ThemeName) => {
        if (isControlled) {
          onPreferenceChange?.(next);
        } else {
          setUncontrolledIsSystem(false);
          if (typeof window !== "undefined") window.localStorage.setItem(SYSTEM_STORAGE_KEY, "0");
        }
        switchTheme(next);
      },
      [switchTheme, isControlled, onPreferenceChange],
    );

    const pickSystem = useCallback(() => {
      if (isControlled) {
        onPreferenceChange?.("system");
      } else {
        setUncontrolledIsSystem(true);
        if (typeof window !== "undefined") window.localStorage.setItem(SYSTEM_STORAGE_KEY, "1");
      }
      switchTheme(prefersDark() ? darkTheme : lightTheme);
    }, [switchTheme, darkTheme, lightTheme, isControlled, onPreferenceChange]);

    const TriggerIcon = isSystem ? Monitor : THEME_META[resolvedTheme].dark ? Moon : Sun;
    const useDropdown = mode === "dropdown" || (mode === "auto" && safeThemes.length > 2);

    // ---- Dropdown mode (>2 themes) ----
    if (useDropdown) {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              ref={ref}
              variant="outline"
              size={ICON_SIZE[size]}
              aria-label="Theme"
              className={className}
              {...props}
            >
              <TriggerIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {showSystem ? (
              <DropdownMenuItem onSelect={() => pickSystem()}>
                <Monitor />
                <span>System</span>
                {isSystem ? <Check className="ml-auto" /> : null}
              </DropdownMenuItem>
            ) : null}
            {safeThemes.map((t) => (
              <DropdownMenuItem key={t} onSelect={() => pickTheme(t)}>
                {THEME_META[t].dark ? <Moon /> : <Sun />}
                <span>{THEME_META[t].label}</span>
                {!isSystem && resolvedTheme === t ? <Check className="ml-auto" /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    // ---- Toggle mode (≤2 themes): cycle light → dark → (system) ----
    const order: Array<"light" | "dark" | "system"> = showSystem
      ? ["light", "dark", "system"]
      : ["light", "dark"];
    const current: "light" | "dark" | "system" = isSystem
      ? "system"
      : resolvedTheme === darkTheme
        ? "dark"
        : "light";
    const next = order[(order.indexOf(current) + 1) % order.length];
    const apply = () => {
      if (next === "system") pickSystem();
      else pickTheme(next === "dark" ? darkTheme : lightTheme);
    };

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              ref={ref}
              variant="ghost"
              size={ICON_SIZE[size]}
              aria-label={`Theme: ${current}. Activate to switch to ${next}.`}
              onClick={apply}
              className={className}
              {...props}
            >
              <TriggerIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="capitalize">{current}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  },
);
