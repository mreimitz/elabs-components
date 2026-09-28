/**
 * DG-23 — the well a thumbnail slot shows when it has no image yet: the recent cards, the
 * template picker and the components panel all show it the same way (`thumbnail.ts` decides
 * whether a request is made at all; this is what `Image`'s `fallback` renders when it is not).
 */
import { Text } from "@elabs-ai/components-ui";
import { Workflow } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

/** In one place (`conventions/i18n-strings`). */
export const NO_PREVIEW_LABEL = "No preview yet";

export interface NoPreviewProps {
  /** Defaults to the diagram glyph (`Workflow`); the components panel uses `Boxes` instead. */
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
}

export function NoPreview({ icon: Icon = Workflow }: NoPreviewProps) {
  return (
    <span className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
      <Icon aria-hidden="true" className="size-6" />
      <Text variant="meta" tone="muted" as="span">
        {NO_PREVIEW_LABEL}
      </Text>
    </span>
  );
}
