"use client";
/**
 * The hero's visual: a masonry wall of working component compositions. Column flow (CSS
 * multi-column) keeps each tile at its natural height, so nothing is cropped or stretched to
 * fit a grid cell. Reading order is DOM order, top to bottom per column.
 */
import { COMPONENT_RENDERS } from "./component-tiles";
import { WALL_TILE_META, type ComponentTileMeta } from "./component-tile-meta";
import { galleryCopy } from "../../content/copy";

export function TileColumns({ tiles }: { tiles: ComponentTileMeta[] }) {
  return (
    <div className="columns-1 gap-4 md:columns-2 xl:columns-3">
      {tiles.map((tile) => (
        <div key={tile.id} data-tile={tile.id} className="mb-4 break-inside-avoid">
          {COMPONENT_RENDERS[tile.id]()}
        </div>
      ))}
    </div>
  );
}

export function ComponentWall() {
  return (
    <div role="region" aria-label={galleryCopy.wall.label} data-slot="component-wall">
      <TileColumns tiles={WALL_TILE_META} />
    </div>
  );
}
