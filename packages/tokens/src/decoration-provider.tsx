import { forwardRef, type HTMLAttributes } from "react";
import type { DecorationLevel } from "./theme-types";

export interface DecorationProviderProps extends HTMLAttributes<HTMLDivElement> {
  /** The decoration dial (0–10) applied to this subtree. */
  level: DecorationLevel;
}

/**
 * Sets the decoration dial for a subtree by writing `data-decoration`. A plain
 * region wrapper — the CSS cascade does the work, so no React context or "use
 * client" is needed. Use it to give a diagram, panel, page, or modal a uniform
 * blueprint level without changing the document theme:
 *
 *   <DecorationProvider level={6} className="rounded-lg">…</DecorationProvider>
 *
 * For document-level decoration, prefer `ThemeProvider` (it persists the choice);
 * for ad-hoc one-offs, the bare `data-decoration="N"` attribute also works.
 */
export const DecorationProvider = forwardRef<HTMLDivElement, DecorationProviderProps>(
  function DecorationProvider({ level, ...props }, ref) {
    return <div ref={ref} data-decoration={level} {...props} />;
  },
);
