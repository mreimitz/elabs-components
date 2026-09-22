"use client";

/**
 * Dashboard surface (RM-097) — the tour's "Dashboard" tab: an editable `DashboardSheet`
 * scoped to the frame (the tour frame is the shell — no app nav, unlike the full-page
 * `docs/playbooks/templates/dashboard-sheet.tsx`). Composed from the `dashboard-sheet`
 * template's provider/toolbar/sheet trio (`docs/playbooks/dashboard.md`) over Ashgrove's own
 * KPI and churn fixtures (RM-095), so the numbers match the hero and the chat tab.
 *
 * `visibleWhen` gates the movers table on a region being selected in the filter tile, so the
 * sheet's interaction graph (filter → table) is visible inside the frame. `reset` restores the
 * spec the surface mounted with. `window.__tourDashboardSpec` mirrors the live spec for the
 * browser acceptance check (drag/resize quoting `layout.x`/`layout.w`) — the same pattern
 * `packages/charts/src/dashboard/chrome/dashboard-panels.stories.tsx` uses for
 * `window.__dashboardStore`.
 */
import { useEffect, useState } from "react";
import {
  DashboardProvider,
  DashboardSheet,
  DashboardToolbar,
  builtInTiles,
  useDashboard,
  useDashboardActions,
  type DashboardSpec,
} from "@elabs-ai/components-charts/dashboard";
import { Button } from "@elabs-ai/components-ui";
import { tableTileKind } from "../../blocks/dashboard-tile-table/dashboard-tile-table";
import { REGIONS } from "../../../content/fixtures/company";
import {
  CHURN_BY_REGION,
  CHURN_SERIES,
  KPI_HEADLINES,
  headlineValue,
} from "../../../content/fixtures/kpis";
import { CHURN_MOVERS } from "../../../content/fixtures/churn";
import { dashboardSurfaceCopy, tourCopy } from "../../../content/copy";

declare global {
  interface Window {
    /** The live sheet spec, mirrored for the tour's browser acceptance check (RM-097). */
    __tourDashboardSpec?: DashboardSpec;
  }
}

const LOCALE = "en-US";
const usd = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
  notation: "compact",
});
const percent = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
const wholeNumber = new Intl.NumberFormat(LOCALE);

function formatHeadline(unit: string, value: number): string {
  if (unit === "usd") return usd.format(value);
  if (unit === "percent") return `${percent.format(value)}%`;
  return wholeNumber.format(value);
}

function formatDelta(unit: string, delta: number): string {
  const sign = delta >= 0 ? "+" : "";
  if (unit === "percent") return `${sign}${percent.format(delta)} pts`;
  if (unit === "usd") return `${sign}${usd.format(delta)}`;
  return `${sign}${wholeNumber.format(delta)}`;
}

function metricTile(id: string, layout: { x: number; y: number; w: number; h: number }) {
  const headline = KPI_HEADLINES.find((h) => h.id === id)!;
  return {
    id: `metric-${id}`,
    kind: "metric",
    title: headline.label,
    layout,
    content: {
      label: headline.label,
      value: formatHeadline(headline.unit, headline.value),
      delta: formatDelta(headline.unit, headline.delta),
      deltaDirection: headline.delta >= 0 ? ("up" as const) : ("down" as const),
    },
  };
}

const TILES = [...Object.values(builtInTiles), tableTileKind];

