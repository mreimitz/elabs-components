"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
} from "react";
import { Skeleton, StatePanel, cn } from "@elabs-ai/components-ui";

import { ChartFrame, type ChartFrameMenuApi } from "../../chart-frame/chart-frame";
import type { ChartDensity, ChartInteractions } from "../../charts/chart-config-context";
import { EMPTY_SELECTION } from "../core/selection";
import type { DashboardMode } from "../core/store";
import { previewLayoutFor, useDashboardEdit } from "../edit/edit-context";
import { DashboardTileContextMenu } from "../edit/tile-context-menu";
import { TileDragHandle, useTileMove } from "../edit/tile-drag-handle";
import { TileResizeHandles } from "../edit/tile-resize-handles";
import { TileSizeBadge } from "../edit/tile-size-badge";
import { DashboardTileHeader } from "./dashboard-tile-header";
import { DashboardTileMenu } from "./dashboard-tile-menu";
import { useDashboardSheetContext } from "./sheet-context";
import type { DashboardTileFrameProps, DashboardTileProps } from "./tile-registry";
import { useCellRect } from "./use-cell-rect";
import { useDashboard, useDashboardActions, useDashboardContext } from "./use-dashboard";

/** Density tier from a tile's pixel size: `xs` < 200×100, `sm` < 400×200, `md` < 800×400, else `lg`. */
export function tileDensity(width: number, height: number): ChartDensity {
  if (width < 200 || height < 100) return "xs";
  if (width < 400 || height < 200) return "sm";
  if (width < 800 || height < 400) return "md";
  return "lg";
}

const VIEW_INTERACTIONS: Required<ChartInteractions> = {
  passive: true,
  active: true,
  select: true,
  edit: false,
};
const EDIT_INTERACTIONS: Required<ChartInteractions> = {
  passive: false,
  active: false,
  select: false,
  edit: true,
};

/** Interaction layers for a mode: view mounts passive/active/select, edit mounts only edit. */
export function tileInteractions(mode: DashboardMode): Required<ChartInteractions> {
  return mode === "edit" ? EDIT_INTERACTIONS : VIEW_INTERACTIONS;
}

// z-order — RM-081: `fit`-mode tiles stack by `layout.z` (`flow` tiles can't overlap, so they
// never set a z-index at all). Ordinary tiles are clamped to a fixed band so unbounded growth
// from repeated Bring forward/Send backward clicks can never climb into the edit-layer chrome's
// own stacking (dashboard-edit-layer.tsx's ghost/marquee/selection toolbar all paint at
// `TILE_CHROME_Z` or above). A focused or actively-dragging tile is raised to `TILE_RAISED_Z` —
// above every ordinary tile, still under the chrome — so its own resize handles/drag handle/
// size badge (rendered as its DOM descendants) can never be hidden by a neighbour with a higher
// stored `z`. The raise is an inline style only; `layout.z` itself is never touched by focus.
/** Band ordinary `fit`-mode tiles clamp their `layout.z` into. */
export const TILE_Z_BAND = 100;
/** Stacking of a focused/dragging tile (ephemeral — never written to `layout.z`). */
export const TILE_RAISED_Z = 500;
/** Floor every edit-layer chrome element (ghost, marquee, selection toolbar) paints at. */
export const TILE_CHROME_Z = 1000;

export interface DashboardTileRootProps extends HTMLAttributes<HTMLDivElement> {
  /** The tile's id in the spec. */
  tileId: string;
}

/**
 * One tile, absolutely positioned at its `cellRect` on the nearest sheet/container grid.
 * Header, hover toolbar and menu compose `ChartFrame chrome="tile"`; the body mounts once it
 * nears the viewport (a `Skeleton` holds its size until then).
 */
