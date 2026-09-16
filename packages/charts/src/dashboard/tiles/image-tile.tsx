"use client";

import { cn } from "@elabs-ai/components-ui";

import type { DashboardTileKind, DashboardTileProps } from "../dashboard-sheet/tile-registry";

/** Content of an `image` tile. `alt` is required (asked in the config form). */
export interface ImageTileContent {
  src: string;
  alt: string;
  fit?: "cover" | "contain";
}

function ImageTile({ tile }: DashboardTileProps<ImageTileContent>) {
  const { src, alt, fit = "cover" } = tile.content;
  return (
    <div
      data-slot="image-tile"
      className="size-full min-h-0 overflow-hidden rounded-md bg-surface-muted"
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          className={cn("size-full", fit === "contain" ? "object-contain" : "object-cover")}
        />
      ) : null}
    </div>
  );
}

/**
 * `image` — a static image. The tile contract has no `validateContent?` hook yet
 * (RM-075 result file flags this for RM-070), so `alt` is only enforced by the
 * config form's `required: true`, not by a runtime content validator.
 */
export function createImageTileKind(kind = "image"): DashboardTileKind<ImageTileContent> {
  return {
    kind,
    label: "Image", // i18n-exempt: asset-panel label
    component: ImageTile,
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 2, h: 2 },
    capabilities: { expand: true },
    configForm: {
      formName: `${kind}-tile`,
      fields: [
        { type: "string", name: "src", label: "Image URL", required: true, format: "uri" },
        { type: "string", name: "alt", label: "Alt text", required: true },
        {
          type: "enum",
          name: "fit",
          label: "Fit",
          options: ["cover", "contain"],
          default: "cover",
        },
      ],
    },
    defaultContent: { src: "", alt: "" },
  };
}

/** `createImageTileKind()` — the `image` kind. */
export const imageTileKind = createImageTileKind();
