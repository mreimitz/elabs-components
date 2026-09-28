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

/** The way out of presentation mode. */
function ExitButton() {
  return (
    <Button variant="outline" size="sm" onClick={exitPresentation}>
      <Minimize2 aria-hidden="true" />
      {OVERLAY_LABELS.exit}
    </Button>
  );
}

/**
 * DG-18 — everything the interactive layer draws over the canvas: the details card, the step
 * player and, while presenting, the way out — both bottom-centre, between the legend and the
 * zoom controls, with the step player rising above that row. The title block is top-left and
 * only ever reserves the top-right corner for the minimap, but its own width is the title
 * text's, not a fixed cap, so a top-centre button has no width it is guaranteed clear of; the
 * bottom row is the one spot on the pane the title block never reaches. Each is marked
 * `data-diagram-export="exclude"` or portaled, so a DG-17 export never contains it.
 */
export function InteractionOverlays({ nodes }: InteractionOverlaysProps) {
  const presenting = isPresenting(useHash());
  return (
    <>
      <DetailsCard nodes={nodes} />
      <StepPlayer />
      {presenting ? (
        <Panel position="bottom-center" data-diagram-export="exclude">
          <ExitButton />
        </Panel>
      ) : null}
    </>
  );
}
