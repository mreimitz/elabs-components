"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { forwardRef, useMemo, useState, type PointerEventHandler, type ReactNode } from "react";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  SideDock,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
  type SideDockProps,
} from "@elabs-ai/components-ui";

import { findEmptySlot } from "../core/layout";
import type { DashboardSpec } from "../core/spec";
import type { NewTileSpec } from "../core/store";
import {
  useDashboard,
  useDashboardActions,
  useDashboardContext,
} from "../dashboard-sheet/use-dashboard";
import { getDashboardDropTarget } from "../edit/dashboard-edit-layer";
import { resolvePanelLabels, type DashboardPanelLabels } from "./common-tile-form";

/** A sheet the Sheets tab lists (host-supplied; the host routes, D5). */
export interface DashboardAssetSheet {
  id: string;
  label: string;
}

/** What an asset row's draggable carries in `data.current`. */
export interface DashboardAssetDragData {
  /** The tile kind to create. */
  kind: string;
  /** A `spec.library` entry id: the new tile is a `ref` tile. */
  ref?: string;
  /** Row label (the drag overlay shows it). */
  label: string;
}

export interface DashboardAssetPanelProps extends Omit<
  SideDockProps,
  "title" | "side" | "children"
> {
  /** Dock heading. Default `labels.assetsTitle`. */
  title?: ReactNode;
  /** Sheets the Sheets tab lists. The tab is hidden without them. */
  sheets?: DashboardAssetSheet[];
  /** Called with a sheet id from the Sheets tab; defaults to the provider's `onNavigate`. */
  onNavigate?: (sheetId: string) => void;
  /** Strings; merged over `DEFAULT_DASHBOARD_PANEL_LABELS`. */
  labels?: Partial<DashboardPanelLabels>;
}

const SEP = "\u0000";

/** The tile a row creates, sized from its kind's `defaultSize`. */
function tileFor(
  asset: DashboardAssetDragData,
  spec: DashboardSpec,
  kindOf: (
    kind: string,
  ) => { defaultSize: { w: number; h: number }; defaultContent: unknown } | undefined,
): NewTileSpec | null {
  const library = asset.ref ? spec.library?.find((entry) => entry.id === asset.ref) : undefined;
  const kind = kindOf(library?.kind ?? asset.kind);
  const size = kind?.defaultSize ?? { w: 6, h: 4 };
  if (asset.ref && !library) return null;
  return library
    ? {
        kind: library.kind,
        ref: library.id,
        title: library.title,
        content: structuredClone(library.content),
        layout: { ...size },
      }
    : {
        kind: asset.kind,
        content: structuredClone(kind?.defaultContent ?? {}),
        layout: { ...size },
      };
}

function AssetRow({
  asset,
  value,
  onSelect,
}: {
  asset: DashboardAssetDragData;
  value: string;
  onSelect: () => void;
}) {
  const { setNodeRef, listeners } = useDraggable({
    id: `asset:${asset.ref ?? asset.kind}`,
    data: asset,
  });
  return (
    <CommandItem
      ref={setNodeRef}
      value={value}
      onSelect={onSelect}
      onPointerDown={listeners?.onPointerDown as PointerEventHandler<HTMLDivElement> | undefined}
      data-slot="dashboard-asset-panel-item"
      data-asset-kind={asset.kind}
      className="touch-none"
    >
      {asset.label}
    </CommandItem>
  );
}

function AssetList({
  labels,
  label,
  children,
}: {
  labels: DashboardPanelLabels;
  label: string;
  children: ReactNode;
}) {
  return (
    <Command label={label} data-slot="dashboard-asset-panel-list" className="bg-transparent">
      <CommandInput placeholder={labels.search} aria-label={label} />
      <CommandList>
        <CommandEmpty>{labels.noResults}</CommandEmpty>
        {children}
      </CommandList>
    </Command>
  );
}

/**
 * The edit-mode left panel (RM-080): a `SideDock` with Tiles (every registered kind), Library
 * (`spec.library`), Bookmarks and Sheets tabs, each a searchable `Command` list. Dragging a tile or
 * library row onto an edit-mode sheet creates the tile at the cell under the pointer; activating a
 * row (click, or Enter from the search box) places it at the first empty slot, extending an
 * `extendable` fit sheet once, and toasts when there is no room.
 */