export const DashboardTile = forwardRef<HTMLDivElement, DashboardTileRootProps>(
  function DashboardTile(
    { tileId, className, style, onFocus, onKeyDown, onClick, ...props },
    forwardedRef,
  ) {
    const { store, registry, labels, onNavigate, onRefresh, onAction } = useDashboardContext();
    const sheet = useDashboardSheetContext();
    const actions = useDashboardActions();
    const tile = useDashboard((s) => s.spec.tiles.find((t) => t.id === tileId));
    const mode = useDashboard((s) => s.mode);
    // z-order — RM-081: `layout.z` only ever stacks in `fit` mode (`flow` tiles can't overlap).
    const gridMode = useDashboard((s) => s.spec.grid.mode);
    const kind = tile ? registry.get(tile.kind) : undefined;
    const capabilities = kind?.capabilities ?? {};
    const selection = useDashboard((s) =>
      capabilities.consumesSelection ? s.selection : EMPTY_SELECTION,
    );
    const hover = useDashboard((s) => (capabilities.consumesHover ? s.hover : null));
    const variables = useDashboard((s) => s.variables);
    // Edit mode (RM-078): top-level tiles move/resize through the edit layer, which paints the
    // running gesture's would-be layout; tiles inside a container are not draggable yet.
    const edit = useDashboardEdit();
    const editable = Boolean(edit && tile && !tile.container);
    const move = useTileMove(tileId, editable);
    const focused = useDashboard((s) => s.focus.includes(tileId));
    const cells = (editable ? previewLayoutFor(edit, tileId) : undefined) ??
      tile?.layout ?? { x: 0, y: 0, w: 1, h: 1 };
    const rect = useCellRect(cells);

    const rootRef = useRef<HTMLDivElement | null>(null);
    const setDragNode = move.setNodeRef;
    const setRef = useCallback(
      (node: HTMLDivElement | null) => {
        rootRef.current = node;
        setDragNode(node);
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef, setDragNode],
    );

    const observe = sheet?.observe ?? null;
    const renderAll = !sheet || sheet.renderAll;
    const [intersected, setIntersected] = useState(false);
    const mounted = renderAll || intersected;
    useEffect(() => {
      if (mounted || !observe || !rootRef.current) return;
      return observe(rootRef.current, () => setIntersected(true));
    }, [mounted, observe]);

    const titleId = useId();
    const expandedRef = useRef(false);
    const onExpandChange = useCallback((open: boolean) => {
      // Radix returns focus to the element that opened the dialog; a menu item is gone by
      // then, so land on the tile itself.
      if (expandedRef.current && !open) setTimeout(() => rootRef.current?.focus(), 0);
      expandedRef.current = open;
    }, []);

    const width = rect?.width ?? 0;
    const height = rect?.height ?? 0;
    const density = tileDensity(width, height);
    const interactions = tileInteractions(mode);

    const emit = useMemo<DashboardTileProps["emit"]>(
      () => ({
        select: actions.select,
        hover: (h) => actions.setHover(h ? { ...h, tileId } : null),
        setVariable: actions.setVariable,
        navigate: (sheetId) => onNavigate?.(sheetId),
        openBookmark: actions.applyBookmark,
        refresh: () => onRefresh?.(tileId),
        action: (id) => onAction?.(id),
      }),
      [actions, tileId, onNavigate, onRefresh, onAction],
    );

    if (!tile) return null;

    const chrome = sheet?.chrome ?? true;
    const title = tile.title ?? "";
    const titleHeader =
      chrome && tile.title ? (
        <DashboardTileHeader
          titleId={titleId}
          title={title}
          subtitle={tile.subtitle}
          density={density}
        />
      ) : undefined;
    const accessibleTitle = title || labels.untitledTile(tile.kind);
    const dragHandle = editable ? (
      <TileDragHandle title={accessibleTitle} {...move.buttonProps} />
    ) : null;
    // In edit mode the whole header is the pointer/long-press drag surface, the move button at its start.
    const header =
      editable && chrome ? (
        <div
          data-slot="dashboard-tile-drag-surface"
          className="flex min-w-0 touch-manipulation items-start gap-1"
          {...move.headerProps}
        >
          {dragHandle}
          {titleHeader}
        </div>
      ) : (
        titleHeader
      );
    const menuItems = sheet?.menuItems?.(tile);
    // tile operations — RM-081 follow-up 1: the header-kebab entry that opens the SAME
    // edit-mode context menu wrapping this tile — dispatching a real `contextmenu` event at
    // the tile root is the same technique `useDashboardShortcuts` already uses for Shift+F10.
    // `setTimeout` lets the kebab dropdown finish closing first, so only one Radix menu is
    // ever open at a time.
    const onOpenTileMenu = editable
      ? () => {
          const node = rootRef.current;
          if (!node) return;
          setTimeout(() => {
            node.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
          }, 0);
        }
      : undefined;
    const menuSlot = chrome
      ? (api: ChartFrameMenuApi) => (
          <DashboardTileMenu
            tile={tile}
            api={api}
            density={density}
            labels={labels}
            menuItems={menuItems}
            onOpenTileMenu={onOpenTileMenu}
          />
        )
      : undefined;
    const expand = capabilities.expand ?? true;
    const frameOwned = Boolean(kind && capabilities.frame);

    const frame: DashboardTileFrameProps = {
      chrome: chrome ? "tile" : "bare",
      title: tile.title,
      source: tile.source,
      headerSlot: header,
      menuSlot,
      density,
      interactions,
      onExpandChange,
    };

    const skeleton = <Skeleton className="size-full rounded-md" />;
    let content;
    if (!kind) {
      content = (
        <StatePanel
          kind="empty"
          size="sm"
          titleAs="h4"
          title={labels.unknownKind(tile.kind)}
          description={density === "xs" ? undefined : labels.unknownKindDescription}
          className="size-full"
        />
      );
    } else if (mounted) {
      const Component = kind.component;
      const tileProps: DashboardTileProps = {
        tile,
        size: { w: tile.layout.w, h: tile.layout.h, width, height },
        mode,
        interactions,
        selection,
        hover,
        variables,
        emit,
        density,
        frame,
      };
      content = <Component {...tileProps} />;
    }

    const body =
      frameOwned && mounted ? (
        content
      ) : (
        <ChartFrame
          chrome={frame.chrome}
          title={tile.title}
          source={tile.source}
          headerSlot={header}
          menuSlot={menuSlot}
          density={density}
          interactions={interactions}
          features={expand && kind ? ["expand"] : []}
          onExpandChange={onExpandChange}
        >
          {content ?? skeleton}
        </ChartFrame>
      );

    const active = sheet ? sheet.activeTileId === tileId : true;
    const session = edit?.session?.tileId === tileId ? edit.session : null;
    const showEditChrome = editable && (focused || session !== null);
    // z-order — RM-081: see the comment at `TILE_Z_BAND`/`TILE_RAISED_Z`/`TILE_CHROME_Z` above.
    const zIndex =
      gridMode === "fit"
        ? showEditChrome
          ? TILE_RAISED_Z
          : Math.max(-TILE_Z_BAND, Math.min(TILE_Z_BAND, tile.layout.z ?? 0))
        : undefined;

    const tileElement = (
      <div
        ref={setRef}
        role="group"
        tabIndex={sheet ? (active ? 0 : -1) : undefined}
        aria-labelledby={titleHeader ? titleId : undefined}
        aria-label={titleHeader ? undefined : accessibleTitle}
        aria-describedby={move.describedBy}
        data-slot="dashboard-tile"
        data-tile-id={tile.id}
        data-tile-kind={tile.kind}
        data-density={density}
        data-tile-body-mounted={mounted ? "" : undefined}
        data-editing={editable ? "" : undefined}
        data-focused={editable && focused ? "" : undefined}
        data-dragging={session ? session.kind : undefined}
        className={cn(
          "group/tile absolute flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card p-3 shadow-xs focus-ring",
          "transition-[transform,width,height] duration-base ease-standard motion-reduce:transition-none",
          "data-focused:border-ring",
          edit?.reducedMotion && "transition-none",
          className,
        )}
        style={{
          // cellRect is physical (origin top-left), so the anchor is too.
          left: 0,
          top: 0,
          width,
          height,
          transform: rect ? `translate(${rect.x}px, ${rect.y}px)` : undefined,
          visibility: rect ? undefined : "hidden",
          zIndex,
          ...style,
        }}
        onFocus={(event) => {
          if (event.target === event.currentTarget) sheet?.setActiveTileId(tileId);
          if (editable && event.target === event.currentTarget && !focused)
            actions.setFocus([tileId]);
          onFocus?.(event);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (!event.defaultPrevented) move.onRootKeyDown(event);
        }}
        onClick={(event) => {
          onClick?.(event);
          // Shift-click adds to the edit focus (multi-select proper is RM-081).
          if (editable && event.shiftKey && !focused)
            actions.setFocus([...store.getState().focus, tileId]);
        }}
        {...props}
      >
        <div data-slot="dashboard-tile-body" className="flex min-h-0 flex-1 flex-col">
          {body}
        </div>
        {editable && !chrome ? (
          <div className="absolute start-1 top-1 z-10" {...move.headerProps}>
            {dragHandle}
          </div>
        ) : null}
        {showEditChrome ? (
          <>
            <TileResizeHandles tileId={tileId} title={accessibleTitle} />
            <TileSizeBadge cell={session?.target ?? tile.layout} />
          </>
        ) : null}
      </div>
    );

    // tile operations — RM-081 follow-up 1: every editable top-level tile is its own
    // right-click/header-kebab/Shift+F10 context-menu trigger — built in, no host
    // composition. `asChild`'d on the tile root itself (`ContextMenuTrigger` inside
    // `DashboardTileContextMenu`), so it adds no extra DOM node.
    return editable ? (
      <DashboardTileContextMenu tileId={tileId}>{tileElement}</DashboardTileContextMenu>
    ) : (
      tileElement
    );
  },
);
