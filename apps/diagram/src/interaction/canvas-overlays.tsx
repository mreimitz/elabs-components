import type { Node } from "@elabs-ai/components-flow";
import { Panel } from "@elabs-ai/components-flow";
import { Button } from "@elabs-ai/components-ui";
import { Minimize2 } from "lucide-react";
import { useHash } from "../routes/use-hash";
import { DetailsCard } from "./details-card";
import { exitPresentation, isPresenting } from "./presentation-mode";
import { StepPlayer } from "./step-player";

/** The overlays' strings, in one place (`conventions/i18n-strings`). */
const OVERLAY_LABELS = {
  exit: "Exit presentation",
} as const;

export interface InteractionOverlaysProps {
  /** The canvas's nodes (DiagramCanvas's state), for the details card. */
  nodes: readonly Node[];
}

/**
 * DG-18 — everything the interactive layer draws over the canvas: the details card, the step
 * player (bottom-centre) and, while presenting, the way out (top-centre, clear of the title
 * block and the minimap). Each is marked `data-diagram-export="exclude"` or portaled, so a
 * DG-17 export never contains it.
 */
export function InteractionOverlays({ nodes }: InteractionOverlaysProps) {
  const presenting = isPresenting(useHash());
  return (
    <>
      <DetailsCard nodes={nodes} />
      <StepPlayer />
      {presenting ? (
        <Panel position="top-center" data-diagram-export="exclude">
          <Button variant="outline" size="sm" onClick={exitPresentation}>
            <Minimize2 aria-hidden="true" />
            {OVERLAY_LABELS.exit}
          </Button>
        </Panel>
      ) : null}
    </>
  );
}
