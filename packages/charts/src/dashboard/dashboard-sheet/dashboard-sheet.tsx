"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
} from "react";
import useMeasure from "react-use-measure";
import { Tabs, TabsContent, TabsList, TabsTrigger, cn } from "@elabs-ai/components-ui";

import { compileCondition, type Condition } from "../core/expression";
import {
  DEFAULT_GRID_COLUMNS,
  DEFAULT_GRID_GAP,
  DEFAULT_GRID_ROWS,
  DEFAULT_ROW_HEIGHT,
  cellRect,
} from "../core/layout";
import type { ContainerSpec, GridSpec, TileLayout, TileSpec } from "../core/spec";
import type { DashboardState } from "../core/store";
import { DashboardTile } from "./dashboard-tile";
import type { DashboardTileMenuItem } from "./dashboard-tile-menu";
import { DashboardSheetContext, type DashboardSheetContextValue } from "./sheet-context";
import { DashboardGridContext, useCellRect } from "./use-cell-rect";
import { useDashboard, useDashboardActions, useDashboardContext } from "./use-dashboard";

/** More tiles than this on one sheet logs a dev-only warning (charts' max-6-per-page, widened). */
export const DASHBOARD_TILE_WARNING_THRESHOLD = 12;

export interface DashboardSheetProps extends HTMLAttributes<HTMLDivElement> {
  /** Mount every tile body immediately (export, print). Default: bodies mount near the viewport. */
  renderAll?: boolean;
  /** Tile header, hover toolbar and menu. `false` renders bare bodies. Default `true`. */
  chrome?: boolean;
  /** Extra kebab-menu entries per tile. */
  menuItems?: (tile: TileSpec) => DashboardTileMenuItem[];
}

type Cell = Pick<TileLayout, "x" | "y" | "w" | "h">;

const conditionCache = new Map<string, Condition | null>();
function conditionFor(src: string): Condition | null {
  if (!conditionCache.has(src)) {
    try {
      conditionCache.set(src, compileCondition(src));
    } catch (error) {
      // View mode never throws: an unparseable condition leaves the tile visible.
      if (process.env.NODE_ENV !== "production") console.warn("[DashboardSheet]", error);
      conditionCache.set(src, null);
    }
  }
  return conditionCache.get(src) ?? null;
}

/** Ids of the tiles whose `visibleWhen` holds, as a JSON string (a stable selector result). */
function visibleTileIds(state: DashboardState): string {
  const ctx = { variables: state.variables, selection: state.selection, mode: state.mode };
  return JSON.stringify(
    state.spec.tiles
      .filter((tile) => {
        if (!tile.visibleWhen) return true;
        const condition = conditionFor(tile.visibleWhen);
        return condition ? condition(ctx) : true;
      })
      .map((tile) => tile.id),
  );
}

/** Pixel height of a grid `width` wide: square cells in `fit`, the lowest tile's bottom in `flow`. */
function gridHeight(grid: GridSpec, width: number, cells: Cell[]): number {
  const gap = grid.gap ?? DEFAULT_GRID_GAP;
  if (grid.mode === "fit") {
    const columns = grid.columns || DEFAULT_GRID_COLUMNS;
    const rows = grid.rows ?? DEFAULT_GRID_ROWS;
    const cell = (width - (columns - 1) * gap) / columns;
    return Math.max(0, rows * cell + (rows - 1) * gap);
  }
  let bottom = 0;
  for (const cell of cells)
    bottom = Math.max(bottom, cellRect(cell, grid, { width, height: 0 }).bottom);
  return bottom;
}

function findScrollRoot(el: Element): Element | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") return node;
  }
  return null;
}

type SheetItem =
  | { type: "tile"; id: string; layout: Cell }
  | { type: "container"; id: string; layout: Cell; container: ContainerSpec };

/**
 * Draws the provider's spec: every visible tile at its `cellRect` (absolute transforms, so
 * cells stay addressable for the edit layer), containers as tabs over an inner grid, one
 * roving tab stop across tiles (arrow keys, Home, End — reading order), lazy tile bodies.
 *
 * Height: `fit` keeps square cells (`rows × cell`), so an `extendable` sheet that gained rows
 * grows and the page scrolls; `flow` is the lowest bottom (`y + h` rows × `rowHeight` plus gaps).
 */