function buildSpec(): DashboardSpec {
  return {
    version: 1,
    id: "tour-dashboard",
    title: tourCopy.tabs.dashboard.label,
    grid: { mode: "fit", columns: 24, rows: 16, gap: 8 },
    tiles: [
      // `w: 5` with a 4-column gap between tiles, not the original edge-to-edge `w: 8` — a
      // `fit`-grid drop that would overlap a neighbour is rejected, and the edit layer's own
      // Shift+Arrow resize step is 4 cells (`DASHBOARD_EDIT_SHIFT_STEP`), so the row needs at
      // least 4 free columns after a tile for the acceptance check's drag/resize to land.
      metricTile("arr", { x: 0, y: 0, w: 5, h: 4 }),
      metricTile("active-accounts", { x: 9, y: 0, w: 5, h: 4 }),
      metricTile("nrr", { x: 18, y: 0, w: 5, h: 4 }),
      {
        id: "chart-churn-trend",
        kind: "chart",
        title: "Logo churn, weekly",
        layout: { x: 0, y: 4, w: 11, h: 7 },
        content: { type: "line", x: "week", series: ["value"], data: CHURN_SERIES.points },
      },
      {
        id: "chart-churn-region",
        kind: "chart",
        title: "Logo churn by region",
        layout: { x: 11, y: 4, w: 7, h: 7 },
        content: {
          type: "bar",
          x: "region",
          series: ["churn"],
          data: REGIONS.map((region) => ({
            region,
            churn: headlineValue(CHURN_BY_REGION[region]),
          })),
        },
      },
      {
        id: "filter-region",
        kind: "filter",
        // `x: 18, w: 6, h: 12` — a full-height sidebar column (spans the chart AND table row
        // bands, `y: 4` to `y: 16`), not a `w: 6, h: 5` row slice. `fit`'s row height is
        // `sheetHeight / grid.rows` — a fixed, viewport-independent quantum — so this tile's
        // OWN pixel height only grows with its `h`, never with a narrower row slice; `h: 5`
        // left its `CommandList` (~136px of content, 4 regions) taller than the space left
        // after the tile's header/search chrome at both 1440 and 390, overflowing with no
        // keyboard-reachable scroll container (axe `scrollable-region-focusable`). `h: 12`
        // clears that at both widths (see `dashboard.tsx`'s measured comment at the bottom of
        // this file's history — verified: 1440 tile height ~430px, 390 ~248px, both above the
        // ~237.5px the chrome + list need).
        title: "Region",
        layout: { x: 18, y: 4, w: 6, h: 12 },
        content: {
          field: "region",
          label: "Region",
          values: REGIONS.map((region) => ({ value: region, label: region })),
        },
      },
      {
        id: "table-movers",
        kind: "table",
        title: "Accounts with the largest MRR change",
        layout: { x: 0, y: 11, w: 18, h: 5 },
        // Visible only once a region is selected in the filter tile above — the sheet's
        // interaction graph made visible (RM-097's Change).
        visibleWhen: "selection.count('region') > 0",
        content: {
          field: "region",
          columns: [
            { id: "account", header: "Account" },
            { id: "region", header: "Region" },
            { id: "mrrChange", header: "MRR change" },
          ],
          rows: CHURN_MOVERS.map((mover) => ({
            account: mover.account,
            region: mover.region,
            mrrChange: `${mover.mrrChange >= 0 ? "+" : ""}${usd.format(mover.mrrChange)}`,
          })),
        },
      },
    ],
  };
}

function DashboardChrome({ initialSpec }: { initialSpec: DashboardSpec }) {
  const spec = useDashboard((s) => s.spec);
  const actions = useDashboardActions();

  // Test hook (RM-097 acceptance): mirrors the live spec so a browser check can quote
  // `layout.x`/`layout.w` after a drag or a keyboard resize, without reaching into the
  // store's zustand internals directly.
  useEffect(() => {
    window.__tourDashboardSpec = spec;
    return () => {
      delete window.__tourDashboardSpec;
    };
  }, [spec]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-1">
        <DashboardToolbar className="border-b-0 px-1" />
        <Button variant="ghost" size="sm" onClick={() => actions.setSpec(initialSpec)}>
          {dashboardSurfaceCopy.reset}
        </Button>
      </div>
      {/* `tabIndex={0}`: a scrollable region needs its own keyboard stop (axe
       * `scrollable-region-focusable`) — the sheet itself already has a `region` role/name via
       * `DashboardSheet`, so this wrapper takes no `aria-label` of its own. */}
      <div className="min-h-0 flex-1 overflow-auto p-2" tabIndex={0}>
        <DashboardSheet renderAll />
      </div>
    </div>
  );
}

export function DashboardSurface() {
  const [initialSpec] = useState(buildSpec);
  return (
    <div className="size-full" aria-label={tourCopy.tabs.dashboard.label}>
      {/* No `mode` prop: the sheet opens in `view` (the provider's own default) and the
       * toolbar's view/edit switch is how a visitor turns editing on, matching the RM's
       * "switch to edit mode, drag a tile" acceptance step. */}
      <DashboardProvider spec={initialSpec} tiles={TILES}>
        {/* Tile chrome titles render as `h3` — this sr-only `h2` keeps heading order
         * (tour section h2 -> sheet h2? no — tour has no page h1 of its own here) intact
         * without adding visible chrome, mirroring `dashboard-sheet-app`'s own pattern. */}
        <h2 className="sr-only">{initialSpec.title}</h2>
        <DashboardChrome initialSpec={initialSpec} />
      </DashboardProvider>
    </div>
  );
}
