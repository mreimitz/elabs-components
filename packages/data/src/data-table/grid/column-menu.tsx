"use client";

/**
 * column-menu.tsx — the per-column options menu of DataTable / DataGrid: sort,
 * pin, move, auto-size, fit, hide and reset, plus caller items. Built on ui's
 * `DropdownMenu`; the trigger is a small icon button in the header cell that
 * shows on hover / focus, and in grid mode opens with Alt+↓ on the header.
 */
import type { ReactNode } from "react";
import { EllipsisVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  useLocale,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";

/** A caller-supplied column menu entry. */
export interface DataTableColumnMenuItem {
  id: string;
  label: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  icon?: ReactNode;
}

export interface ColumnMenuActions {
  canSort: boolean;
  sorted: false | "asc" | "desc";
  onSort: (direction: "asc" | "desc" | false) => void;
  canPin: boolean;
  pinned: false | "left" | "right";
  onPin: (edge: "left" | "right" | false) => void;
  canMove: { left: boolean; right: boolean } | null;
  onMove: (delta: -1 | 1) => void;
  canResize: boolean;
  onAutosize: () => void;
  onAutosizeAll: () => void;
  onFit: () => void;
  canHide: boolean;
  onHide: () => void;
  onReset: () => void;
}

export interface ColumnMenuProps {
  /** The column's plain-text name (trigger's accessible name). */
  label: string;
  actions: ColumnMenuActions;
  items?: DataTableColumnMenuItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Grid mode: the header CELL is the tab stop, so the trigger is not. */
  inGrid: boolean;
  dir: "ltr" | "rtl";
  /** Where focus goes when the menu closes (grid mode: back to the header cell). */
  onCloseFocus?: () => void;
}

export function ColumnMenu({
  label,
  actions,
  items,
  open,
  onOpenChange,
  inGrid,
  dir,
  onCloseFocus,
}: ColumnMenuProps) {
  const { t } = useLocale();
  const a = actions;
  // `left` / `right` pinning is logical (start / end). Under RTL the start
  // edge is on the right, so the words follow what the user sees.
  const startWord = dir === "rtl" ? t("data.table.pinRight") : t("data.table.pinLeft");
  const endWord = dir === "rtl" ? t("data.table.pinLeft") : t("data.table.pinRight");
  const backWord = dir === "rtl" ? t("data.table.moveRight") : t("data.table.moveLeft");
  const forwardWord = dir === "rtl" ? t("data.table.moveLeft") : t("data.table.moveRight");
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          tabIndex={inGrid ? -1 : undefined}
          data-slot="data-table-column-menu-trigger"
          aria-label={t("data.table.columnMenu", { name: label })}
          // Stops the header's own sort / drag from also reacting to the press.
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          className={cn(
            "relative z-10 inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-opacity duration-fast ease-standard hover:bg-foreground/10 hover:text-foreground focus-ring",
            // Quiet until the header is hovered or focused, or the menu is open.
            "opacity-0 group-hover/th:opacity-100 group-focus-within/th:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100",
          )}
        >
          <EllipsisVertical aria-hidden="true" className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[12rem]"
        onCloseAutoFocus={
          onCloseFocus
            ? (event) => {
                event.preventDefault();
                onCloseFocus();
              }
            : undefined
        }
      >
        {a.canSort && (
          <>
            <DropdownMenuItem disabled={a.sorted === "asc"} onSelect={() => a.onSort("asc")}>
              {t("data.table.sortAsc")}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={a.sorted === "desc"} onSelect={() => a.onSort("desc")}>
              {t("data.table.sortDesc")}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!a.sorted} onSelect={() => a.onSort(false)}>
              {t("data.table.clearSort")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {a.canPin && (
          <>
            <DropdownMenuItem disabled={a.pinned === "left"} onSelect={() => a.onPin("left")}>
              {startWord}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={a.pinned === "right"} onSelect={() => a.onPin("right")}>
              {endWord}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!a.pinned} onSelect={() => a.onPin(false)}>
              {t("data.table.unpin")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {a.canMove && (
          <>
            <DropdownMenuItem disabled={!a.canMove.left} onSelect={() => a.onMove(-1)}>
              {backWord}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!a.canMove.right} onSelect={() => a.onMove(1)}>
              {forwardWord}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {a.canResize && (
          <>
            <DropdownMenuItem onSelect={a.onAutosize}>
              {t("data.table.autosizeColumn")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={a.onAutosizeAll}>
              {t("data.table.autosizeAll")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={a.onFit}>{t("data.table.fitColumns")}</DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {a.canHide && (
          <DropdownMenuItem onSelect={a.onHide}>{t("data.table.hideColumn")}</DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={a.onReset}>{t("data.table.resetColumns")}</DropdownMenuItem>
        {items && items.length > 0 && (
          <>
            <DropdownMenuSeparator />
            {items.map((item) => (
              <DropdownMenuItem key={item.id} disabled={item.disabled} onSelect={item.onSelect}>
                {item.icon}
                {item.label}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
