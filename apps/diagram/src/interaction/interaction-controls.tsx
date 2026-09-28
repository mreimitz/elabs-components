import { useEffect, useRef } from "react";
import { DropdownMenuItem, DropdownMenuSeparator, IconButton } from "@elabs-ai/components-ui";
import { ChevronsDownUp, ChevronsUpDown, Presentation } from "lucide-react";
import { isZoneNode } from "../nodes/zone-data";
import { WORKSPACE_ID } from "../shell/diagram-shell";
import { useLens } from "../shell/lens-store";
import { useDiagram } from "../state/diagram-store";
import { interactionActions } from "./interaction-store";
import { enterPresentation, takePresentReturn } from "./presentation-mode";

/** The controls' strings, in one place (`conventions/i18n-strings`). */
const CONTROL_LABELS = {
  collapseAll: "Collapse all zones",
  expandAll: "Expand all zones",
  present: "Present",
} as const;

/**
 * Present needs a drawn diagram with something on it; the zone folds need a zone in it.
 * n9: an empty ("Nothing to draw yet") document has a `graph` object with zero nodes — the
 * same "nothing to present" case as a text that does not compile at all, so both disable it.
 */
function useAvailable() {
  const hasGraph = useDiagram((s) => (s.drawn.graph?.nodes.length ?? 0) > 0);
  // These fold/open the TECHNICAL graph's zones — while the visual lens shows, that pane is
  // `inert` (`canvas-pane.tsx`), so firing either one would change a diagram the person cannot
  // currently see, with nothing on screen to show for it. Off while the visual lens is the
  // target lens, the same gate `top-bar.tsx` uses for its own technical-only controls.
  const technical = useLens((s) => s.target) === "technical";
  const graphHasZones = useDiagram((s) => s.drawn.graph?.nodes.some(isZoneNode) ?? false);
  const hasZones = technical && graphHasZones;
  return { hasGraph, hasZones };
}

export interface InteractionControlsProps {
  /** The compact top bar: nothing shows here; the actions are in its options menu. */
  compact: boolean;
}

/**
 * DG-18 — the top bar's interactive-layer controls: fold or open every zone on the canvas
 * (view-only, never written to the text) and enter presentation mode. Always mounted: back
 * from presentation mode it puts focus where presenting started.
 */
export function InteractionControls({ compact }: InteractionControlsProps) {
  const { hasGraph, hasZones } = useAvailable();
  const presentRef = useRef<HTMLButtonElement>(null);

  // Back from presentation mode (Esc, its exit button or Back): focus on Present; in the
  // compact bar (Present was a menu item, and the menu is closed) on the workspace.
  useEffect(() => {
    if (!takePresentReturn()) return;
    if (presentRef.current) presentRef.current.focus();
    else document.getElementById(WORKSPACE_ID)?.focus();
  }, []);

  if (compact) return null;
  return (
    <>
      <IconButton
        label={CONTROL_LABELS.collapseAll}
        icon={<ChevronsDownUp />}
        variant="ghost"
        size="icon-sm"
        disabled={!hasZones}
        onClick={interactionActions.collapseAll}
      />
      <IconButton
        label={CONTROL_LABELS.expandAll}
        icon={<ChevronsUpDown />}
        variant="ghost"
        size="icon-sm"
        disabled={!hasZones}
        onClick={interactionActions.expandAll}
      />
      <IconButton
        ref={presentRef}
        label={CONTROL_LABELS.present}
        icon={<Presentation />}
        variant="ghost"
        size="icon-sm"
        disabled={!hasGraph}
        onClick={enterPresentation}
      />
    </>
  );
}

/** The compact top bar's entries, inside its options menu (top-bar.tsx). */
export function InteractionMenuItems() {
  const { hasGraph, hasZones } = useAvailable();
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem disabled={!hasZones} onSelect={interactionActions.collapseAll}>
        <ChevronsDownUp aria-hidden="true" />
        {CONTROL_LABELS.collapseAll}
      </DropdownMenuItem>
      <DropdownMenuItem disabled={!hasZones} onSelect={interactionActions.expandAll}>
        <ChevronsUpDown aria-hidden="true" />
        {CONTROL_LABELS.expandAll}
      </DropdownMenuItem>
      <DropdownMenuItem disabled={!hasGraph} onSelect={enterPresentation}>
        <Presentation aria-hidden="true" />
        {CONTROL_LABELS.present}
      </DropdownMenuItem>
    </>
  );
}
