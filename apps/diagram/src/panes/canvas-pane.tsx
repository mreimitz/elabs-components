import {
  CanvasShell,
  FlowMiniMap,
  ReactFlowProvider,
  ZoomControls,
} from "@elabs-ai/components-flow";

/**
 * The right-hand canvas. Empty until DG-06/DG-09 compile the YAML into
 * nodes/edges — this proves the frame only. `CanvasShell` renders its own
 * `Background` (default `background=true`), so no second one is added here.
 */
export function CanvasPane() {
  return (
    <ReactFlowProvider>
      <CanvasShell nodes={[]} edges={[]} fitView proOptions={{ hideAttribution: true }}>
        {/*
         * Both default to `position="bottom-right"` (React Flow's own
         * MiniMap default), which stacks the minimap directly over the zoom
         * controls — moving the minimap to the other bottom corner is the
         * established pattern (registry/blocks/flow-builder,
         * data-model-viewer-01, agent-designer-01), not a DG-02 invention.
         */}
        <FlowMiniMap position="bottom-left" pannable zoomable />
        <ZoomControls />
      </CanvasShell>
    </ReactFlowProvider>
  );
}
