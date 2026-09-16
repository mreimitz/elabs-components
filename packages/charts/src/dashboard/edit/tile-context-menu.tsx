"use client";

import { type ReactNode } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  toast,
  useLocale,
} from "@elabs-ai/components-ui";

import type { TileSpec } from "../core/spec";
import {
  useDashboard,
  useDashboardActions,
  useDashboardContext,
} from "../dashboard-sheet/use-dashboard";
import { readDashboardClipboard, writeDashboardClipboard } from "./clipboard";

export interface DashboardTileContextMenuProps {
  /** The tile this menu acts on. When it is part of a multi-selection (`focus`), Copy/Cut/
   * Delete act on the whole selection; every other action (Replace, Paste and replace,
   * Bring forward/Send backward) always targets this one tile. */
  tileId: string;
  children: ReactNode;
}

/**
 * Edit-mode context menu for one tile (RM-081, analysis §2.0): Duplicate, Replace with… (a
 * submenu of registered kinds), Add to library, Copy, Cut, Paste, Paste and replace, Bring
 * forward / Send backward (`fit` mode only), Delete. Wraps `children` (the tile) in
 * `ui/ContextMenu`'s `Trigger` — right-click opens it, and so does the browser's own
 * Shift+F10 (which dispatches a native `contextmenu` event at the focused element; see
 * `useDashboardShortcuts`). Every item is keyboard-reachable through Radix's own menu
 * semantics, and closing returns focus to the trigger (the tile).
 */
export function DashboardTileContextMenu({ tileId, children }: DashboardTileContextMenuProps) {
  const { registry } = useDashboardContext();
  const actions = useDashboardActions();
  const { t } = useLocale();
  const spec = useDashboard((s) => s.spec);
  const focus = useDashboard((s) => s.focus);

  const tile = spec.tiles.find((item) => item.id === tileId);
  if (!tile) return <>{children}</>;

  const fitMode = spec.grid.mode === "fit";
  const selectionIds = focus.includes(tileId) && focus.length > 1 ? focus : [tileId];
  const selectionTiles = spec.tiles.filter((item) => selectionIds.includes(item.id));
  const replaceKinds = registry.kinds.filter((kind) => kind.kind !== tile.kind);

  const notifyDeleted = (removed: TileSpec[], restore: () => void) => {
    const message =
      removed.length === 1
        ? t("charts.dashboard.tileOps.deletedOne")
        : t("charts.dashboard.tileOps.deletedMany", { count: removed.length });
    toast(message, { action: { label: t("charts.dashboard.tileOps.undo"), onClick: restore } });
  };

  const onDuplicate = () => actions.duplicateTile(tileId);
  const onReplace = (kind: string) => {
    const target = registry.get(kind);
    actions.replaceTile(tileId, kind, target?.defaultContent);
  };
  const onAddToLibrary = () => {
    const libraryId = `${tileId}-library`;
    actions.setSpec({
      ...spec,
      library: [
        ...(spec.library ?? []),
        { id: libraryId, kind: tile.kind, label: tile.title ?? tile.kind, content: tile.content },
      ],
      tiles: spec.tiles.map((item) => (item.id === tileId ? { ...item, ref: libraryId } : item)),
    });
  };
  const onCopy = () => void writeDashboardClipboard(selectionTiles);
  const onCut = () => {
    void writeDashboardClipboard(selectionTiles);
    actions.batch(() => {
      for (const id of selectionIds) actions.removeTile(id);
    });
  };
  const onPaste = () => {
    void readDashboardClipboard().then((tiles) => {
      if (tiles.length > 0) actions.pasteTiles(tiles);
    });
  };
  const onPasteAndReplace = () => {
    void readDashboardClipboard().then(([first]) => {
      if (first) actions.replaceTile(tileId, first.kind, first.content);
    });
  };
  const onBringForward = () => actions.bringForward(tileId);
  const onSendBackward = () => actions.sendBackward(tileId);
  const onDelete = () => {
    const removed = selectionTiles;
    actions.batch(() => {
      for (const id of selectionIds) actions.removeTile(id);
    });
    notifyDeleted(removed, () => actions.undo());
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent aria-label={t("charts.dashboard.tileOps.menuLabel")}>
        <ContextMenuItem onSelect={onDuplicate}>
          {t("charts.dashboard.tileOps.duplicate")}
        </ContextMenuItem>
        {replaceKinds.length > 0 ? (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              {t("charts.dashboard.tileOps.replaceWith")}
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {replaceKinds.map((kind) => (
                <ContextMenuItem key={kind.kind} onSelect={() => onReplace(kind.kind)}>
                  {kind.label}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        ) : null}
        <ContextMenuItem onSelect={onAddToLibrary}>
          {t("charts.dashboard.tileOps.addToLibrary")}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onCopy}>{t("charts.dashboard.tileOps.copy")}</ContextMenuItem>
        <ContextMenuItem onSelect={onCut}>{t("charts.dashboard.tileOps.cut")}</ContextMenuItem>
        <ContextMenuItem onSelect={onPaste}>{t("charts.dashboard.tileOps.paste")}</ContextMenuItem>
        <ContextMenuItem onSelect={onPasteAndReplace}>
          {t("charts.dashboard.tileOps.pasteAndReplace")}
        </ContextMenuItem>
        {fitMode ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={onBringForward}>
              {t("charts.dashboard.tileOps.bringForward")}
            </ContextMenuItem>
            <ContextMenuItem onSelect={onSendBackward}>
              {t("charts.dashboard.tileOps.sendBackward")}
            </ContextMenuItem>
          </>
        ) : null}
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onDelete} className="text-destructive-text">
          {t("charts.dashboard.tileOps.delete")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
