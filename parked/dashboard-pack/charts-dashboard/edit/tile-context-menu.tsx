"use client";

import { type ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  ClipboardPaste,
  Copy,
  CopyPlus,
  Library,
  Lock,
  LockOpen,
  Replace,
  Scissors,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  useLocale,
} from "@elabs-ai/components-ui";

import { useTileOps } from "./tile-ops";

export interface DashboardTileContextMenuProps {
  /** The tile this menu acts on. When it is part of a multi-selection (`focus`), Copy/Cut/
   * Delete act on the whole selection; every other action (Replace, Paste and replace,
   * Bring forward/Send backward) always targets this one tile. */
  tileId: string;
  children: ReactNode;
}

/**
 * Edit-mode context menu for one tile (RM-081, analysis §2.0): Properties, Duplicate, Replace
 * with… (a submenu of registered kinds), Add to library, Copy, Cut, Paste, Paste and replace,
 * Bring forward / Send backward (`fit` mode only), Lock, Delete. Wraps `children` (the tile)
 * in `ui/ContextMenu`'s `Trigger` — right-click opens it, and so does the browser's own
 * Shift+F10 (which dispatches a native `contextmenu` event at the focused element; see
 * `useDashboardShortcuts`). Every item is keyboard-reachable through Radix's own menu
 * semantics, and closing returns focus to the trigger (the tile). The actions themselves live
 * in `useTileOps`, shared with the header hover chrome.
 */
export function DashboardTileContextMenu({ tileId, children }: DashboardTileContextMenuProps) {
  const { t } = useLocale();
  const ops = useTileOps(tileId);
  if (!ops.tile) return <>{children}</>;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent aria-label={t("charts.dashboard.tileOps.menuLabel")} className="w-56">
        <ContextMenuItem onSelect={ops.openProperties}>
          <SlidersHorizontal aria-hidden="true" />
          {t("charts.dashboard.toolbar.properties")}
        </ContextMenuItem>
        <ContextMenuItem onSelect={ops.duplicate}>
          <CopyPlus aria-hidden="true" />
          {t("charts.dashboard.tileOps.duplicate")}
          <ContextMenuShortcut aria-hidden="true">⌘D</ContextMenuShortcut>
        </ContextMenuItem>
        {ops.replaceKinds.length > 0 ? (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Replace aria-hidden="true" />
              {t("charts.dashboard.tileOps.replaceWith")}
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {ops.replaceKinds.map((kind) => (
                <ContextMenuItem key={kind.kind} onSelect={() => ops.replace(kind.kind)}>
                  {kind.label}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        ) : null}
        <ContextMenuItem onSelect={ops.addToLibrary}>
          <Library aria-hidden="true" />
          {t("charts.dashboard.tileOps.addToLibrary")}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={ops.copy}>
          <Copy aria-hidden="true" />
          {t("charts.dashboard.tileOps.copy")}
          <ContextMenuShortcut aria-hidden="true">⌘C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={ops.cut}>
          <Scissors aria-hidden="true" />
          {t("charts.dashboard.tileOps.cut")}
          <ContextMenuShortcut aria-hidden="true">⌘X</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={ops.paste}>
          <ClipboardPaste aria-hidden="true" />
          {t("charts.dashboard.tileOps.paste")}
          <ContextMenuShortcut aria-hidden="true">⌘V</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={ops.pasteAndReplace}>
          <ClipboardPaste aria-hidden="true" />
          {t("charts.dashboard.tileOps.pasteAndReplace")}
        </ContextMenuItem>
        <ContextMenuSeparator />
        {ops.fitMode ? (
          <>
            <ContextMenuItem onSelect={ops.bringForward}>
              <ArrowUpToLine aria-hidden="true" />
              {t("charts.dashboard.tileOps.bringForward")}
            </ContextMenuItem>
            <ContextMenuItem onSelect={ops.sendBackward}>
              <ArrowDownToLine aria-hidden="true" />
              {t("charts.dashboard.tileOps.sendBackward")}
            </ContextMenuItem>
          </>
        ) : null}
        <ContextMenuItem onSelect={ops.toggleLock}>
          {ops.locked ? <LockOpen aria-hidden="true" /> : <Lock aria-hidden="true" />}
          {ops.locked ? t("charts.dashboard.edit.unlock") : t("charts.dashboard.edit.lock")}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={ops.remove} className="text-destructive-text">
          <Trash2 aria-hidden="true" />
          {t("charts.dashboard.tileOps.delete")}
          <ContextMenuShortcut aria-hidden="true">⌫</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
