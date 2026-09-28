import { useEffect, useRef } from "react";
// P4: flow does not export its engine's imperative store; no React rerender per camera frame.
import { useStoreApi } from "@xyflow/react";
import { startParticles } from "./engine";
import { useParticlePreference } from "./preference";

/** HTML sibling of SVG edges, before node/label paint. The bounded bitmap never receives input. */
export function ParticleLayer({ enabled }: { enabled: boolean }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const store = useStoreApi();
  const { paused, reduced } = useParticlePreference();
  useEffect(() => {
    const pane = anchor.current?.closest<HTMLElement>(".react-flow");
    const viewport = pane?.querySelector<HTMLElement>(".react-flow__viewport");
    const nodes = viewport?.querySelector<HTMLElement>(".react-flow__nodes");
    if (!enabled || paused || reduced || !pane || !viewport || !nodes) return;
    const canvas = document.createElement("canvas");
    canvas.dataset.slot = "flow-particles";
    canvas.dataset.diagramExport = "exclude";
    canvas.setAttribute("aria-hidden", "true");
    canvas.className = "pointer-events-none absolute start-0 top-0 origin-top-left";
    viewport.insertBefore(canvas, nodes);
    const dispose = startParticles({ canvas, pane, viewport: () => store.getState().transform });
    return () => {
      dispose();
      canvas.remove();
    };
  }, [enabled, paused, reduced, store]);
  return <span ref={anchor} hidden data-diagram-export="exclude" />;
}