export const DashboardSheet = forwardRef<HTMLDivElement, DashboardSheetProps>(
  function DashboardSheet(
    { renderAll = false, chrome = true, menuItems, className, style, onKeyDown, ...props },
    forwardedRef,
  ) {
    const { labels } = useDashboardContext();
    const spec = useDashboard((s) => s.spec);
    const visibleKey = useDashboard(visibleTileIds);
    const [measureRef, bounds] = useMeasure();
    const rootRef = useRef<HTMLDivElement | null>(null);
    const setRef = useCallback(
      (node: HTMLDivElement | null) => {
        rootRef.current = node;
        measureRef(node);
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef, measureRef],
    );

    const visible = useMemo(() => new Set<string>(JSON.parse(visibleKey)), [visibleKey]);
    const items = useMemo<SheetItem[]>(() => {
      const list: SheetItem[] = [
        ...spec.tiles
          .filter((t) => !t.container && visible.has(t.id))
          .map((t) => ({ type: "tile" as const, id: t.id, layout: t.layout })),
        ...(spec.containers ?? []).map((c) => ({
          type: "container" as const,
          id: c.id,
          layout: c.layout,
          container: c,
        })),
      ];
      return list.sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x);
    }, [spec, visible]);

    const width = bounds.width;
    const height = gridHeight(
      spec.grid,
      width,
      [...spec.tiles.filter((t) => !t.container), ...(spec.containers ?? [])].map((t) => t.layout),
    );

    useEffect(() => {
      if (
        process.env.NODE_ENV !== "production" &&
        spec.tiles.length > DASHBOARD_TILE_WARNING_THRESHOLD
      )
        console.warn(
          `[DashboardSheet] “${spec.id}” has ${spec.tiles.length} tiles; more than ${DASHBOARD_TILE_WARNING_THRESHOLD} on one sheet is hard to read.`,
        );
    }, [spec.id, spec.tiles.length]);

    // One IntersectionObserver per sheet, rooted at the nearest scroller, one viewport of margin.
    const measured = width > 0;
    const [observe, setObserve] = useState<DashboardSheetContextValue["observe"]>(null);
    const [observerReady, setObserverReady] = useState(false);
    useEffect(() => {
      const el = rootRef.current;
      if (renderAll || !measured || !el || typeof IntersectionObserver === "undefined") {
        setObserverReady(true);
        return;
      }
      const callbacks = new Map<Element, () => void>();
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            callbacks.get(entry.target)?.();
            callbacks.delete(entry.target);
            observer.unobserve(entry.target);
          }
        },
        { root: findScrollRoot(el), rootMargin: "100% 0px 100% 0px" },
      );
      setObserve(() => (target: Element, onVisible: () => void) => {
        callbacks.set(target, onVisible);
        observer.observe(target);
        return () => {
          callbacks.delete(target);
          observer.unobserve(target);
        };
      });
      setObserverReady(true);
      return () => {
        observer.disconnect();
        setObserve(null);
      };
    }, [renderAll, measured]);

    const [activeTileId, setActiveTileId] = useState<string | null>(null);
    const firstTileId = items.find((i) => i.type === "tile")?.id ?? null;
    const resolvedActive = activeTileId && visible.has(activeTileId) ? activeTileId : firstTileId;

    const onSheetKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      const target = event.target as HTMLElement;
      if (event.defaultPrevented || target.dataset.slot !== "dashboard-tile") return;
      const tiles = Array.from(
        rootRef.current?.querySelectorAll<HTMLElement>("[data-slot=dashboard-tile]") ?? [],
      );
      const at = tiles.indexOf(target);
      let next = -1;
      if (event.key === "ArrowRight" || event.key === "ArrowDown")
        next = Math.min(tiles.length - 1, at + 1);
      else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = Math.max(0, at - 1);
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tiles.length - 1;
      if (next < 0) return;
      event.preventDefault();
      tiles[next]?.focus();
    };

    const hasObserver = typeof IntersectionObserver !== "undefined";
    const sheetContext = useMemo<DashboardSheetContextValue>(
      () => ({
        // Without IntersectionObserver (old browsers, jsdom) every body mounts.
        observe: hasObserver ? observe : null,
        renderAll: renderAll || !hasObserver,
        chrome,
        activeTileId: resolvedActive,
        setActiveTileId,
        menuItems,
      }),
      [hasObserver, observe, renderAll, chrome, resolvedActive, menuItems],
    );
    const gridContext = useMemo(
      () => ({ grid: spec.grid, width, height }),
      [spec.grid, width, height],
    );

    return (
      <div
        ref={setRef}
        role="region"
        aria-label={spec.title ?? labels.sheet}
        data-slot="dashboard-sheet"
        data-grid-mode={spec.grid.mode}
        className={cn("relative w-full", className)}
        style={{ height, ...style }}
        onKeyDown={onSheetKeyDown}
        {...props}
      >
        <DashboardSheetContext.Provider value={sheetContext}>
          <DashboardGridContext.Provider value={gridContext}>
            {measured && observerReady
              ? items.map((item) =>
                  item.type === "tile" ? (
                    <DashboardTile key={item.id} tileId={item.id} />
                  ) : (
                    <DashboardSheetContainer
                      key={item.id}
                      container={item.container}
                      visible={visible}
                    />
                  ),
                )
              : null}
          </DashboardGridContext.Provider>
        </DashboardSheetContext.Provider>
      </div>
    );
  },
);

