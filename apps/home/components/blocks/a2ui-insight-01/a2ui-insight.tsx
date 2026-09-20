// registry: a2ui-insight-01 — copied 2026-09-19
"use client";

/**
 * A2UI — an analytics answer the agent composed, charts included.
 *
 * "How did Q3 revenue do by region?" does not come back as a paragraph: the agent emits a
 * headline, four KPI tiles with sparklines, two charts whose TITLES are the findings, the method
 * and three follow-ups. The charts are `AutoChart` specs from the charts half of the catalog, so
 * they are the same themed, accessible charts the rest of the app uses. Clicking the UK line (or
 * the button) sends `drill-region` to the host, which answers with the next surface.
 *
 * Copy-own it: `npx shadcn add a2ui-insight-01`.
 */
import type { A2uiActionHandler, A2uiSurfaceSpec } from "@elabs-ai/components-ai";
import { toast, Toaster } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { useCallback, useState } from "react";
import { SurfaceStage } from "../a2ui-parts/surface-stage";
import { REGION_DRILL, REVENUE_INSIGHT } from "../a2ui-parts/surfaces";

const HOST_REPLIES: Record<string, string> = {
  "share-answer": "Posted to #revenue with the four sources attached.",
  "schedule-report": "Saved. You will get this every Monday at 08:00.",
  "draft-save-plan": "Drafting a save plan for Harbour Freight, Northline Rail and Calder & Wren…",
};

export function A2uiInsight({ className }: { className?: string }) {
  const [surface, setSurface] = useState<A2uiSurfaceSpec>(REVENUE_INSIGHT);

  const onAction = useCallback<A2uiActionHandler>((action) => {
    if (action.name === "drill-region") setSurface(REGION_DRILL);
    else if (action.name === "back-to-overview") setSurface(REVENUE_INSIGHT);
    else if (HOST_REPLIES[action.name]) toast(HOST_REPLIES[action.name]);
  }, []);

  return (
    <div className={cn("@container w-full", className)} data-slot="a2ui-insight">
      <SurfaceStage
        label="Analytics agent · “How did Q3 revenue do by region?”"
        onAction={onAction}
        spec={surface}
      />
      <Toaster />
    </div>
  );
}
