"use client";

import { Image } from "lucide-react";
import { cn } from "@elabs-ai/components-ui";

import type { DashboardSpecError } from "../core/spec";
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

/** `alt` is required — enforced twice: the config form's `required: true` AND this
 * runtime check, so content written before that rule existed (or built by a host
 * bypassing the form) still fails a validator that calls it. */
function validateImageContent(content: ImageTileContent): DashboardSpecError | null {
  if (!content.alt || content.alt.trim() === "") {
    return { path: "content.alt", code: "missing", message: "image tile: alt text is required" };
  }
  return null;
}

/**
 * `image` — a static image. `alt` is required (config form's `required: true`, plus
 * `validateContent` for a host or test that builds content without the form).
 */
export function createImageTileKind(kind = "image"): DashboardTileKind<ImageTileContent> {
  return {
    kind,
    label: "Image", // i18n-exempt: asset-panel label
    icon: Image,
    description: "A logo or picture from a URL.", // i18n-exempt: asset-panel description
    component: ImageTile,
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 2, h: 2 },
    capabilities: { expand: true },
    validateContent: validateImageContent,
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
