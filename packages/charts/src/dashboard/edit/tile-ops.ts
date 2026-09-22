"use client";

/**
 * `useTileOps` — the ONE set of edit-mode tile operations, shared by the right-click context
 * menu (`DashboardTileContextMenu`), the header hover chrome (`DashboardTileMenu` in edit mode)
 * and the toolbar's selection actions. Every entry drives the store; the toast on delete
 * offers Undo (destructive actions never fire silently — conventions.md).
 */
import { toast, useLocale } from "@elabs-ai/components-ui";

import type { TileSpec } from "../core/spec";
import {
  useDashboard,
  useDashboardActions,
  useDashboardContext,
} from "../dashboard-sheet/use-dashboard";
import { readDashboardClipboard, writeDashboardClipboard } from "./clipboard";

export interface TileOps {
  tile: TileSpec | undefined;
  /** Ids the selection-wide actions (copy/cut/delete) act on. */
  selectionIds: string[];
  fitMode: boolean;
  locked: boolean;
  /** Registered kinds this tile can be replaced with. */
  replaceKinds: { kind: string; label: string }[];
  duplicate(): void;
  replace(kind: string): void;
  addToLibrary(): void;
  copy(): void;
  cut(): void;
  paste(): void;
  pasteAndReplace(): void;
  bringForward(): void;
  sendBackward(): void;
  toggleLock(): void;
  /** Focus this tile and open the properties panel. */
  openProperties(): void;
  /** Remove the selection (or this tile) with an Undo toast. */
  remove(): void;
}

export function useTileOps(tileId: string): TileOps {
  const { registry } = useDashboardContext();
  const actions = useDashboardActions();
  const { t } = useLocale();
  const spec = useDashboard((s) => s.spec);
  const focus = useDashboard((s) => s.focus);

  const tile = spec.tiles.find((item) => item.id === tileId);
  const fitMode = spec.grid.mode === "fit";
  const selectionIds = focus.includes(tileId) && focus.length > 1 ? focus : [tileId];
  const selectionTiles = spec.tiles.filter((item) => selectionIds.includes(item.id));
  const replaceKinds = tile
    ? registry.kinds
        .filter((kind) => kind.kind !== tile.kind)
        .map((kind) => ({ kind: kind.kind, label: kind.label }))
    : [];

  const notifyDeleted = (removed: TileSpec[], restore: () => void) => {
    const message =
      removed.length === 1
        ? t("charts.dashboard.tileOps.deletedOne")
        : t("charts.dashboard.tileOps.deletedMany", { count: removed.length });
    toast(message, { action: { label: t("charts.dashboard.tileOps.undo"), onClick: restore } });
  };

  return {
    tile,
    selectionIds,
    fitMode,
    locked: Boolean(tile?.layout.static),
    replaceKinds,
    duplicate: () => {
      const id = actions.duplicateTile(tileId);
      if (id) actions.setFocus([id]);
    },
    replace: (kind) => {
      const target = registry.get(kind);
      actions.replaceTile(tileId, kind, target?.defaultContent);
    },
    addToLibrary: () => {
      if (!tile) return;
      const libraryId = `${tileId}-library`;
      actions.setSpec({
        ...spec,
        library: [
          ...(spec.library ?? []),
          { id: libraryId, kind: tile.kind, label: tile.title ?? tile.kind, content: tile.content },
        ],
        tiles: spec.tiles.map((item) => (item.id === tileId ? { ...item, ref: libraryId } : item)),
      });
    },
    copy: () => void writeDashboardClipboard(selectionTiles),
    cut: () => {
      void writeDashboardClipboard(selectionTiles);
      actions.batch(() => {
        for (const id of selectionIds) actions.removeTile(id);
      });
    },
    paste: () => {
      void readDashboardClipboard().then((tiles) => {
        if (tiles.length > 0) actions.pasteTiles(tiles);
      });
    },
    pasteAndReplace: () => {
      void readDashboardClipboard().then(([first]) => {
        if (first) actions.replaceTile(tileId, first.kind, first.content);
      });
    },
    bringForward: () => actions.bringForward(tileId),
    sendBackward: () => actions.sendBackward(tileId),
    toggleLock: () => {
      if (!tile) return;
      const { static: wasLocked, ...rest } = tile.layout;
      actions.patchTile(tileId, { layout: wasLocked ? rest : { ...rest, static: true } });
    },
    openProperties: () => {
      actions.setFocus([tileId]);
      actions.setPanel("properties", true);
    },
    remove: () => {
      const removed = selectionTiles;
      actions.batch(() => {
        for (const id of selectionIds) actions.removeTile(id);
      });
      notifyDeleted(removed, () => actions.undo());
    },
  };
}
