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
const TEXT_ROLES = ["display", "title", "subtitle", "body", "caption", "meta", "kpi", "code"];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: TEXT_ROLES }],
      // `font-display` is the display-face seam (sibling of font-mono, #187).
      "font-family": [{ font: ["display"] }],
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
