"use client";

import { forwardRef, useCallback, useEffect, useState, type HTMLAttributes } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemeDefinition, type ThemeName } from "@elabs-ai/components-tokens";

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

type ButtonSize = "sm" | "default" | "lg";
const ICON_SIZE: Record<ButtonSize, "icon-sm" | "icon" | "icon-lg"> = {
  sm: "icon-sm",
  default: "icon",
  lg: "icon-lg",
};

/** A theme choice, or "system" to follow the OS color scheme. */
export type ThemePreference = ThemeName | "system";

export interface ThemeSwitcherProps extends Omit<HTMLAttributes<HTMLButtonElement>, "onChange"> {
  /**
   * Themes to offer, as names. ≤2 → toggle; >2 → dropdown.
   *
   * Defaults to the PROVIDER's registry (ADR 0029) — so an app that registers
   * its own themes gets a working switcher with no prop at all. Pass this only
   * to offer a subset, or to fix the order; names the provider doesn't know are
   * dropped.
   */
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
function pickByDarkness(list: readonly ThemeDefinition[], dark: boolean): ThemeName | undefined {
  return (list.find((t) => t.dark === dark) ?? list[0])?.value;
}

/**
 * Adaptive theme control. With ≤2 themes it renders a light/dark/system toggle
 * (a single icon button that cycles); with >2 it auto-upgrades to a dropdown
 * over the offered themes. Every switch animates the whole screen via
 * `useThemeTransition` (respecting reduced motion). Icons follow each theme's
 * `dark` flag, so it works for any theme — including one you authored.
 *
 * Uncontrolled by default (tracks its own "system" choice via `localStorage`).
 * Pass `preference`/`onPreferenceChange` to drive it from an external store
 * instead (#366) — see the `Controlled` story.
 *
 * **It renders the PROVIDER's registry** (ADR 0029). Register your themes on
 * `<ThemeProvider themes={…}>` and this switcher offers them with no prop —
 * which is also why `allowedThemes` (#355) is honoured for free: the provider
 * has already narrowed what it exposes. The `themes` prop is now purely an
 * additional, optional narrowing on top; a name the provider does not offer is
 * dropped rather than rendered, so a disallowed or unregistered theme is never
 * reachable via a menu item, the toggle, "System", or the OS
 * `prefers-color-scheme` listener.
 *
 * The pre-ADR-0029 hard-coded `["light","dark"]` default is gone. Behaviour for
 * an app on the default provider is unchanged — that registry IS light + dark.
 */
export const ThemeSwitcher = forwardRef<HTMLButtonElement, ThemeSwitcherProps>(
  function ThemeSwitcher(
    {
      themes,
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
    const { theme, themeDefinitions, setTheme } = useTheme();
    const switchTheme = useThemeTransition(effect);
    const isControlled = preference !== undefined;
    const [uncontrolledIsSystem, setUncontrolledIsSystem] = useState(false);
    const isSystem = isControlled ? preference === "system" : uncontrolledIsSystem;

    // The provider's registry is the universe; the prop only narrows it, in the
    // prop's own order. A name the provider doesn't offer is DROPPED (it has no
    // CSS block here and no label to render), and an empty intersection falls
    // back to the whole registry rather than to a hard-coded pair — falling back
    // to literals is what could resurrect a theme the provider disallowed.
    const narrowed = themes
      ? themes
          .map((name) => themeDefinitions.find((d) => d.value === name))
          .filter((d): d is ThemeDefinition => d !== undefined)
      : themeDefinitions;
    const offered: readonly ThemeDefinition[] = narrowed.length > 0 ? narrowed : themeDefinitions;
    const safeThemes: ThemeName[] = offered.map((d) => d.value);
    const labelOf = (name: ThemeName) => offered.find((d) => d.value === name)?.label ?? name;
    const isDark = (name: ThemeName) => offered.find((d) => d.value === name)?.dark ?? false;

    // `?? theme` (the active theme), never a "light"/"dark" literal: with an open
    // registry those names may not exist at all in this app.
    const lightTheme: ThemeName = pickByDarkness(offered, false) ?? theme;
    const darkTheme: ThemeName = pickByDarkness(offered, true) ?? theme;

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

    const TriggerIcon = isSystem ? Monitor : isDark(resolvedTheme) ? Moon : Sun;
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
            {offered.map((d) => (
              <DropdownMenuItem key={d.value} onSelect={() => pickTheme(d.value)}>
                {d.dark ? <Moon /> : <Sun />}
                <span>{d.label}</span>
                {!isSystem && resolvedTheme === d.value ? <Check className="ml-auto" /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    // ---- Toggle mode (≤2 themes): cycle light → dark → (system) ----
    // These three are ROLES in the cycle, not theme names — `lightTheme` and
    // `darkTheme` resolve each role to whatever this app actually registered.
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

    // Announce the THEME'S OWN label, not the role: an app whose themes are
    // "Daylight"/"Midnight" would otherwise announce "Theme: light" — naming a
    // theme that does not exist in that app.
    // `role` is optional only because `order[i]` is an indexed read under
    // `noUncheckedIndexedAccess`; the modulo above makes it always present.
    const roleLabel = (role: "light" | "dark" | "system" | undefined) =>
      role === "system" ? "System" : labelOf(role === "dark" ? darkTheme : lightTheme);

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              ref={ref}
              variant="ghost"
              size={ICON_SIZE[size]}
              aria-label={`Theme: ${roleLabel(current)}. Activate to switch to ${roleLabel(next)}.`}
              onClick={apply}
              className={className}
              {...props}
            >
              <TriggerIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{roleLabel(current)}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  },
);
