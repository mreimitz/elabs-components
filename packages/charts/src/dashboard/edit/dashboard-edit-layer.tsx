"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  AlignHorizontalDistributeCenter,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignVerticalDistributeCenter,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Ban,
  type LucideIcon,
} from "lucide-react";
import { Toolbar, ToolbarButton, ToolbarSeparator, cn, useLocale } from "@elabs-ai/components-ui";
import { useReducedMotion } from "@elabs-ai/components-tokens";

import { CHART_HAIRLINE_WIDTH } from "../../chart-hairline";
import { cellRect, collides, correctBounds } from "../core/layout";
import type { GridSpec, TileLayout } from "../core/spec";
import { TILE_CHROME_Z } from "../dashboard-sheet/dashboard-tile";
import {
  useDashboard,
  useDashboardActions,
  useDashboardContext,
} from "../dashboard-sheet/use-dashboard";
import { SILENT_ANNOUNCEMENTS, editMessages, type ResizeHandle } from "./announcer";
import type { AlignEdge } from "./align";
import { dashboardAutoScroll } from "./auto-scroll";
import { createCellCoordinateGetter, type CellPitch } from "./cell-coordinate-getter";
import {
  DashboardEditContext,
  type DashboardEditContextValue,
  type DashboardEditSession,
} from "./edit-context";
import {
  applyLayout,
  cellDelta,
  editStrategy,
  previewPlacement,
  resizeFrom,
  topLevelLayout,
} from "./geometry";
import { DashboardMarquee, useDashboardMarquee } from "./marquee";

/** What a draggable carries in `data.current`. */
export interface DashboardEditDragData {
  type: "move" | "resize";
  tileId: string;
  handle?: ResizeHandle;
}

export interface DashboardEditLayerProps {
  /** The sheet element; flagged `data-edit-active` while a gesture runs. */
  sheetRef: RefObject<HTMLElement | null>;
  /** The sheet grid and its measured pixel size. */
  grid: GridSpec;
  width: number;
  height: number;
  children: ReactNode;
}

function pitchOf(grid: GridSpec, width: number, height: number): CellPitch | null {
  if (width <= 0) return null;
  const size = { width, height };
  const a = cellRect({ x: 0, y: 0, w: 1, h: 1 }, grid, size);
  const b = cellRect({ x: 1, y: 1, w: 1, h: 1 }, grid, size);
  return { width: b.x - a.x, height: b.y - a.y };
}

const NO_BREAK_SPACE = String.fromCharCode(0xa0);

// External drops — RM-080
/**
 * A sheet's drop target for drags that start OUTSIDE its `DndContext` (the asset panel runs its
 * own). `cellAt` maps a viewport point to the grid cell under it, or `null` off the sheet.
 */
export interface DashboardExternalDropTarget {
  cellAt(point: { x: number; y: number }): { x: number; y: number } | null;
}
const externalDropTargets = new WeakMap<object, DashboardExternalDropTarget>();
/** The edit-mode sheet's external drop target for a store, while one is mounted. */
export function getDashboardDropTarget(store: object): DashboardExternalDropTarget | undefined {
  return externalDropTargets.get(store);
}

const sameCells = (a: TileLayout, b: TileLayout) =>
  a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

// tile operations — RM-081 follow-up 1: dragging one tile of a multi-selection moves the
// whole group. Every id in `groupIds` shifts by the SAME whole-cell delta, so members never
// collide with each other (their relative positions never change, and they did not collide to
// begin with) — the only rejection is a member landing out of the grid or on a tile OUTSIDE
// the group. The preview this returns doubles as the commit payload (`applyLayout`), so what
// previews is exactly what lands.
function shiftGroup(
  scope: readonly TileLayout[],
  groupIds: readonly string[],
  dx: number,
  dy: number,
  grid: GridSpec,
): { layout: TileLayout[]; ok: boolean } {
  const groupSet = new Set(groupIds);
  const original = scope.map((item) => ({ ...item }));
  const moved = scope.map((item) =>
    groupSet.has(item.id) ? { ...item, x: item.x + dx, y: item.y + dy } : item,
  );
  const bounded = correctBounds(moved, grid);
  const outOfBounds = bounded.some((item, index) => {
    const wanted = moved[index];
    return groupSet.has(item.id) && wanted && (item.x !== wanted.x || item.y !== wanted.y);
  });
  if (outOfBounds) return { layout: original, ok: false };
  const inside = bounded.filter((item) => groupSet.has(item.id));
  const outside = bounded.filter((item) => !groupSet.has(item.id));
  const ok = inside.every((item) => !outside.some((other) => collides(item, other)));
  return { layout: ok ? bounded : original, ok };
}

