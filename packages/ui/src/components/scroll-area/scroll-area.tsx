import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { cn } from "../../lib/cn";

export interface ScrollAreaProps extends ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> {
  /**
   * Props for the scrolling VIEWPORT — the element that actually overflows, which is
   * otherwise unreachable from the outside.
   *
   * The viewport is deliberately NOT focusable by default: when the content inside it is
   * focusable (a list of links, rows of buttons) a keyboard user reaches the overflow by
   * tabbing through it, and a tab stop on the viewport would be noise. When the content is
   * plain text or non-focusable rows, that same user cannot scroll it at all — axe's
   * `scrollable-region-focusable` is the gate that catches it. Make it a named tab stop the
   * way `ChartFrame` does for its scrolling body:
   *
   * ```tsx
   * viewportProps={{ tabIndex: 0, role: "group", "aria-label": "Scrollable list" }}
   * ```
   *
   * `role="group"` rather than `"region"`: ARIA 1.2 forbids `aria-label` on a generic
   * element, and `group` gives the name a host without adding a landmark.
   */
  viewportProps?: ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Viewport>;
}

export const ScrollArea = forwardRef<ElementRef<typeof ScrollAreaPrimitive.Root>, ScrollAreaProps>(
  function ScrollArea({ className, children, viewportProps, ...props }, ref) {
    return (
      <ScrollAreaPrimitive.Root
        ref={ref}
        className={cn("relative overflow-hidden", className)}
        {...props}
      >
        <ScrollAreaPrimitive.Viewport
          {...viewportProps}
          className={cn(
            "size-full rounded-[inherit]",
            // A viewport made focusable needs a visible ring, like every other tab stop.
            viewportProps?.tabIndex !== undefined && "focus-ring-inset",
            viewportProps?.className,
          )}
        >
          {children}
        </ScrollAreaPrimitive.Viewport>
        <ScrollBar />
        <ScrollAreaPrimitive.Corner />
      </ScrollAreaPrimitive.Root>
    );
  },
);

export const ScrollBar = forwardRef<
  ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(function ScrollBar({ className, orientation = "vertical", ...props }, ref) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      ref={ref}
      orientation={orientation}
      className={cn(
        "flex touch-none select-none transition-colors",
        orientation === "vertical" && "h-full w-2.5 border-s border-s-transparent p-px",
        orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent p-px",
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
});