/** A `tabs`/`stack` container: its own inner grid, `layout.w` columns wide, the outer row height. */
function DashboardSheetContainer({
  container,
  visible,
}: {
  container: ContainerSpec;
  visible: Set<string>;
}) {
  const actions = useDashboardActions();
  const tiles = useDashboard((s) => s.spec.tiles);
  const gap = useDashboard((s) => s.spec.grid.gap ?? DEFAULT_GRID_GAP);
  const flowRowHeight = useDashboard((s) => s.spec.grid.rowHeight ?? DEFAULT_ROW_HEIGHT);
  const tab = useDashboard((s) => s.tileState[container.id]?.tab as string | undefined);
  const rect = useCellRect(container.layout);
  const unit = useCellRect({ x: 0, y: 0, w: 1, h: 1 });
  const [bodyRef, body] = useMeasure();

  const children = container.children
    .map((id) => tiles.find((t) => t.id === id))
    .filter((t): t is TileSpec => Boolean(t && visible.has(t.id)));
  const slotOf = (t: TileSpec) => t.container?.slot ?? t.id;
  const slots = [...new Set(children.map(slotOf))];
  const innerGrid: GridSpec = {
    mode: "flow",
    columns: container.layout.w,
    rowHeight: unit?.height ?? flowRowHeight,
    gap,
  };
  const renderGrid = (members: TileSpec[]) => {
    const h = gridHeight(
      innerGrid,
      body.width,
      members.map((t) => t.layout),
    );
    return (
      <DashboardGridContext.Provider value={{ grid: innerGrid, width: body.width, height: h }}>
        <div
          data-slot="dashboard-sheet-container-grid"
          className="relative w-full"
          style={{ height: h }}
        >
          {body.width > 0 ? members.map((t) => <DashboardTile key={t.id} tileId={t.id} />) : null}
        </div>
      </DashboardGridContext.Provider>
    );
  };
  const active = tab && slots.includes(tab) ? tab : slots[0];

  return (
    <div
      role="group"
      aria-label={container.title}
      data-slot="dashboard-sheet-container"
      data-container-id={container.id}
      data-container-kind={container.kind}
      className="absolute flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card p-2 shadow-xs transition-[transform,width,height] duration-base ease-standard motion-reduce:transition-none"
      style={{
        left: 0,
        top: 0,
        width: rect?.width ?? 0,
        height: rect?.height ?? 0,
        transform: rect ? `translate(${rect.x}px, ${rect.y}px)` : undefined,
      }}
    >
      {container.kind === "tabs" && active !== undefined ? (
        <Tabs
          value={active}
          onValueChange={(value) => actions.setTileState(container.id, { tab: value })}
          className="flex min-h-0 flex-1 flex-col gap-2"
        >
          <TabsList aria-label={container.title}>
            {slots.map((slot) => (
              <TabsTrigger key={slot} value={slot}>
                {children.find((t) => slotOf(t) === slot)?.container?.slot ??
                  children.find((t) => slotOf(t) === slot)?.title ??
                  slot}
              </TabsTrigger>
            ))}
          </TabsList>
          <div ref={bodyRef} className="min-h-0 flex-1 overflow-auto">
            {slots.map((slot) => (
              <TabsContent key={slot} value={slot} className="mt-0">
                {renderGrid(children.filter((t) => slotOf(t) === slot))}
              </TabsContent>
            ))}
          </div>
        </Tabs>
      ) : (
        <div ref={bodyRef} className="min-h-0 flex-1 overflow-auto">
          {renderGrid(children)}
        </div>
      )}
    </div>
  );
}
