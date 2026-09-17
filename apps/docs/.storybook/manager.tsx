/** @jsxRuntime classic */
// The manager bundle compiles JSX with the classic runtime: React must be in scope.
import React, { memo, useState } from "react";
import { Select } from "storybook/internal/components";
import { addons, types, useChannel, useGlobals, useParameter } from "storybook/manager-api";
import { create } from "storybook/theming";
import { inject } from "@vercel/analytics";

import {
  THEME_FAMILIES_EVENT,
  findFamily,
  type ToolbarScheme,
  type ToolbarThemeFamily,
} from "./theme-toolbar";

// Brand the Storybook manager (sidebar header / loading screen) with the brand-ui
// lockup instead of the default Storybook logo. The image is the same mark the
// browser-tab favicon uses (apps/docs/public/brand-logo.svg) — a static asset,
// served from staticDirs at the manager root, so `./brand-logo.svg` resolves the
// same way `./brand-favicon.svg` does in main.ts's managerHead.
const managerTheme = create({
  base: "dark",
  brandTitle: "brand-ui",
  brandImage: "./brand-logo.svg",
  brandUrl: "/",
  brandTarget: "_self",
  // The brand lime for the selected/active sidebar item, replacing Storybook's
  // default blue so the chrome reads on-brand. Hard-coded because the manager
  // renders outside the token stylesheet — keep it equal to --brand-mark-tail.
  colorSecondary: "#D0E268",
});

addons.setConfig({ theme: managerTheme });

// Storybook composes `document.title` as "<story> - <kind> ⋅ Storybook" and the
// suffix is hard-coded (storybook/manager: getDescription), so the theme's
// brandTitle never reaches the tab title or a shared link's unfurl. Rewrite the
// suffix whenever the manager sets it; the rewritten value no longer matches,
// so the observer settles after one pass.
const titleEl = document.querySelector("title");
if (titleEl) {
  const rebrand = () => {
    if (/ ⋅ Storybook$/.test(document.title)) {
      document.title = document.title.replace(/ ⋅ Storybook$/, " ⋅ brand-ui");
    } else if (document.title === "Storybook") {
      document.title = "brand-ui";
    }
  };
  rebrand();
  new MutationObserver(rebrand).observe(titleEl, {
    childList: true,
    characterData: true,
    subtree: true,
  });
}

// Vercel Web Analytics for the hosted docs. Injected in the MANAGER (the top
// window whose URL changes as people browse stories), not the preview iframe,
// so each visit counts once. `@vercel/analytics/next` is the Next.js wrapper;
// Storybook is a static Vite app, so it uses the framework-agnostic `inject`.
// Local `pnpm storybook` has no `/_vercel/insights` endpoint — skip it there.
if (!["localhost", "127.0.0.1"].includes(window.location.hostname)) {
  inject({ mode: "production", framework: "storybook" });
}

/**
 * Theme / Mode toolbar (ADR 0036) — replaces `@storybook/addon-themes`' single
 * flat theme list. "Theme" picks a family (Default first, then every
 * downloadable family); "Mode" appears only when that family ships both light
 * and dark. The family list arrives from `preview.tsx` over the channel; the
 * global contract lives in `theme-toolbar.ts`.
 */
const ThemeToolbar = memo(function ThemeToolbar() {
  const channel = addons.getChannel();
  const [families, setFamilies] = useState<readonly ToolbarThemeFamily[]>(
    () => (channel.last(THEME_FAMILIES_EVENT)?.[0] as ToolbarThemeFamily[] | undefined) ?? [],
  );
  useChannel({ [THEME_FAMILIES_EVENT]: (next: ToolbarThemeFamily[]) => setFamilies(next) });
  const [globals, updateGlobals, storyGlobals] = useGlobals();
  const { themeOverride } = useParameter<{ themeOverride?: string }>("themes", {});

  const first = families[0];
  if (!first) return null;
  const found = findFamily(families, globals.theme as string | undefined);
  const family = found?.family ?? first;
  const scheme: ToolbarScheme =
    found?.variantScheme ?? (globals.mode === "dark" ? "dark" : "light");
  // A story that pins its own theme is demonstrating it — show, don't switch.
  const locked = "theme" in storyGlobals || !!themeOverride;

  return (
    <>
      <Select
        key={`theme-${family.id}-${locked}`}
        ariaLabel="Theme"
        disabled={locked}
        defaultOptions={family.id}
        options={families.map((f) => ({ title: f.label, value: f.id }))}
        // Keep the effective scheme when leaving a variant-named global.
        onSelect={(id) => updateGlobals({ theme: String(id), mode: scheme })}
      >
        {locked ? "Theme set by story" : family.label}
      </Select>
      {family.schemes.length === 2 && !locked ? (
        <Select
          key={`mode-${family.id}-${scheme}`}
          ariaLabel="Mode"
          defaultOptions={scheme}
          options={[
            { title: "Light", value: "light" },
            { title: "Dark", value: "dark" },
          ]}
          onSelect={(mode) => updateGlobals({ theme: family.id, mode: String(mode) })}
        >
          {scheme === "dark" ? "Dark" : "Light"}
        </Select>
      ) : null}
    </>
  );
});

addons.register("brand-ui/theme-toolbar", () => {
  addons.add("brand-ui/theme-toolbar/tool", {
    title: "Theme",
    type: types.TOOL,
    match: ({ viewMode, tabId }) => !!viewMode?.match(/^(story|docs)$/) && !tabId,
    render: ThemeToolbar,
  });
});
