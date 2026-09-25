"use client";

import { Panel, useReactFlow, type PanelPosition } from "@xyflow/react";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { useFlowMessage } from "../lib/flow-messages";

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
      className="flex size-8 items-center justify-center text-foreground transition-colors duration-fast hover:bg-surface-muted focus-ring-inset [&_svg]:size-4"
    >
      {children}
    </button>
  );
}

/**
 * Branded zoom in / out / fit controls. Render inside <CanvasShell>.
 *
 * The three accessible names resolve through the nearest `LocaleProvider`
 * (`flow.zoomControls.zoomIn` / `zoomOut` / `fitView`), with English defaults.
 */
export function ZoomControls({ position = "bottom-right", className }: ZoomControlsProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const msg = useFlowMessage();
  return (
    <Panel position={position}>
      <div
        data-slot="zoom-controls"
        className={cn(
          "flex divide-x overflow-hidden rounded-lg bg-surface-elevated shadow-ring-sm",
          className,
        )}
      >
        <ControlButton label={msg("flow.zoomControls.zoomIn")} onClick={() => zoomIn()}>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </ControlButton>
        <ControlButton label={msg("flow.zoomControls.zoomOut")} onClick={() => zoomOut()}>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M5 12h14" />
          </svg>
        </ControlButton>
        <ControlButton label={msg("flow.zoomControls.fitView")} onClick={() => fitView()}>
          <svg
            aria-hidden="true"
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
