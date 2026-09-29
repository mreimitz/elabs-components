import { FlowAnimationControl } from "../particles/animation-control";
import type { Node } from "@elabs-ai/components-flow";
import { Panel } from "@elabs-ai/components-flow";
import { Button } from "@elabs-ai/components-ui";
import { Minimize2 } from "lucide-react";
import { useHash } from "../routes/use-hash";
import { DetailsCard } from "./details-card";
import { exitPresentation, isPresenting } from "./presentation-mode";
import { StoryBar } from "../story/story-bar";

/** The overlays' strings, in one place (`conventions/i18n-strings`). */
const OVERLAY_LABELS = {
  exit: "Exit presentation",
} as const;

export interface InteractionOverlaysProps {
  /** The canvas's nodes (DiagramCanvas's state), for the details card. */
  nodes: readonly Node[];
}

/** The way out of presentation mode. */
function ExitButton() {
  return (
    <Button variant="outline" size="sm" onClick={exitPresentation}>
      <Minimize2 aria-hidden="true" />
      {OVERLAY_LABELS.exit}
    </Button>
  );
}

/** Details and stories stay with the canvas; presentation controls occupy the top-right
 * corner. All interactive overlays are excluded from exported diagram pictures. */
export function InteractionOverlays({ nodes }: InteractionOverlaysProps) {
  const presenting = isPresenting(useHash());
  return (
    <>
      <DetailsCard nodes={nodes} />
      <StoryBar />
      {presenting ? (
        <Panel position="top-right" data-slot="presentation-controls" data-diagram-export="exclude">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-elevated p-1">
            <FlowAnimationControl />
            <ExitButton />
          </div>
        </Panel>
      ) : null}
    </>
  );
}
