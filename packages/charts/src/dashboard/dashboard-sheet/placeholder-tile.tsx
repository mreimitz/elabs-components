"use client";

import type { DashboardTileKind, DashboardTileProps } from "./tile-registry";

/** Content of a `placeholder` tile: an optional note shown in the body. */
export interface PlaceholderTileContent {
  note?: string;
}

function PlaceholderTile({ tile, size, density }: DashboardTileProps<PlaceholderTileContent>) {
  return (
    <div
      data-slot="placeholder-tile"
      className="flex size-full min-h-0 flex-col items-center justify-center gap-1 rounded-md bg-surface-muted p-2 text-center"
    >
      <span className="text-meta text-muted-foreground">{tile.content?.note ?? tile.kind}</span>
      {density === "xs" ? null : (
        <span className="text-caption tabular-nums text-muted-foreground">
          {size.w}×{size.h}
        </span>
      )}
    </div>
  );
}

/**
 * The one kind this layer ships: a neutral body naming the tile and its cell size. Stories and
 * tests register it for every kind a fixture uses; the real kinds are RM-075/076.
 */
export function createPlaceholderTileKind(
  kind = "placeholder",
): DashboardTileKind<PlaceholderTileContent> {
  return {
    kind,
    label: "Placeholder", // i18n-exempt: asset-panel label of a story/test-only kind
    component: PlaceholderTile,
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 2, h: 2 },
    capabilities: { expand: true },
    configForm: { formName: `${kind}-tile`, fields: [] },
    defaultContent: {},
  };
}

/** `createPlaceholderTileKind()` — the `placeholder` kind. */
export const placeholderTileKind = createPlaceholderTileKind();
