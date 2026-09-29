import { FlowMiniMap, Panel, ZoomControls } from "@elabs-ai/components-flow";

/** One navigation panel; compact canvases keep just the zoom and fit controls. */
export function CanvasNavigation() {
  return (
    <Panel
      position="bottom-right"
      data-slot="canvas-navigation"
      className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface-elevated shadow-ring-sm"
    >
      <FlowMiniMap
        position="bottom-right"
        pannable
        zoomable
        className="!rounded-none !shadow-none @max-3xl:hidden"
      />
      <ZoomControls className="rounded-none border-border shadow-none @3xl:border-t [&_button]:flex-1" />
    </Panel>
  );
}
