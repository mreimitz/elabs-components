"use client";

import { forwardRef, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { CopyPlus, Download, EllipsisVertical, Maximize2, Trash2 } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Popover,
  PopoverAnchor,
  PopoverContent,
  cn,
  useLocale,
} from "@elabs-ai/components-ui";

import type { ChartFrameMenuApi } from "../../chart-frame/chart-frame";
import type { ChartDensity } from "../../charts/chart-config-context";
import type { TileSpec } from "../core/spec";
import { useTileOps } from "../edit/tile-ops";
import type { DashboardLabels } from "./labels";

/** A host-supplied entry in a tile's kebab menu. */
export interface DashboardTileMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  onSelect: (tile: TileSpec) => void;
}

export interface DashboardTileMenuProps extends HTMLAttributes<HTMLDivElement> {
  tile: TileSpec;
  /** The frame's actions; features decide which entries exist. */
  api: ChartFrameMenuApi;
  density: ChartDensity;
  labels: DashboardLabels;
  menuItems?: DashboardTileMenuItem[];
  /**
   * Edit mode only: opens the SAME tile-ops context menu (`DashboardTileContextMenu`) that
   * wraps this tile. When set, the hover chrome becomes the EDIT chrome — Duplicate, Delete
   * and a kebab that opens that menu — instead of the view chrome (Download, Full screen,
   * view kebab). Absent outside edit mode.
   */
  onOpenTileMenu?: () => void;
}

/** The edit-mode hover chrome: Duplicate · Delete · More (opens the tile context menu). */
function DashboardTileEditMenu({
  tile,
  compact,
  onOpenTileMenu,
}: {
  tile: TileSpec;
  compact: boolean;
  onOpenTileMenu: () => void;
}) {
  const { t } = useLocale();
  const ops = useTileOps(tile.id);
  const title = tile.title ?? tile.kind;
  return (
    <>
      {!compact ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("charts.dashboard.edit.tileDuplicate", { title })}
          data-slot="dashboard-tile-menu-duplicate"
          onClick={ops.duplicate}
        >
          <CopyPlus aria-hidden="true" />
        </Button>
      ) : null}
      {!compact ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("charts.dashboard.edit.tileDelete", { title })}
          data-slot="dashboard-tile-menu-delete"
          className="hover:text-destructive-text"
          onClick={ops.remove}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("charts.dashboard.edit.tileMore", { title })}
        data-slot="dashboard-tile-menu-trigger"
        onClick={onOpenTileMenu}
      >
        <EllipsisVertical aria-hidden="true" />
      </Button>
    </>
  );
}

/**
 * The hover toolbar (download, full screen) and kebab menu (Full screen, Show details, View
 * data, Download, host items), built from the frame's features. At `xs`/`sm` only the kebab
 * stays inline. Visible on hover or keyboard focus on pointer devices; always visible on touch.
 */
export const DashboardTileMenu = forwardRef<HTMLDivElement, DashboardTileMenuProps>(
  function DashboardTileMenu(
    { tile, api, density, labels, menuItems, onOpenTileMenu, className, ...props },
    ref,
  ) {
    const [detailsOpen, setDetailsOpen] = useState(false);
    // Full screen hands focus to the expand modal, and the tile takes it back when the modal
    // closes (`DashboardTile`'s `onExpandChange`). The menu's own close-focus runs after its
    // exit animation, so a modal closed before then would lose focus to this trigger. Skip it.
    const skipCloseFocus = useRef(false);
    const canExpand = api.features.includes("expand");
    const canTable = api.features.includes("table");
    const canDownload = api.features.includes("download");
    const hasDetails = Boolean(tile.subtitle || tile.footnote || tile.source);
    const compact = density === "xs" || density === "sm";

    return (
      <div
        ref={ref}
        data-slot="dashboard-tile-menu"
        className={cn(
          "flex shrink-0 items-center gap-0.5 transition-opacity duration-fast ease-standard motion-reduce:transition-none",
          "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/tile:opacity-100 [@media(hover:hover)]:group-focus-within/tile:opacity-100 [@media(hover:hover)]:has-[[data-state=open]]:opacity-100",
          className,
        )}
        {...props}
      >
        {onOpenTileMenu ? (
          <DashboardTileEditMenu tile={tile} compact={compact} onOpenTileMenu={onOpenTileMenu} />
        ) : null}
        {!onOpenTileMenu && !compact && canDownload ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={labels.download}
            onClick={api.download}
          >
            <Download aria-hidden="true" />
          </Button>
        ) : null}
        {!onOpenTileMenu && !compact && canExpand ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={labels.fullScreen}
            data-slot="dashboard-tile-menu-expand"
            onClick={api.expand}
          >
            <Maximize2 aria-hidden="true" />
          </Button>
        ) : null}
        {onOpenTileMenu ? null : (
          <Popover open={detailsOpen} onOpenChange={setDetailsOpen}>
            <DropdownMenu>
              <PopoverAnchor asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={labels.moreActions}
                    data-slot="dashboard-tile-menu-trigger"
                  >
                    <EllipsisVertical aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
              </PopoverAnchor>
              <DropdownMenuContent
                align="end"
                onCloseAutoFocus={(event) => {
                  if (skipCloseFocus.current) event.preventDefault();
                  skipCloseFocus.current = false;
                }}
              >
                {canExpand ? (
                  <DropdownMenuItem
                    onSelect={() => {
                      skipCloseFocus.current = true;
                      api.expand();
                    }}
                  >
                    {labels.fullScreen}
                  </DropdownMenuItem>
                ) : null}
                {hasDetails ? (
                  <DropdownMenuItem onSelect={() => setDetailsOpen(true)}>
                    {labels.showDetails}
                  </DropdownMenuItem>
                ) : null}
                {canTable ? (
                  <DropdownMenuItem onSelect={api.toggleView}>
                    {api.view === "table" ? labels.viewChart : labels.viewData}
                  </DropdownMenuItem>
                ) : null}
                {canDownload ? (
                  <DropdownMenuItem onSelect={api.download}>{labels.download}</DropdownMenuItem>
                ) : null}
                {menuItems?.length ? (
                  <>
                    <DropdownMenuSeparator />
                    {menuItems.map((item) => (
                      <DropdownMenuItem key={item.id} onSelect={() => item.onSelect(tile)}>
                        {item.icon}
                        {item.label}
                      </DropdownMenuItem>
                    ))}
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
            <PopoverContent align="end" className="w-72 space-y-2">
              {tile.title ? <p className="text-subtitle text-foreground">{tile.title}</p> : null}
              {tile.subtitle ? (
                <p className="text-body text-muted-foreground">{tile.subtitle}</p>
              ) : null}
              {tile.footnote ? (
                <div>
                  <p className="text-meta text-muted-foreground">{labels.footnote}</p>
                  <p className="text-body text-foreground">{tile.footnote}</p>
                </div>
              ) : null}
              {tile.source ? (
                <div>
                  <p className="text-meta text-muted-foreground">{labels.source}</p>
                  <p className="text-body text-foreground">{tile.source}</p>
                </div>
              ) : null}
            </PopoverContent>
          </Popover>
        )}
      </div>
    );
  },
);
