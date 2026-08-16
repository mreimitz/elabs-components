import { Panel, useReactFlow, type PanelPosition } from "@xyflow/react";
import { cn } from "@elabs/components-ui/lib/cn";

export interface ZoomControlsProps {
  position?: PanelPosition;
  className?: string;
}

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-8 items-center justify-center text-foreground transition-colors duration-fast hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4"
    >
      {children}
    </button>
  );
}

/** Branded zoom in / out / fit controls. Render inside <CanvasShell>. */
export function ZoomControls({ position = "bottom-right", className }: ZoomControlsProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  return (
    <Panel position={position}>
      <div
        className={cn(
          "flex divide-x overflow-hidden rounded-lg bg-surface-elevated shadow-ring-sm",
          className,
        )}
      >
        <ControlButton label="Zoom in" onClick={() => zoomIn()}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </ControlButton>
        <ControlButton label="Zoom out" onClick={() => zoomOut()}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M5 12h14" />
          </svg>
        </ControlButton>
        <ControlButton label="Fit view" onClick={() => fitView()}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M16 21h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
        </ControlButton>
      </div>
    </Panel>
  );
}
