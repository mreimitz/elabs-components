import type { NodeProps } from "@elabs-ai/components-flow";
import { cn } from "@elabs-ai/components-ui";
import type { LanePanelNodeType } from "./visual-node-data";

/**
 * A lane's panel (the visual lens's "zone", `docs/2026-09-27-visual-lens-concept.md` §3 rule
 * 1): a plain, neutral region behind its boxes. A lane mixes owners (its boxes each carry
 * their own, see `capability-box-node.tsx`), so unlike a technical zone, the panel itself
 * takes no owner colouring; only the structural `bg-surface-muted`/`border` a `Card`-less
 * region gets (conventions "Surface separation"). Never interactive: no handles, no drag.
 */
export function LanePanelNode({ data }: NodeProps<LanePanelNodeType>) {
  return (
    <div
      data-slot="lane-panel"
      className={cn(
        "h-full w-full rounded-lg border border-border bg-surface-muted",
        "flex flex-col",
      )}
    >
      <div
        data-slot="lane-panel-title"
        className="text-meta shrink-0 truncate px-3 py-2 font-medium tracking-wide text-muted-foreground uppercase"
      >
        {data.title}
      </div>
    </div>
  );
}
