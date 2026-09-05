/**
 * Shell metrics — a pattern to copy, deliberately NOT a package component.
 *
 * The widths below are an app's decision, not the library's: `@elabs-ai/components-ui`
 * ships the `Sidebar` primitive and lets each zone pick its own expanded/collapsed
 * width. This module declares those widths ONCE and publishes derived offsets as CSS
 * custom properties on the shell root, so a row living in a completely different
 * subtree (a toolbar, a floating panel) can align with the content column without a
 * CSS selector ever reaching across zones — the offsets travel through inherited
 * custom properties instead.
 *
 * Copy this file into your own app-shell block and retune the pixel constants; don't
 * import it as a stable API (`isPathActive`/`NAV_GROUPS` in `nav-items.ts` are the one
 * export other tasks in this registry block are meant to reuse — `shellStyle`/`ShellState`
 * travel the same way, by copy, once this block leaves this repo).
 */
import type { CSSProperties } from "react";

export const NAV_EXPANDED_PX = 256;
export const NAV_COLLAPSED_PX = 48;
export const LIST_COLUMN_PX = 280;
export const CONTEXT_EXPANDED_PX = 320;
export const CONTEXT_COLLAPSED_PX = 48;
export const INSET_GAP_PX = 8;

export interface ShellState {
  nav: boolean;
  list: boolean;
  context: boolean;
}

export function shellStyle({ nav, list, context }: ShellState): CSSProperties {
  const navPx = nav ? NAV_EXPANDED_PX : NAV_COLLAPSED_PX;
  const listPx = list ? LIST_COLUMN_PX : 0;
  const contextPx = context ? CONTEXT_EXPANDED_PX : CONTEXT_COLLAPSED_PX;
  return {
    "--shell-nav-w": `${navPx}px`,
    "--shell-list-w": `${listPx}px`,
    "--shell-context-w": `${contextPx}px`,
    "--shell-content-start": `${navPx + listPx + INSET_GAP_PX}px`,
  } as CSSProperties;
}
