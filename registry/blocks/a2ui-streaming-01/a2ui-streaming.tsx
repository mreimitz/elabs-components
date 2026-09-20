"use client";

/**
 * A2UI — the screen builds up while the agent is still writing.
 *
 * Left: the JSON as it arrives. Right: what `A2uiSurface` makes of that PREFIX — it closes the
 * open brackets, leaves out the nodes that do not validate yet, and paints the rest. No spinner
 * until the last token; a reader sees the headline first and the table when it is ready.
 *
 * Copy-own it: `npx shadcn add a2ui-streaming-01`.
 */
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { JsonPane } from "@/components/a2ui-parts/json-pane";
import { SurfaceStage } from "@/components/a2ui-parts/surface-stage";
import { ROLLOUT_PLAN } from "@/components/a2ui-parts/surfaces";

export function A2uiStreaming({ className }: { className?: string }) {
  return (
    <div className={cn("@container w-full", className)} data-slot="a2ui-streaming">
      <SurfaceStage label="Release agent · search-ranker v3" spec={ROLLOUT_PLAN}>
        {(stream) => (
          <div className="order-first flex h-96 min-w-0 flex-col overflow-hidden rounded-lg border border-border @3xl:order-none @3xl:h-auto @3xl:max-h-[44rem] @3xl:w-2/5">
            <p className="flex items-center justify-between border-b border-border px-3 py-2 text-meta text-muted-foreground">
              <span>tool result · application/a2ui+json</span>
              <span className="tabular-nums">
                {stream.text.length.toLocaleString("en-US")} /{" "}
                {stream.full.length.toLocaleString("en-US")} bytes
              </span>
            </p>
            <JsonPane
              className="min-h-0 flex-1"
              isStreaming={stream.isStreaming}
              text={stream.text}
            />
          </div>
        )}
      </SurfaceStage>
    </div>
  );
}
