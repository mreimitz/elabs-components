"use client";

import { useEffect } from "react";
import type MapLibreGL from "maplibre-gl";

import { PLAN_STATUSES, PLAN_STATUS_ENCODING, type PlanPatternKind } from "./plan-status";

/**
 * Seamless hatch tiles for the status channel, generated on a canvas and handed
 * to `map.addImage`. Generated rather than fetched: a blank plan style has no
 * sprite and no glyph endpoint, and a texture that needs the network is a
 * texture that sometimes is not there.
 *
 * The tile geometry mirrors `SeriesPatternKind` in
 * `packages/charts/src/charts/series-pattern.tsx`, so a factory plan and a
 * chart of the same data are textured alike. It is deliberately a copy: the
 * one-way dependency graph forbids maps importing charts.
 */

/** Tile edge, in px. Small enough to read at fit zoom, large enough not to moiré. */
const TILE = 16;
/** Ink alpha. The pattern is a texture over a tone wash, not a second fill. */
const INK_ALPHA = 0.55;

/** Image ids are stable and namespaced, so two plans on one map cannot collide. */
export function planPatternImageId(kind: PlanPatternKind): string {
  return `plan-pattern-${kind}`;
}

function strokeLines(
  context: CanvasRenderingContext2D,
  lines: [number, number, number, number][],
  width: number,
) {
  context.lineWidth = width;
  context.lineCap = "square";
  for (const [x1, y1, x2, y2] of lines) {
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
  }
}

/**
 * Draw one seamless tile. Returns `null` for `"none"`, and for any environment
 * with no 2D context (jsdom) — the dash channel then carries the meaning alone,
 * which is why status has two non-colour channels rather than one.
 */
export function createPlanPatternTile(
  kind: PlanPatternKind,
  ink: string,
): HTMLCanvasElement | null {
  if (kind === "none") return null;
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = TILE;
  canvas.height = TILE;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.clearRect(0, 0, TILE, TILE);
  context.globalAlpha = INK_ALPHA;
  context.strokeStyle = ink;

  // Each set of lines is drawn twice, offset by one tile, so the pattern joins
  // across tile edges instead of showing a seam.
  if (kind === "diagonal") {
    strokeLines(
      context,
      [
        [-TILE, TILE, TILE, -TILE],
        [0, TILE * 2, TILE * 2, 0],
      ],
      1.5,
    );
  } else if (kind === "cross") {
    strokeLines(
      context,
      [
        [-TILE, TILE, TILE, -TILE],
        [0, TILE * 2, TILE * 2, 0],
        [-TILE, -TILE, TILE, TILE],
        [0, 0, TILE * 2, TILE * 2],
      ],
      1.25,
    );
  } else {
    // dense: half the spacing of `diagonal`, so the two never read alike.
    strokeLines(
      context,
      [
        [-TILE, TILE / 2, TILE / 2, -TILE],
        [-TILE / 2, TILE, TILE, -TILE / 2],
        [0, TILE * 1.5, TILE * 1.5, 0],
        [TILE / 2, TILE * 2, TILE * 2, TILE / 2],
      ],
      1.25,
    );
  }

  return canvas;
}

/** Every pattern kind the status table uses, deduplicated. */
function usedPatternKinds(): PlanPatternKind[] {
  const kinds = new Set<PlanPatternKind>();
  for (const status of PLAN_STATUSES) kinds.add(PLAN_STATUS_ENCODING[status].pattern);
  kinds.delete("none");
  return [...kinds];
}

/**
 * Register (and re-register) the status textures on a map.
 *
 * Re-registration is not optional: `map.setStyle` — which a theme swap performs —
 * drops every image the style holds, and a `fill-pattern` naming a missing image
 * renders nothing at all. So the images are (re)added on `styledata` as well as
 * whenever the ink changes.
 *
 * @param ink The colour to draw the hatch in, already resolved from a token.
 */
export function usePlanPatterns(map: MapLibreGL.Map | null, isLoaded: boolean, ink: string) {
  useEffect(() => {
    if (!map || !isLoaded) return;

    const register = () => {
      for (const kind of usedPatternKinds()) {
        const tile = createPlanPatternTile(kind, ink);
        if (!tile) continue;
        const id = planPatternImageId(kind);
        const image = {
          width: tile.width,
          height: tile.height,
          data: tile.getContext("2d")?.getImageData(0, 0, tile.width, tile.height).data,
        };
        if (!image.data) continue;
        try {
          if (map.hasImage(id)) {
            map.updateImage(id, image as unknown as ImageData);
          } else {
            map.addImage(id, image as unknown as ImageData, { pixelRatio: 2 });
          }
        } catch {
          // style mid-reload; the `styledata` handler below re-runs this
        }
      }
    };

    register();
    map.on("styledata", register);

    return () => {
      map.off("styledata", register);
    };
  }, [map, isLoaded, ink]);
}