/**
 * The dashboard edit layer (RM-078): dnd-kit sensors (pointer with a 3 px activation distance,
 * touch with a 150 ms long-press, keyboard stepping whole cells) over the sheet. While a move or
 * resize runs it paints the would-be layout from the RM-070 engine and a dashed ghost at the
 * snapped cells; the drop commits ONE history step through the store; Escape restores. Every
 * announcement goes to one polite live region per sheet.
 */
export function DashboardEditLayer({
  sheetRef,
  grid,
  width,
  height,
  children,
}: DashboardEditLayerProps) {
  const { store, labels } = useDashboardContext();
  const actions = useDashboardActions();
  const { t } = useLocale();
  const messages = useMemo(() => editMessages(t), [t]);
  const reducedMotion = useReducedMotion();
  const pitch = useMemo(() => pitchOf(grid, width, height), [grid, width, height]);
  const pitchRef = useRef(pitch);
  pitchRef.current = pitch;
  // tile operations — RM-081 follow-up 1: built-in marquee (empty-area drag-select) and the
  // floating align toolbar both need the live top-level layout and selection.
  const spec = useDashboard((s) => s.spec);
  const focus = useDashboard((s) => s.focus);

  // External drops — RM-080: expose the hit cell for drags from outside this DndContext.
  useEffect(() => {
    const target: DashboardExternalDropTarget = {
      cellAt({ x, y }) {
        const el = sheetRef.current;
        const size = pitchRef.current;
        if (!el || !size) return null;
        const box = el.getBoundingClientRect();
        if (x < box.left || x > box.right || y < box.top || y > box.bottom) return null;
        const g = store.getState().spec.grid;
        const col = Math.min(g.columns - 1, Math.max(0, Math.floor((x - box.left) / size.width)));
        const row = Math.max(0, Math.floor((y - box.top) / size.height));
        return { x: col, y: g.mode === "fit" ? Math.min((g.rows ?? 12) - 1, row) : row };
      },
    };
    externalDropTargets.set(store, target);
    return () => {
      if (externalDropTargets.get(store) === target) externalDropTargets.delete(store);
    };
  }, [store, sheetRef]);

  const [session, setSessionState] = useState<DashboardEditSession | null>(null);
  const sessionRef = useRef<DashboardEditSession | null>(null);
  const setSession = useCallback((next: DashboardEditSession | null) => {
    sessionRef.current = next;
    setSessionState(next);
  }, []);
  // tile operations — RM-081 follow-up 1: the focused ids a group drag moves together, or
  // `null` for an ordinary single-tile drag. Set at `start`, read by `retarget`/`commit`.
  const groupRef = useRef<string[] | null>(null);

  // A repeated message still re-announces: alternate a trailing no-break space.
  const [announcement, setAnnouncement] = useState("");
  const announce = useCallback((message: string) => {
    setAnnouncement((previous) => (previous === message ? `${message}${NO_BREAK_SPACE}` : message));
  }, []);

  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    if (session) el.setAttribute("data-edit-active", session.kind);
    else el.removeAttribute("data-edit-active");
    return () => el.removeAttribute("data-edit-active");
  }, [sheetRef, session]);

  const titleOf = useCallback(
    (id: string) => {
      const tile = store.getState().spec.tiles.find((item) => item.id === id);
      return tile?.title || labels.untitledTile(tile?.kind ?? "");
    },
    [store, labels],
  );

  const start = useCallback(
    (data: DashboardEditDragData): DashboardEditSession | null => {
      const spec = store.getState().spec;
      const tile = spec.tiles.find((item) => item.id === data.tileId);
      if (!tile || tile.container) return null;
      const origin = { ...tile.layout, id: tile.id };
      // tile operations — RM-081 follow-up 1: dragging a tile that is already part of a
      // multi-selection (`focus`) moves the whole group; dragging any other tile starts a
      // fresh single-tile selection, same as before.
      const focus = store.getState().focus;
      const group =
        data.type === "move" && focus.includes(tile.id) && focus.length > 1 ? [...focus] : null;
      groupRef.current = group;
      const next: DashboardEditSession = {
        kind: data.type,
        tileId: tile.id,
        handle: data.handle,
        origin,
        target: origin,
        delta: { dx: 0, dy: 0 },
        layout: topLevelLayout(spec),
        ok: true,
      };
      setSession(next);
      if (!group) actions.setFocus([tile.id]);
      return next;
    },
    [store, actions, setSession],
  );

  /** Re-target the running session by a whole-cell offset from its origin. */
  const retarget = useCallback(
    (current: DashboardEditSession, dx: number, dy: number) => {
      if (current.delta.dx === dx && current.delta.dy === dy) return;
      const spec = store.getState().spec;
      const group = groupRef.current;
      if (current.kind === "move" && group) {
        // tile operations — RM-081 follow-up 1: group drag preview — every selected id
        // shifts together; `shiftGroup` is the one collision check for the whole set.
        const { layout, ok } = shiftGroup(topLevelLayout(spec), group, dx, dy, spec.grid);
        const target = layout.find((item) => item.id === current.tileId) ?? current.origin;
        const moved = !sameCells(target, current.target);
        setSession({ ...current, target, delta: { dx, dy }, layout, ok });
        if (!moved) return;
        const said = messages.moved(target);
        announce(ok ? said : `${said}. ${messages.rejected}`);
        return;
      }
      const raw =
        current.kind === "move"
          ? { ...current.origin, x: current.origin.x + dx, y: current.origin.y + dy }
          : resizeFrom(current.origin, current.handle ?? "se", dx, dy, spec.grid);
      const target = correctBounds([raw], spec.grid)[0] ?? current.origin;
      const moved = !sameCells(target, current.target);
      const { layout, ok } = previewPlacement(spec, target);
      setSession({ ...current, target, delta: { dx, dy }, layout, ok });
      if (!moved) return;
      const title = titleOf(current.tileId);
      const said =
        current.kind === "move" ? messages.moved(target) : messages.resizing(title, target);
      announce(ok ? said : `${said}. ${messages.rejected}`);
    },
    [store, setSession, titleOf, messages, announce],
  );

  const commit = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return;
    setSession(null);
    const group = groupRef.current;
    groupRef.current = null;
    const title = titleOf(current.tileId);
    if (!current.ok) {
      announce(messages.rejected);
      return;
    }
    const { target, origin, tileId } = current;
    if (!sameCells(target, origin)) {
      if (current.kind === "move" && group) {
        // tile operations — RM-081 follow-up 1: `current.layout` is already the whole
        // group's shifted, collision-checked top-level layout (`shiftGroup`, above) — write
        // it straight back as ONE history entry, the same primitive a single move's
        // `applyLayout` call uses below.
        actions.setSpec(applyLayout(store.getState().spec, current.layout));
      } else {
        const strategy = editStrategy(store.getState().spec.grid);
        // One undo step for the whole gesture: the store action, then the engine's would-be layout
        // (flow compaction, a west/north resize) when the action alone does not produce it.
        actions.batch(() => {
          if (current.kind === "move")
            actions.moveTile(tileId, { x: target.x, y: target.y }, { strategy });
          else if (target.x === origin.x && target.y === origin.y)
            actions.resizeTile(tileId, { w: target.w, h: target.h }, { strategy });
          actions.setSpec(applyLayout(store.getState().spec, current.layout));
        });
      }
    }
    const placed = store.getState().spec.tiles.find((tile) => tile.id === tileId)?.layout ?? target;
    announce(
      current.kind === "move" ? messages.dropped(title, placed) : messages.resized(title, placed),
    );
  }, [actions, store, setSession, titleOf, messages, announce]);

  const cancel = useCallback(() => {
    if (!sessionRef.current) return;
    setSession(null);
    groupRef.current = null;
    announce(messages.cancelled);
  }, [setSession, announce, messages]);

  const resizeBy = useCallback(
    (tileId: string, handle: ResizeHandle, dx: number, dy: number) => {
      let current = sessionRef.current;
      if (!current || current.tileId !== tileId || current.handle !== handle) {
        current = start({ type: "resize", tileId, handle });
        if (!current) return;
        announce(messages.resizing(titleOf(tileId), current.origin));
      }
      retarget(current, current.delta.dx + dx, current.delta.dy + dy);
    },
    [start, retarget, announce, messages, titleOf],
  );

  const coordinateGetter = useMemo(() => createCellCoordinateGetter(() => pitchRef.current), []);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter }),
  );

  const onDragStart = ({ active }: DragStartEvent) => {
    const data = active.data.current as DashboardEditDragData | undefined;
    if (!data) return;
    const next = start(data);
    if (!next) return;
    const title = titleOf(next.tileId);
    announce(
      next.kind === "move"
        ? messages.pickedUp(title, next.origin)
        : messages.resizing(title, next.origin),
    );
  };
  const onDragMove = ({ delta }: DragMoveEvent) => {
    const current = sessionRef.current;
    const size = pitchRef.current;
    if (!current || !size) return;
    const { dx, dy } = cellDelta(delta, size);
    retarget(current, dx, dy);
  };
  const onDragEnd = (_event: DragEndEvent) => commit();

  const context = useMemo<DashboardEditContextValue>(
    () => ({ session, messages, pitch, reducedMotion, resizeBy, commit, cancel }),
    [session, messages, pitch, reducedMotion, resizeBy, commit, cancel],
  );

  const ghost = session && width > 0 ? cellRect(session.target, grid, { width, height }) : null;

  // tile operations — RM-081 follow-up 1: built-in marquee — empty-area pointer drag selects
  // every top-level tile/container the rectangle intersects; Shift is additive; Escape cancels
  // (`useDashboardMarquee`'s own listeners). No host composition required: `DashboardSheet` +
  // edit mode is enough.
  const topLevel = useMemo(() => topLevelLayout(spec), [spec]);
  const marquee = useDashboardMarquee({
    sheetRef,
    grid,
    size: { width, height },
    layout: topLevel,
    enabled: !session,
    onSelect: (ids, additive) => {
      const current = store.getState().focus;
      actions.setFocus(additive ? [...new Set([...current, ...ids])] : ids);
    },
  });

  // tile operations — RM-081 follow-up 1: the floating align/distribute toolbar over a
  // multi-selection (≥ 2 top-level tiles), hidden while a drag/resize gesture runs.
  const selectionRect =
    !session && width > 0 && focus.length >= 2
      ? (() => {
          const cells = topLevel.filter((item) => focus.includes(item.id));
          if (cells.length < 2) return null;
          const rects = cells.map((cell) => cellRect(cell, grid, { width, height }));
          return {
            left: Math.min(...rects.map((r) => r.left)),
            top: Math.min(...rects.map((r) => r.top)),
            right: Math.max(...rects.map((r) => r.right)),
          };
        })()
      : null;

  return (
    <DashboardEditContext.Provider value={context}>
      <DndContext
        sensors={sensors}
        autoScroll={dashboardAutoScroll(reducedMotion)}
        accessibility={{
          announcements: SILENT_ANNOUNCEMENTS,
          screenReaderInstructions: { draggable: messages.instructions },
        }}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        onDragCancel={cancel}
      >
        {children}
      </DndContext>
      {marquee.rect ? (
        // z-order — RM-081: chrome always paints above every tile, however high a tile's own
        // `layout.z` climbs (see `TILE_CHROME_Z` at dashboard-tile.tsx).
        <DashboardMarquee rect={marquee.rect} style={{ zIndex: TILE_CHROME_Z }} />
      ) : null}
      {selectionRect ? (
        <DashboardSelectionToolbar
          ids={focus}
          left={(selectionRect.left + selectionRect.right) / 2}
          top={selectionRect.top}
        />
      ) : null}
      {ghost ? (
        <div
          aria-hidden="true"
          data-slot="dashboard-edit-layer-ghost"
          data-reject={session?.ok ? undefined : ""}
          className={cn(
            "pointer-events-none absolute flex items-center justify-center rounded-lg border-dashed",
            session?.ok ? "border-ring" : "border-destructive text-destructive",
          )}
          style={{
            left: 0,
            top: 0,
            width: ghost.width,
            height: ghost.height,
            borderWidth: CHART_HAIRLINE_WIDTH,
            transform: `translate(${ghost.x}px, ${ghost.y}px)`,
            // z-order — RM-081: see the marquee comment above.
            zIndex: TILE_CHROME_Z,
          }}
        >
          {session?.ok ? null : <Ban className="size-5" />}
        </div>
      ) : null}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-slot="dashboard-edit-layer-announcer"
        className="sr-only"
      >
        {announcement}
      </div>
    </DashboardEditContext.Provider>
  );
}

