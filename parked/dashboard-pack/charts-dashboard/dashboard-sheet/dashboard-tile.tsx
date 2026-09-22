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
import { resolveInteractions, tileSelectionView } from "../core/interactions";
import { EMPTY_SELECTION } from "../core/selection";
import type { DashboardMode } from "../core/store";
import { dispatchAnchoredContextMenu } from "../edit/context-menu-anchor";
import { previewLayoutFor, useDashboardEdit } from "../edit/edit-context";
import { DashboardTileContextMenu } from "../edit/tile-context-menu";
import { TileDragHandle, useTileMove } from "../edit/tile-drag-handle";
import { DashboardTileHeader } from "./dashboard-tile-header";
import { DashboardTileMenu } from "./dashboard-tile-menu";
import { useDashboardSheetContext } from "./sheet-context";
import type { DashboardTileFrameProps, DashboardTileProps } from "./tile-registry";
import { useCellRect, useResolvedCell } from "./use-cell-rect";
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

// z-order — RM-081 (follow-up 3): `fit`-mode tiles stack by `layout.z` (`flow` tiles can't
// overlap, so they never set a z-index at all). Ordinary tiles are clamped to a fixed band so
// unbounded growth from repeated Bring forward/Send backward clicks can never climb into the
// edit-layer chrome's own stacking (dashboard-edit-layer.tsx's ghost/marquee/selection toolbar/
// per-tile handle overlay all paint at `TILE_CHROME_Z` or above). Only a tile with an ACTIVE
// drag/resize session (this tile is the one gesture in progress) is raised to `TILE_RAISED_Z` —
// merely being focused no longer raises a tile: a real user's tile stays focused after Bring
// forward/Send backward closes its context menu (Radix returns focus to the trigger), and if
// focus alone raised it, Send backward — the common case — would never visibly change anything.
// A focused-but-not-dragging tile's resize handles and focus outline are NOT its own DOM
// descendants any more; they paint in the edit layer's chrome band, positioned from the tile's
// own `cellRect`, so they stay usable even when the tile's own (unraised) body is covered by a
// higher-`z` neighbour. The raise is an inline style only; `layout.z` itself is never touched by
// focus or by a session.
/** Band ordinary `fit`-mode tiles clamp their `layout.z` into. */
export const TILE_Z_BAND = 100;
/** Stacking of a tile with an active drag/resize session (ephemeral — never written to `layout.z`). */
export const TILE_RAISED_Z = 500;
/** Floor every edit-layer chrome element (ghost, marquee, selection toolbar, tile handle overlay) paints at. */
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
    const driverSelection = useDashboard((s) =>
      capabilities.consumesSelection ? s.selection : EMPTY_SELECTION,
    );
    // interaction graph — RM-082: the tile sees the driver selection minus fields an emitter's
    // `highlight`/`none` pair shields it from, with a `highlight` painted through the same
    // `selectionStates` tri-state (the `selection` prop) — no new prop, token or state.
    const interactionSpec = useDashboard((s) => s.spec);
    const highlight = useDashboard((s) => (capabilities.consumesSelection ? s.highlight : null));
    const origins = useDashboard((s) => s.selectionOrigins);
    const interactionMap = useMemo(() => resolveInteractions(interactionSpec), [interactionSpec]);
    const selection = useMemo(
      () =>
        capabilities.consumesSelection
          ? tileSelectionView({
              tileId,
              snapshot: driverSelection,
              map: interactionMap,
              origins,
              highlight,
            })
          : driverSelection,
      [capabilities.consumesSelection, tileId, driverSelection, interactionMap, origins, highlight],
    );
    const highlighted = Boolean(highlight?.targets.has(tileId));
    const emitsSelection = Boolean(tile?.emits?.selection);
    const hover = useDashboard((s) => (capabilities.consumesHover ? s.hover : null));
    const variables = useDashboard((s) => s.variables);
    // Edit mode (RM-078): top-level tiles move/resize through the edit layer, which paints the
    // running gesture's would-be layout; tiles inside a container are not draggable yet.
    const edit = useDashboardEdit();
    const editable = Boolean(edit && tile && !tile.container);
    // A locked tile (`layout.static`) keeps its context menu, focus and properties but never
    // moves or resizes — no drag surface, no handles (the edit layer paints a lock instead).
    const movable = editable && !tile?.layout.static;
    const move = useTileMove(tileId, movable);
    const focused = useDashboard((s) => s.focus.includes(tileId));
    // responsive layout — RM-084 follow-up 1: an active edit-layer preview (a running drag/
    // resize gesture) always wins; otherwise the sheet's resolved per-breakpoint cell for this
    // tile id wins over its base `layout` — `undefined` (no sheet, no override, a container
    // child) falls back to the base layout unchanged, so a sheet with no `layouts` renders
    // byte-identically to before at every breakpoint.
    const baseCell = tile?.layout ?? { x: 0, y: 0, w: 1, h: 1 };
    const resolvedCell = useResolvedCell(tileId, baseCell);
    const cells = (editable ? previewLayoutFor(edit, tileId) : undefined) ?? resolvedCell;
    const snappedRect = useCellRect(cells);
    // While THIS tile's own pointer gesture runs it follows the cursor 1:1 (a move slides the
    // whole box, a resize slides the dragged edge) between two snapped cells — the ghost in the
    // edit layer shows where it will land. Keyboard gestures have no `pointer` and step cells.
    const ownSession = edit?.session?.tileId === tileId ? edit.session : null;
    const originRect = useCellRect(ownSession?.origin ?? cells);
    const rect = useMemo(() => {
      if (!ownSession?.pointer || !originRect || !edit?.pitch) return snappedRect;
      const { dx, dy } = ownSession.pointer;
      if (ownSession.kind === "move")
        return { ...originRect, x: originRect.x + dx, y: originRect.y + dy };
      const handle = ownSession.handle ?? "se";
      // A span of n cells is n × pitch − gap wide, so the gap is what a whole number of pitches
      // overshoots the origin box by; the smallest box is the tile's own `minW`/`minH` cells.
      const gapX = ownSession.origin.w * edit.pitch.width - originRect.width;
      const gapY = ownSession.origin.h * edit.pitch.height - originRect.height;
      const minWidth = Math.max(1, ownSession.origin.minW ?? 1) * edit.pitch.width - gapX;
      const minHeight = Math.max(1, ownSession.origin.minH ?? 1) * edit.pitch.height - gapY;
      let { x, y, width, height } = originRect;
      if (handle.includes("e")) width = Math.max(minWidth, width + dx);
      if (handle.includes("w")) {
        const next = Math.max(minWidth, width - dx);
        x += width - next;
        width = next;
      }
      if (handle.startsWith("s")) height = Math.max(minHeight, height + dy);
      if (handle.startsWith("n")) {
        const next = Math.max(minHeight, height - dy);
        y += height - next;
        height = next;
      }
      return { ...originRect, x, y, width, height };
    }, [ownSession, originRect, snappedRect, edit?.pitch]);

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
        // interaction graph — RM-082: a tile that declares `emits.selection` publishes through
        // the graph; any other (the filter tile) writes globally.
        select: (field, values, opts) =>
          actions.select(field, values, opts, emitsSelection ? { fromTileId: tileId } : undefined),
        hover: (h) => actions.setHover(h ? { ...h, tileId } : null),
        setVariable: actions.setVariable,
        navigate: (sheetId) => onNavigate?.(sheetId),
        openBookmark: actions.applyBookmark,
        refresh: () => onRefresh?.(tileId),
        action: (id) => onAction?.(id),
      }),
      [actions, tileId, emitsSelection, onNavigate, onRefresh, onAction],
    );

    if (!tile) return null;

    const chrome = sheet?.chrome ?? true;
    const title = tile.title ?? "";
    // Edit mode shows an untitled tile's placeholder name so the header is never a blank strip
    // (a reader in view mode sees no header at all, as before).
    const titleHeader =
      chrome && (tile.title || editable) ? (
        <DashboardTileHeader
          titleId={titleId}
          title={title || labels.untitledTile(tile.kind)}
          subtitle={tile.subtitle}
          density={density}
          placeholder={!tile.title}
        />
      ) : undefined;
    const accessibleTitle = title || labels.untitledTile(tile.kind);
    const dragHandle = movable ? (
      <TileDragHandle title={accessibleTitle} {...move.buttonProps} />
    ) : null;
    // In edit mode the whole header is the pointer/long-press drag surface, the move button at its start.
    const header =
      movable && chrome ? (
        <div
          data-slot="dashboard-tile-drag-surface"
          className="flex min-w-0 flex-1 touch-manipulation items-start gap-1 cursor-grab active:cursor-grabbing"
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
    // ever open at a time. Anchored at the tile's own rect (`context-menu-anchor.ts`, visual
    // P1) rather than the kebab button's — the button is inside a dropdown that is already
    // closing when this fires, so the tile root is the stable, always-current rect. Focusing
    // the tile FIRST (visual/focus P1 follow-up) makes it — not whatever the dropdown's own
    // async close-focus-restore lands on — the element Radix's `ContextMenu` snapshots as "focus
    // before open", so closing it (Escape, an action, clicking away) reliably returns focus to
    // the tile instead of racing the kebab dropdown's own trigger-refocus.
    const onOpenTileMenu = editable
      ? () => {
          const node = rootRef.current;
          if (!node) return;
          setTimeout(() => {
            node.focus();
            dispatchAnchoredContextMenu(node, node);
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
    const padding = capabilities.padding ?? "default";
    const plain = capabilities.surface === "plain";
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
    // z-order — RM-081 (follow-up 3): see the comment at `TILE_Z_BAND`/`TILE_RAISED_Z`/
    // `TILE_CHROME_Z` above — only THIS tile's own active drag/resize session raises it; being
    // merely focused does not.
    const zIndex =
      session !== null
        ? TILE_RAISED_Z
        : gridMode === "fit"
          ? Math.max(-TILE_Z_BAND, Math.min(TILE_Z_BAND, tile.layout.z ?? 0))
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
        data-tile-surface={plain ? "plain" : "card"}
        data-density={density}
        data-tile-body-mounted={mounted ? "" : undefined}
        data-editing={editable ? "" : undefined}
        data-locked={tile.layout.static ? "" : undefined}
        data-focused={editable && focused ? "" : undefined}
        data-dragging={session ? session.kind : undefined}
        // A test/host hook only (nothing is styled off it): tells a `highlight` from a filter.
        data-highlighted={highlighted ? "" : undefined}
        className={cn(
          "group/tile absolute flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg focus-ring",
          plain
            ? editable && "border border-dashed border-border"
            : "border border-border bg-card shadow-xs",
          padding === "default" && "p-3",
          padding === "compact" && "px-3 py-1.5",
          "transition-[transform,width,height,box-shadow] duration-base ease-standard motion-reduce:transition-none",
          // Edit mode: a quiet hover ring says "this is a thing you can pick up"; the focus
          // outline and handles paint in the edit layer's chrome band.
          // Edit mode is for arranging, not reading: no text selection (Shift-click adds to the
          // multi-selection instead of extending a text range).
          editable && "select-none",
          editable && !focused && "hover:ring-1 hover:ring-border-strong",
          // The one tile mid-gesture is lifted: no transition (it tracks the pointer), a real
          // shadow, and the body stops catching the pointer so the drop lands on the sheet.
          session && "pointer-events-none shadow-lg transition-none",
          (edit?.reducedMotion || session) && "transition-none",
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
