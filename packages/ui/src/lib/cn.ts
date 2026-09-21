import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The semantic type roles (`--text-<role>` tokens → `text-<role>` utilities, #187).
 * tailwind-merge doesn't know custom theme keys, so without registration it
 * classifies `text-title` as a text COLOR — and `cn("text-kpi", "text-foreground")`
 * would silently drop the role. Registering the roles in the `font-size` class
 * group makes role-vs-role and role-vs-raw-size conflicts resolve correctly while
 * keeping role + color independent.
 */
const TEXT_ROLES = [
  "display-lg",
  "display",
  "title",
  "subtitle",
  "body",
  "caption",
  "meta",
  "eyebrow",
  "heading-xs",
  "kpi",
  "kpi-sm",
  "code",
  // Chart type roles (RM-019, themes.css § chart type roles). They were missing
  // here from RM-019 until the 2026-09-21 new-user test: `cn("text-chart-source",
  // "text-chart-foreground-muted")` dropped the role and every ChartCard source
  // row rendered at body size. `cn.test.ts` now derives the expected list from
  // themes.css, so a new `--text-<role>` token cannot drift from this list again.
  "chart-value",
  "chart-source",
];

/**
 * Tailwind v4's CSS-variable shorthand (`leading-(--card-title-leading)`).
 * tailwind-merge 2.x predates it and leaves such a class beside a caller's
 * `leading-tight`, letting stylesheet order pick the winner. A typed hint
 * (`text-(length:--x)`) is read as a variant prefix by 2.x and cannot be
 * registered — give that seam a named `@theme` utility instead
 * (`text-table-header`).
 */
const isVarShorthand = (value: string) => /^\(--[\w-]+\)$/.test(value);

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [...TEXT_ROLES, "table-header"] }],
      leading: [{ leading: [isVarShorthand] }],
      tracking: [{ tracking: [isVarShorthand] }],
      // `font-display` is the display-face seam (sibling of font-mono, #187).
      "font-family": [{ font: ["display"] }],
      // Theme-driven control/table/surface knobs (themes.css § CONTROL UTILITIES
      // and the `@theme inline` bridge) — so a caller's `h-8` / `rounded-none` /
      // `font-bold` / `shadow-none` still replaces the token default.
      "font-weight": [{ font: ["control", "table-header", "tabs-active"] }],
      rounded: [{ rounded: ["control", "badge"] }],
      shadow: [{ shadow: ["input", "card", "popover", "dialog"] }],
      h: [{ h: ["control", "control-sm", "control-lg", "header"] }],
      size: [{ size: ["control", "control-sm", "control-lg"] }],
      "min-w": [{ "min-w": ["control", "control-sm", "control-lg"] }],
    },
  },
});

/**
 * Merge class names with conflict resolution. `clsx` handles conditionals;
 * `tailwind-merge` ensures later Tailwind utilities win (e.g. `p-2 p-4` -> `p-4`).
 * Use this in every component that accepts a `className` prop.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