// tile operations — RM-081 follow-up 1
interface DashboardSelectionToolbarProps {
  /** The multi-selection this toolbar acts on (`≥ 2` top-level ids). */
  ids: string[];
  /** Sheet-pixel position of the selection's bounding box, centre-x / top. */
  left: number;
  top: number;
}

const ALIGN_BUTTONS: { edge: AlignEdge; icon: LucideIcon; key: string }[] = [
  { edge: "left", icon: AlignHorizontalJustifyStart, key: "alignLeft" },
  { edge: "center-h", icon: AlignHorizontalJustifyCenter, key: "alignCenterH" },
  { edge: "right", icon: AlignHorizontalJustifyEnd, key: "alignRight" },
  { edge: "top", icon: AlignVerticalJustifyStart, key: "alignTop" },
  { edge: "center-v", icon: AlignVerticalJustifyCenter, key: "alignCenterV" },
  { edge: "bottom", icon: AlignVerticalJustifyEnd, key: "alignBottom" },
];

/**
 * The align/distribute toolbar (RM-081 follow-up 1): floats above a multi-selection, real
 * `ui/Toolbar` buttons that call the store's `alignTiles`/`distributeTiles` directly — never a
 * hand-rolled control. Distribute needs a middle tile, so it only appears at `ids.length >= 3`
 * (`distributeTiles` itself already no-ops below that; hiding the buttons avoids a dead click).
 */