export const DashboardAssetPanel = forwardRef<HTMLElement, DashboardAssetPanelProps>(
  function DashboardAssetPanel(
    { title, sheets, onNavigate, labels: labelsProp, overlayBreakpoint = 1024, ...props },
    ref,
  ) {
    const { store, registry, onNavigate: providerNavigate } = useDashboardContext();
    const actions = useDashboardActions();
    const labels = useMemo(() => resolvePanelLabels(labelsProp), [labelsProp]);
    const library = useDashboard((s) => s.spec.library);
    const bookmarks = useDashboard((s) => s.spec.bookmarks);
    const [dragging, setDragging] = useState<DashboardAssetDragData | null>(null);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 3 } }));

    const place = (asset: DashboardAssetDragData, at?: { x: number; y: number }) => {
      const spec = store.getState().spec;
      const tile = tileFor(asset, spec, (kind) => registry.get(kind));
      if (!tile) return;
      const id = actions.batch(() => {
        const added = actions.addTile(tile, at);
        if (added || at) return added;
        const { grid } = spec;
        if (grid.mode !== "fit" || !grid.extendable) return null;
        const size = tile.layout as { w: number; h: number };
        const rows = grid.rows ?? 12;
        const extensions = grid.extensions ?? 0;
        const original = Math.round(rows / (1 + extensions / 2));
        const extended = { ...grid, rows: rows + Math.ceil(original / 2) };
        const layout = spec.tiles
          .filter((t) => !t.container)
          .map((t) => ({ ...t.layout, id: t.id }));
        if (!findEmptySlot(layout, size, extended)) return null;
        actions.setGrid({ rows: extended.rows, extensions: extensions + 1 });
        return actions.addTile(tile);
      });
      if (id) actions.setFocus([id]);
      else toast(labels.noRoom);
    };

    const onDragStart = ({ active }: DragStartEvent) =>
      setDragging((active.data.current as DashboardAssetDragData | undefined) ?? null);
    const onDragEnd = ({ active, activatorEvent, delta }: DragEndEvent) => {
      setDragging(null);
      const asset = active.data.current as DashboardAssetDragData | undefined;
      const start = activatorEvent as PointerEvent | null;
      if (!asset || !start || typeof start.clientX !== "number") return;
      const cell = getDashboardDropTarget(store)?.cellAt({
        x: start.clientX + delta.x,
        y: start.clientY + delta.y,
      });
      if (cell) place(asset, cell);
    };

    const navigate = onNavigate ?? providerNavigate;

    return (
      <SideDock
        ref={ref}
        side="left"
        title={title ?? labels.assetsTitle}
        overlayBreakpoint={overlayBreakpoint}
        data-dashboard-panel="assets"
        {...props}
      >
        <DndContext
          sensors={sensors}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDragging(null)}
        >
          <Tabs defaultValue="tiles" className="flex min-h-0 flex-col gap-2">
            <TabsList>
              <TabsTrigger value="tiles">{labels.tiles}</TabsTrigger>
              <TabsTrigger value="library">{labels.library}</TabsTrigger>
              <TabsTrigger value="bookmarks">{labels.bookmarks}</TabsTrigger>
              {sheets?.length ? <TabsTrigger value="sheets">{labels.sheets}</TabsTrigger> : null}
            </TabsList>
            <TabsContent value="tiles">
              <AssetList labels={labels} label={labels.tiles}>
                {registry.kinds.map((kind) => {
                  const asset = { kind: kind.kind, label: kind.label };
                  return (
                    <AssetRow
                      key={kind.kind}
                      asset={asset}
                      value={`${kind.label}${SEP}${kind.kind}`}
                      onSelect={() => place(asset)}
                    />
                  );
                })}
              </AssetList>
            </TabsContent>
            <TabsContent value="library">
              <AssetList labels={labels} label={labels.library}>
                {(library ?? []).map((entry) => {
                  const asset = { kind: entry.kind, ref: entry.id, label: entry.label };
                  return (
                    <AssetRow
                      key={entry.id}
                      asset={asset}
                      value={`${entry.label}${SEP}${entry.id}`}
                      onSelect={() => place(asset)}
                    />
                  );
                })}
              </AssetList>
            </TabsContent>
            <TabsContent value="bookmarks">
              <AssetList labels={labels} label={labels.bookmarks}>
                {(bookmarks ?? []).map((bookmark) => (
                  <CommandItem
                    key={bookmark.id}
                    value={`${bookmark.label}${SEP}${bookmark.id}`}
                    onSelect={() => actions.applyBookmark(bookmark.id)}
                  >
                    {bookmark.label}
                  </CommandItem>
                ))}
              </AssetList>
            </TabsContent>
            {sheets?.length ? (
              <TabsContent value="sheets">
                <AssetList labels={labels} label={labels.sheets}>
                  {sheets.map((sheet) => (
                    <CommandItem
                      key={sheet.id}
                      value={`${sheet.label}${SEP}${sheet.id}`}
                      onSelect={() => navigate?.(sheet.id)}
                    >
                      {sheet.label}
                    </CommandItem>
                  ))}
                </AssetList>
              </TabsContent>
            ) : null}
          </Tabs>
          <DragOverlay dropAnimation={null}>
            {dragging ? (
              <div
                data-slot="dashboard-asset-panel-overlay"
                className="rounded-md bg-popover px-2 py-1 text-caption text-popover-foreground shadow-ring-md"
              >
                {dragging.label}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </SideDock>
    );
  },
);
