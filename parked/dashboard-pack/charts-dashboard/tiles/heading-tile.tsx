"use client";

import { Heading as HeadingIcon } from "lucide-react";
import { Heading, type HeadingLevel } from "@elabs-ai/components-ui";

import type { DashboardTileKind, DashboardTileProps } from "../dashboard-sheet/tile-registry";

/** Content of a `heading` tile: a section title at one of three levels. */
export interface HeadingTileContent {
  text: string;
  level: 1 | 2 | 3;
}

function HeadingTile({ tile }: DashboardTileProps<HeadingTileContent>) {
  const { text, level } = tile.content;
  return (
    <div data-slot="heading-tile" className="flex size-full min-h-0 items-center overflow-hidden">
      <Heading level={level as HeadingLevel} className="truncate">
        {text}
      </Heading>
    </div>
  );
}

/** `heading` — a section title (`ui/typography` `Heading`, levels 1–3). */
export function createHeadingTileKind(kind = "heading"): DashboardTileKind<HeadingTileContent> {
  return {
    kind,
    label: "Heading", // i18n-exempt: asset-panel label
    icon: HeadingIcon,
    description: "A section title across the sheet.", // i18n-exempt: asset-panel description
    component: HeadingTile,
    defaultSize: { w: 6, h: 1 },
    minSize: { w: 2, h: 1 },
    capabilities: { expand: false, surface: "plain", padding: "compact" },
    configForm: {
      formName: `${kind}-tile`,
      fields: [
        { type: "string", name: "text", label: "Text", required: true },
        { type: "integer", name: "level", label: "Level", min: 1, max: 3, default: 2 },
      ],
    },
    defaultContent: { text: "Heading", level: 2 },
  };
}

/** `createHeadingTileKind()` — the `heading` kind. */
export const headingTileKind = createHeadingTileKind();
