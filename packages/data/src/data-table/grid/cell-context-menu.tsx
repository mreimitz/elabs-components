"use client";

/**
 * cell-context-menu.tsx — DataGrid's right-click (and Shift+F10 / ContextMenu
 * key) menu on body cells: Copy, Copy with headers, Export to CSV, plus
 * caller items for the clicked row / column. Built on ui's `ContextMenu`.
 */
import type { ReactNode } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
  useLocale,
} from "@elabs-ai/components-ui";

/** A caller-supplied context menu entry. */
export interface DataTableContextMenuItem {
  id: string;
  label: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  icon?: ReactNode;
}

export interface CellContextMenuProps {
  children: ReactNode;
  enabled: boolean;
  onCopy: (withHeaders: boolean) => void;
  onExportCsv?: () => void;
  onExportXlsx?: () => void;
  items?: DataTableContextMenuItem[];
  /** Fires before the menu opens, with the element that was right-clicked. */
  onOpenAt: (target: HTMLElement) => void;
  /** Platform modifier glyph for the shortcut hint. */
  shortcutPrefix: string;
}

export function CellContextMenu({
  children,
  enabled,
  onCopy,
  onExportCsv,
  onExportXlsx,
  items,
  onOpenAt,
  shortcutPrefix,
}: CellContextMenuProps) {
  const { t } = useLocale();
  if (!enabled) return <>{children}</>;
  return (
    <ContextMenu>
      <ContextMenuTrigger
        asChild
        onContextMenu={(event) => {
          const target = event.target as HTMLElement;
          // Only body cells open the grid menu; headers keep the column menu.
          if (!target.closest("[data-grid-row]")) {
            event.preventDefault();
            return;
          }
          onOpenAt(target);
        }}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-[12rem]">
        <ContextMenuItem onSelect={() => onCopy(false)}>
          {t("copy")}
          <ContextMenuShortcut>{shortcutPrefix}C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onCopy(true)}>
          {t("data.table.copyWithHeaders")}
        </ContextMenuItem>
        {onExportCsv && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={onExportCsv}>{t("data.table.exportCsv")}</ContextMenuItem>
            {onExportXlsx && (
              <ContextMenuItem onSelect={onExportXlsx}>
                {t("data.table.exportXlsx")}
              </ContextMenuItem>
            )}
          </>
        )}
        {items && items.length > 0 && (
          <>
            <ContextMenuSeparator />
            {items.map((item) => (
              <ContextMenuItem key={item.id} disabled={item.disabled} onSelect={item.onSelect}>
                {item.icon}
                {item.label}
              </ContextMenuItem>
            ))}
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