function DashboardSelectionToolbar({ ids, left, top }: DashboardSelectionToolbarProps) {
  const actions = useDashboardActions();
  const { t } = useLocale();
  return (
    <Toolbar
      aria-label={t("charts.dashboard.tileOps.selectionToolbarLabel")}
      data-slot="dashboard-selection-toolbar"
      className="absolute rounded-lg bg-popover p-1 text-popover-foreground shadow-ring-md"
      style={{
        left,
        top: top - 8,
        transform: "translate(-50%, -100%)",
        // z-order — RM-081: see the marquee/ghost comment above (dashboard-tile.tsx's
        // `TILE_CHROME_Z`) — always above every tile.
        zIndex: TILE_CHROME_Z + 10,
      }}
    >
      {ALIGN_BUTTONS.map(({ edge, icon: Icon, key }) => (
        <ToolbarButton
          key={edge}
          size="icon-sm"
          aria-label={t(`charts.dashboard.tileOps.${key}`)}
          onClick={() => actions.alignTiles(ids, edge)}
        >
          <Icon aria-hidden="true" className="size-4" />
        </ToolbarButton>
      ))}
      {ids.length >= 3 ? (
        <>
          <ToolbarSeparator />
          <ToolbarButton
            size="icon-sm"
            aria-label={t("charts.dashboard.tileOps.distributeHorizontal")}
            onClick={() => actions.distributeTiles(ids, "h")}
          >
            <AlignHorizontalDistributeCenter aria-hidden="true" className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            size="icon-sm"
            aria-label={t("charts.dashboard.tileOps.distributeVertical")}
            onClick={() => actions.distributeTiles(ids, "v")}
          >
            <AlignVerticalDistributeCenter aria-hidden="true" className="size-4" />
          </ToolbarButton>
        </>
      ) : null}
    </Toolbar>
  );
}
