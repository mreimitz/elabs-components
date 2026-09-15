import { forwardRef, type ForwardRefExoticComponent, type RefAttributes } from "react";
import { GripVertical } from "lucide-react";
import * as ResizablePrimitive from "react-resizable-panels";
import { cn } from "../../lib/cn";

export const ResizablePanelGroup: ForwardRefExoticComponent<
  React.ComponentProps<typeof ResizablePrimitive.PanelGroup> &
    RefAttributes<ResizablePrimitive.ImperativePanelGroupHandle>
> = forwardRef<
  ResizablePrimitive.ImperativePanelGroupHandle,
  React.ComponentProps<typeof ResizablePrimitive.PanelGroup>
>(function ResizablePanelGroup({ className, ...props }, ref) {
  return (
    <ResizablePrimitive.PanelGroup
      ref={ref}
      className={cn("flex size-full data-[panel-group-direction=vertical]:flex-col", className)}
      {...props}
    />
  );
});

export const ResizablePanel = ResizablePrimitive.Panel;

/**
 * The visible line stays 1px (`w-px`); the DRAG hit area is expanded via the
 * primitive's own `hitAreaMargins` (pointer-distance based, not a CSS trick),
 * so pointer/touch users get a ≥16px target without widening what's drawn.
 * Callers can still override `hitAreaMargins` explicitly.
 */
const DEFAULT_HIT_AREA_MARGINS: ResizablePrimitive.PointerHitAreaMargins = {
  coarse: 15,
  fine: 8,
};

/**
 * NOT wrapped in `forwardRef`: `react-resizable-panels`' `PanelResizeHandle`
 * is a plain function component that hardcodes its own internal element ref
 * and does not accept `ref` as a prop at all (neither in its types nor at
 * runtime — verified: a `ref` passed to it resolves to `null`). There is no
 * DOM node here for a wrapper ref to attach to without changing what render
 * onto the actual drag surface, so adding `forwardRef` would be a dead prop.
 */
export function ResizableHandle({
  withHandle,
  className,
  hitAreaMargins,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & { withHandle?: boolean }) {
  return (
    <ResizablePrimitive.PanelResizeHandle
      hitAreaMargins={hitAreaMargins ?? DEFAULT_HIT_AREA_MARGINS}
      className={cn(
        "relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-ring",
        "data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0",
        className,
      )}
      {...props}
    >
      {withHandle && (
        <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
          <GripVertical className="size-2.5" />
        </div>
      )}
    </ResizablePrimitive.PanelResizeHandle>
  );
}
