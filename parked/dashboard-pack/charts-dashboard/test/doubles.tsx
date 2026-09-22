"use client";

/**
 * `DashboardSheet` — the dashboard sheet's jsdom-safe test double (`.claude/rules/dashboard.md`;
 * `.claude/rules/charts.md` "Test double"). Renders one `<div data-tile-id data-tile-kind>` per
 * tile, in reading order (top-to-bottom, then left-to-right) — no chart engines, no per-sheet
 * store beyond the `mode` prop, no selection or history. `assertDashboardSpec` (`./contract`)
 * runs before anything renders, so a test using the double still fails on a broken spec exactly
 * where the real `DashboardProvider` would.
 */
import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@elabs-ai/components-ui";

import { assertDashboardSpec } from "./contract";
import type { DashboardSpec, TileSpec } from "../core/spec";
import type { DashboardMode } from "../core/store";

export interface DashboardSheetProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  spec: DashboardSpec;
  /** Default `"view"`. Written to `data-mode`; this double owns no other store state. */
  mode?: DashboardMode;
}

function readingOrder(a: TileSpec, b: TileSpec): number {
  return a.layout.y - b.layout.y || a.layout.x - b.layout.x;
}

export const DashboardSheet = forwardRef<HTMLDivElement, DashboardSheetProps>(
  function DashboardSheet({ spec, mode = "view", className, ...props }, ref) {
    const validated = assertDashboardSpec(spec);
    const tiles = [...validated.tiles].sort(readingOrder);
    return (
      <div
        ref={ref}
        data-slot="dashboard-sheet"
        data-mode={mode}
        className={cn("grid gap-2", className)}
        {...props}
      >
        {tiles.map((tile) => (
          <div
            key={tile.id}
            data-slot="dashboard-sheet-tile"
            data-tile-id={tile.id}
            data-tile-kind={tile.kind}
          />
        ))}
      </div>
    );
  },
);
DashboardSheet.displayName = "DashboardSheet";
