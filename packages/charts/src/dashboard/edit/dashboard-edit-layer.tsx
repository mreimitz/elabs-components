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
import { Ban } from "lucide-react";
import { cn, useLocale } from "@elabs-ai/components-ui";
import { useReducedMotion } from "@elabs-ai/components-tokens";

import { CHART_HAIRLINE_WIDTH } from "../../chart-hairline";
import { cellRect, correctBounds } from "../core/layout";
import type { GridSpec, TileLayout } from "../core/spec";
import { useDashboardActions, useDashboardContext } from "../dashboard-sheet/use-dashboard";
import { SILENT_ANNOUNCEMENTS, editMessages, type ResizeHandle } from "./announcer";
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

const sameCells = (a: TileLayout, b: TileLayout) =>
  a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

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

  const [session, setSessionState] = useState<DashboardEditSession | null>(null);
  const sessionRef = useRef<DashboardEditSession | null>(null);
  const setSession = useCallback((next: DashboardEditSession | null) => {
    sessionRef.current = next;
    setSessionState(next);
  }, []);

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
      actions.setFocus([tile.id]);
      return next;
    },
    [store, actions, setSession],
  );

  /** Re-target the running session by a whole-cell offset from its origin. */
  const retarget = useCallback(
    (current: DashboardEditSession, dx: number, dy: number) => {
      if (current.delta.dx === dx && current.delta.dy === dy) return;
      const spec = store.getState().spec;
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
    const title = titleOf(current.tileId);
    if (!current.ok) {
      announce(messages.rejected);
      return;
    }
    const { target, origin, tileId } = current;
    if (!sameCells(target, origin)) {
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
    const placed = store.getState().spec.tiles.find((tile) => tile.id === tileId)?.layout ?? target;
    announce(
      current.kind === "move" ? messages.dropped(title, placed) : messages.resized(title, placed),
    );
  }, [actions, store, setSession, titleOf, messages, announce]);

  const cancel = useCallback(() => {
    if (!sessionRef.current) return;
    setSession(null);
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
      {ghost ? (
        <div
          aria-hidden="true"
          data-slot="dashboard-edit-layer-ghost"
          data-reject={session?.ok ? undefined : ""}
          className={cn(
            "pointer-events-none absolute z-20 flex items-center justify-center rounded-lg border-dashed",
            session?.ok ? "border-ring" : "border-destructive text-destructive",
          )}
          style={{
            left: 0,
            top: 0,
            width: ghost.width,
            height: ghost.height,
            borderWidth: CHART_HAIRLINE_WIDTH,
            transform: `translate(${ghost.x}px, ${ghost.y}px)`,
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
