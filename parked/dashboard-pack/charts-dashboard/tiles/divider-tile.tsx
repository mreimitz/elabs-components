"use client";

import { Minus } from "lucide-react";
import { cn, Separator } from "@elabs-ai/components-ui";

import type { DashboardTileKind, DashboardTileProps } from "../dashboard-sheet/tile-registry";

/** Content of a `divider` tile: a shape rule (the tenant's `sn-shape`). */
export interface DividerTileContent {
  orientation?: "horizontal" | "vertical";
}

function DividerTile({ tile }: DashboardTileProps<DividerTileContent>) {
  const orientation = tile.content.orientation ?? "horizontal";
  return (
    <div
      data-slot="divider-tile"
      className={cn(
        "flex size-full min-h-0 items-center justify-center",
        orientation === "vertical" ? "px-2" : "py-2",
      )}
    >
      {/* The only structural cue in this tile — the strong rung, not the redundant one. */}
      <Separator
        orientation={orientation}
        tone="strong"
        className={orientation === "vertical" ? "h-full" : "w-full"}
      />
    </div>
  );
}

/** `divider` — a shape rule (`ui/Separator`). */
export function createDividerTileKind(kind = "divider"): DashboardTileKind<DividerTileContent> {
  return {
    kind,
    label: "Divider", // i18n-exempt: asset-panel label
    icon: Minus,
    description: "A rule between sections.", // i18n-exempt: asset-panel description
    component: DividerTile,
    defaultSize: { w: 4, h: 1 },
    minSize: { w: 1, h: 1 },
    capabilities: { expand: false, surface: "plain", padding: "none" },
    configForm: {
      formName: `${kind}-tile`,
      fields: [
        {
          type: "enum",
          name: "orientation",
          label: "Orientation",
          options: ["horizontal", "vertical"],
          default: "horizontal",
        },
      ],
    },
    defaultContent: { orientation: "horizontal" },
  };
}

/** `createDividerTileKind()` — the `divider` kind. */
export const dividerTileKind = createDividerTileKind();
