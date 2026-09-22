"use client";

/**
 * `DashboardWorkbook` (RM-087, analysis §2.0, §7) — a multi-sheet container: the asset
 * panel's "Sheets" list (RM-080), a drill's `sheetId` (RM-082) and a bookmark's `sheetId`
 * (RM-083) all assumed one of these; nothing built it until now. One store per sheet
 * (`useWorkbook`), created directly and kept alive for the workbook's lifetime so edits
 * survive switching away and back; only the ACTIVE sheet's `DashboardSheet` is shown (the
 * others stay mounted, `hidden`, so their store instances are not torn down).
 */
import { forwardRef, useEffect, useMemo, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@elabs-ai/components-ui";

import type { DashboardSpec } from "../core/spec";
import type { DashboardStore } from "../core/store";
import { DEFAULT_DASHBOARD_LABELS, type DashboardLabels } from "../dashboard-sheet/labels";
import { DashboardSheet, type DashboardSheetProps } from "../dashboard-sheet/dashboard-sheet";
import {
  createTileRegistry,
  type DashboardTileKinds,
  type TileRegistry,
} from "../dashboard-sheet/tile-registry";
import { DashboardContext, type DashboardContextValue } from "../dashboard-sheet/use-dashboard";
import { useWorkbook } from "./use-workbook";
import { DEFAULT_WORKBOOK_NAV_LABELS, WorkbookNav, type WorkbookNavLabels } from "./workbook-nav";
import type { WorkbookSpec } from "../core/spec";

const isRegistry = (tiles: DashboardTileKinds | TileRegistry): tiles is TileRegistry =>
  !Array.isArray(tiles) && typeof (tiles as TileRegistry).get === "function";

/** Runs a sheet's `actions` (the `button` tile's own action vocabulary, opening the sheet
 * instead of a click) in order — `navigate`/`host` route through the workbook's callbacks;
 * `applyBookmark`/`clearSelections`/`setVariable` go straight to the sheet's own store. */
function runSheetActions(
  sheet: DashboardSpec,
  store: DashboardStore,
  handlers: { onNavigate: (sheetId: string) => void; onAction?: (id: string) => void },
): void {
  if (!sheet.actions?.length) return;
  const { actions } = store.getState();
  for (const action of sheet.actions) {
    switch (action.type) {
      case "navigate":
        handlers.onNavigate(action.sheetId);
        break;
      case "applyBookmark":
        actions.applyBookmark(action.id);
        break;
      case "clearSelections":
        actions.clearSelection();
        break;
      case "setVariable":
        actions.setVariable(action.name, action.value);
        break;
      case "host":
        handlers.onAction?.(action.id);
        break;
      default:
        break;
    }
  }
}

interface WorkbookSheetViewProps {
  sheet: DashboardSpec;
  store: DashboardStore;
  registry: TileRegistry;
  labels: DashboardLabels;
  active: boolean;
  onNavigate: (sheetId: string) => void;
  onRefresh?: (tileId: string) => void;
  onAction?: (id: string) => void;
  host?: Record<string, unknown>;
  chrome: boolean;
  menuItems?: DashboardSheetProps["menuItems"];
}

/** One sheet's context + `DashboardSheet`, kept mounted (`hidden` when not active) so its
 * store's edits and undo history survive switching away. */
function WorkbookSheetView({
  sheet,
  store,
  registry,
  labels,
  active,
  onNavigate,
  onRefresh,
  onAction,
  host,
  chrome,
  menuItems,
}: WorkbookSheetViewProps) {
  const value = useMemo<DashboardContextValue>(
    () => ({ store, registry, labels, onNavigate, onRefresh, onAction, host }),
    [store, registry, labels, onNavigate, onRefresh, onAction, host],
  );

  // Sheet actions run once per activation (Change: "sheet actions run on activation") — never
  // while the sheet sits inactive in the background.
  useEffect(() => {
    if (active) runSheetActions(sheet, store, { onNavigate, onAction });
    // Deliberately keyed on activation, not on every `sheet`/`store` identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <DashboardContext.Provider value={value}>
      <div hidden={!active} data-slot="dashboard-workbook-sheet" className="h-full min-h-0">
        <DashboardSheet chrome={chrome} menuItems={menuItems} />
      </div>
    </DashboardContext.Provider>
  );
}

export interface DashboardWorkbookProps extends HTMLAttributes<HTMLDivElement> {
  workbook: WorkbookSpec;
  /** Tile kinds every sheet renders with (a list, a `kind → definition` map, or a
   * `createTileRegistry` result) — shared across every sheet, same as `DashboardProvider`. */
  tiles: DashboardTileKinds | TileRegistry;
  /** Controlled active sheet id. */
  activeSheetId?: string;
  /** Uncontrolled initial active sheet id. Default: the first visible sheet. */
  defaultActiveSheetId?: string;
  onActiveSheetChange?: (sheetId: string) => void;
  /** A tile asks for fresh data; the host fetches (D5). Forwarded to every sheet. */
  onRefresh?: (tileId: string) => void;
  /** A `{ type: "host" }` action, from a sheet's own `actions` or a `button` tile. */
  onAction?: (id: string) => void;
  /** Opaque host-supplied values a tile kind may read through context (RM-085). */
  host?: Record<string, unknown>;
  /** Strings for every sheet's chrome; missing keys fall back to English. */
  labels?: Partial<DashboardLabels>;
  /** Strings for `WorkbookNav`. */
  navLabels?: Partial<WorkbookNavLabels>;
  /** Forwarded to every sheet's `DashboardSheet`. Default `true`. */
  chrome?: boolean;
  menuItems?: DashboardSheetProps["menuItems"];
  /** Rendered above the nav (a title, a share button) — the workbook itself stays thin. */
  toolbar?: ReactNode;
}

/**
 * A multi-sheet workbook: `WorkbookNav` picks the active sheet (a `showCondition: false`
 * sheet is absent from it, analysis §2.0); a drill's `onNavigate(sheetId, { carry })`
 * switches sheets and applies the carried selection there (RM-082's documented hook,
 * `applyCarriedSelection`); a `sheetId`-bearing bookmark switches first, then applies. Only
 * the active sheet's `DashboardSheet` is shown — every visited one stays mounted (`hidden`)
 * so edits and undo history survive switching away and back.
 */
export const DashboardWorkbook = forwardRef<HTMLDivElement, DashboardWorkbookProps>(
  function DashboardWorkbook(
    {
      workbook,
      tiles,
      activeSheetId,
      defaultActiveSheetId,
      onActiveSheetChange,
      onRefresh,
      onAction,
      host,
      labels,
      navLabels,
      chrome = true,
      menuItems,
      toolbar,
      className,
      ...props
    },
    forwardedRef,
  ) {
    const wb = useWorkbook({ workbook, activeSheetId, defaultActiveSheetId, onActiveSheetChange });
    const registry = useMemo(
      () => (isRegistry(tiles) ? tiles : createTileRegistry(tiles)),
      [tiles],
    );
    const mergedLabels = useMemo(() => ({ ...DEFAULT_DASHBOARD_LABELS, ...labels }), [labels]);

    // The active sheet's store exists before first paint — every OTHER sheet's store is
    // created lazily, the first time it becomes active or a drill/bookmark targets it.
    wb.getStore(wb.activeSheetId);

    return (
      <div
        ref={forwardedRef}
        data-slot="dashboard-workbook"
        className={cn("flex h-full min-h-0 flex-col", className)}
        {...props}
      >
        {toolbar}
        <WorkbookNav
          sheets={wb.visibleSheets}
          activeSheetId={wb.activeSheetId}
          onActiveSheetChange={wb.setActiveSheetId}
          labels={{ ...DEFAULT_WORKBOOK_NAV_LABELS, ...navLabels }}
          switchSignal={wb.programmaticSwitch}
        />
        <div className="min-h-0 flex-1">
          {wb.visitedSheetIds.map((sheetId) => {
            const sheet = workbook.sheets.find((candidate) => candidate.id === sheetId);
            if (!sheet) return null;
            return (
              <WorkbookSheetView
                key={sheetId}
                sheet={sheet}
                store={wb.getStore(sheetId)}
                registry={registry}
                labels={mergedLabels}
                active={sheetId === wb.activeSheetId}
                onNavigate={wb.onNavigate}
                onRefresh={onRefresh}
                onAction={onAction}
                host={host}
                chrome={chrome}
                menuItems={menuItems}
              />
            );
          })}
        </div>
      </div>
    );
  },
);
