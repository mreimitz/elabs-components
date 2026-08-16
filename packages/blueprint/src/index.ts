/**
 * @elabs/components-blueprint — decorative "drawing furniture" for the reprographic
 * blueprint theme: graph-paper grounds, sheet frames with corner ticks,
 * dimension lines, registration marks, figure labels, part callouts and a
 * drafting title block.
 *
 * Purely presentational + token-driven (no raw colors): everything reads the
 * --rule / --grid-line / --foreground tokens, so the primitives re-tint with
 * the active theme and look most at home under `data-theme="blueprint"`.
 * Decorative-only marks are aria-hidden; informational ones are labelled.
 */
export * from "./grid-paper";
export * from "./placeholder-box";
export * from "./blueprint-frame";
export * from "./blueprint-sheet";
export * from "./dimension-line";
export * from "./crosshair";
export * from "./fig-annotation";
export * from "./callout";
export * from "./title-block";
