/**
 * `@elabs-ai/components-charts/dashboard` — the dashboard sheet surface (ADR 0037).
 *
 * Re-exports ONLY the dashboard surface; the main `@elabs-ai/components-charts` barrel never
 * re-exports anything from here. Rules: `.claude/rules/dashboard.md`; gate:
 * `pnpm check --rule dashboard-reuse`.
 *
 * Each later item appends its export block under its own reserved marker below, so parallel
 * appends are adjacent-line merges. Keep the markers in this order.
 */

// Framework-free core (spec, validate, layout, store, history, selection) — re-exported here;
// there is no public `/dashboard/core` subpath (ADR 0037 §2).
export * from "./core";

// Provider/Sheet/Tile/hooks — RM-074
export * from "./dashboard-sheet";

// Built-in tiles — RM-075
export * from "./tiles";

// SelectionBar — RM-076
export * from "./chrome";
export * from "./tiles/filter-tile";

// Edit layer — RM-078
export * from "./edit";

// Toolbar — RM-079
// DashboardToolbar/DashboardGridSettings/useDashboardShortcuts live in `./chrome` and are
// already re-exported by the `export * from "./chrome"` above (RM-076) — nothing new here.

// Panels — RM-080
// DashboardAssetPanel, DashboardPropertiesPanel and their forms ship through `./chrome` above.

// Interactions editor — RM-082

// Export — RM-084

// Presentation/Theme/Workbook — RM-087
