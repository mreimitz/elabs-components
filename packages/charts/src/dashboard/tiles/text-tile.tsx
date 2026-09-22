"use client";

import { Type } from "lucide-react";
import { cn } from "@elabs-ai/components-ui";

import type { DashboardTileKind, DashboardTileProps } from "../dashboard-sheet/tile-registry";
import { renderInlineMarkup } from "./inline-markup";

/** Content of a `text` tile: a small inline-markup body (`inline-markup.ts`). */
export interface TextTileContent {
  body: string;
  align?: "start" | "center" | "end";
}

const ALIGN_CLASS: Record<NonNullable<TextTileContent["align"]>, string> = {
  start: "text-start",
  center: "text-center",
  end: "text-end",
};

function TextTile({ tile }: DashboardTileProps<TextTileContent>) {
  const { body, align = "start" } = tile.content;
  return (
    <div
      data-slot="text-tile"
      className={cn(
        "size-full min-h-0 overflow-hidden text-body text-foreground",
        ALIGN_CLASS[align],
      )}
    >
      {renderInlineMarkup(body)}
    </div>
  );
}

/** `text` — a minimal inline-markup body (bold, italic, https links, bullets). */
export function createTextTileKind(kind = "text"): DashboardTileKind<TextTileContent> {
  return {
    kind,
    label: "Text", // i18n-exempt: asset-panel label, not user-facing tile content
    icon: Type,
    description: "A paragraph of notes or definitions.", // i18n-exempt: asset-panel description
    component: TextTile,
    defaultSize: { w: 6, h: 3 },
    minSize: { w: 2, h: 1 },
    capabilities: { expand: true },
    configForm: {
      formName: `${kind}-tile`,
      fields: [
        { type: "string", name: "body", label: "Text", required: true, multiline: true },
        {
          type: "enum",
          name: "align",
          label: "Alignment",
          options: ["start", "center", "end"],
          default: "start",
        },
      ],
    },
    defaultContent: { body: "" },
  };
}

/** `createTextTileKind()` — the `text` kind. */
export const textTileKind = createTextTileKind();
