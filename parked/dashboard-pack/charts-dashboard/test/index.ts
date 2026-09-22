/**
 * `@elabs-ai/components-charts/dashboard/test` — the engine-free dashboard test double
 * (ADR 0037 §2, RM-077). Validates rather than mocking as a no-op — the same contract
 * `@elabs-ai/components-charts/test` keeps (`.claude/rules/charts.md` "Test double").
 *
 * ```ts
 * // vitest.setup.ts
 * vi.mock("@elabs-ai/components-charts/dashboard", async () =>
 *   import("@elabs-ai/components-charts/dashboard/test"),
 * );
 * ```
 *
 * `assertDashboardSpec`/`DashboardSpecError` throw on a broken spec instead of silently
 * accepting one; `DashboardSheet` renders `<div data-tile-id data-tile-kind>` per tile, in
 * reading order, after validating — no chart engines, no `DashboardProvider`, no selection or
 * history. `createDashboardStore` is the REAL store (`../core/store`): `zustand/vanilla` and
 * framework-free, so re-exporting the genuine implementation costs nothing and there is
 * nothing to fake. Never import `@dnd-kit/*`, visx/d3/motion or a chart barrel at runtime
 * from here.
 */

// Spec test double — RM-077
export { DashboardSpecError, assertDashboardSpec } from "./contract";
export { DashboardSheet } from "./doubles";
export type { DashboardSheetProps } from "./doubles";
export { createDashboardStore } from "../core/store";
export type {
  CreateDashboardStoreOptions,
  DashboardActions,
  DashboardHover,
  DashboardMode,
  DashboardState,
  DashboardStore,
  NewTileSpec,
  TileLayoutOptions,
  TilePatch,
} from "../core/store";
