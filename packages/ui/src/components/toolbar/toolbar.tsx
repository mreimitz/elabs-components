"use client";

/**
 * Toolbar — the ONE row that genuinely claims `role="toolbar"`.
 *
 * The role is a promise: a toolbar is a SINGLE tab stop, and the arrow keys move
 * between its controls (WAI-ARIA APG). Four rows in this repo claim the role
 * without implementing that, which is worse than not claiming it — a screen
 * reader tells the user to press the arrow keys and nothing happens. This
 * component delegates the roving tabindex to `@radix-ui/react-toolbar` so the
 * promise is kept, and exists so no one has to hand-roll it again.
 *
 * When NOT to use it. A row of ordinary controls above a list or table is a
 * `ViewToolbar` — that component deliberately does not claim the role, because
 * every control there is an ordinary tab stop and readers expect Tab, not
 * arrows. Reach for `Toolbar` when the row is DENSE and SECONDARY to the content
 * it acts on (a document's page/zoom controls, a formatting bar): collapsing a
 * dozen controls into one tab stop is what makes the content reachable again.
 *
 * Anatomy — a shell plus three composable parts. There is no `actions` prop and
 * no items array: a toolbar's layout is the caller's, so groups are arranged
 * with ordinary flex utilities and `ToolbarSeparator` between them.
 */

import * as ToolbarPrimitive from "@radix-ui/react-toolbar";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";

import { cn } from "../../lib/cn";
import { buttonVariants } from "../button";
import { toggleVariants } from "../toggle";

/* -------------------------------------------------------------------------- */
/* Root                                                                        */
/* -------------------------------------------------------------------------- */

export const toolbarVariants = cva("flex items-center gap-1", {
  variants: {
    orientation: {
      horizontal: "flex-row",
      // Radix already writes `aria-orientation`; this only lays it out.
      vertical: "h-full flex-col",
    },
  },
  defaultVariants: { orientation: "horizontal" },
});

export interface ToolbarProps
  extends
    Omit<ComponentPropsWithoutRef<typeof ToolbarPrimitive.Root>, "orientation">,
    VariantProps<typeof toolbarVariants> {
  /**
   * What this toolbar acts on ("Document", "Formatting"). A toolbar is one tab
   * stop with several controls inside it, so without a name a screen-reader
   * user lands on an anonymous group — hence required, not optional.
   */
  "aria-label": string;
}

/**
 * The row shell. Renders no surface of its own: a toolbar sits ON something
 * (a card header, a document frame) and inherits that surface, so painting a
 * background here would double the fill wherever it is placed.
 */
export const Toolbar = forwardRef<ElementRef<typeof ToolbarPrimitive.Root>, ToolbarProps>(
  function Toolbar({ className, orientation, ...props }, ref) {
    return (
      <ToolbarPrimitive.Root
        ref={ref}
        data-slot="toolbar"
        orientation={orientation ?? "horizontal"}
        className={cn(toolbarVariants({ orientation }), className)}
        {...props}
      />
    );
  },
);

/* -------------------------------------------------------------------------- */
/* Parts                                                                       */
/* -------------------------------------------------------------------------- */

export interface ToolbarButtonProps
  extends
    ComponentPropsWithoutRef<typeof ToolbarPrimitive.Button>,
    Pick<VariantProps<typeof buttonVariants>, "variant" | "size"> {}

/**
 * A control inside the toolbar. Styled with `buttonVariants` — the same ink,
 * heights and focus ring as every other button in the system, not a parallel
 * set. Icon-only controls take `size="icon-sm"` and MUST carry an `aria-label`;
 * wrap in a `Tooltip` when the glyph needs a name on screen too.
 */
export const ToolbarButton = forwardRef<
  ElementRef<typeof ToolbarPrimitive.Button>,
  ToolbarButtonProps
>(function ToolbarButton({ className, variant = "ghost", size = "sm", ...props }, ref) {
  return (
    <ToolbarPrimitive.Button
      ref={ref}
      data-slot="toolbar-button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
});

export type ToolbarSeparatorProps = ComponentPropsWithoutRef<typeof ToolbarPrimitive.Separator>;

/**
 * The divider between two groups of controls. It is the ONLY cue between two
 * same-fill regions of the row, so it takes the strong rung (WCAG 1.4.11,
 * ADR 0010) — `Separator`'s subtle default would be a decorative hairline here.
 */
export const ToolbarSeparator = forwardRef<
  ElementRef<typeof ToolbarPrimitive.Separator>,
  ToolbarSeparatorProps
>(function ToolbarSeparator({ className, ...props }, ref) {
  return (
    <ToolbarPrimitive.Separator
      ref={ref}
      data-slot="toolbar-separator"
      className={cn(
        "bg-border-strong mx-1 shrink-0",
        "data-[orientation=horizontal]:h-5 data-[orientation=horizontal]:w-px",
        "data-[orientation=vertical]:h-px data-[orientation=vertical]:w-5",
        className,
      )}
      {...props}
    />
  );
});

export type ToolbarToggleGroupProps = ComponentPropsWithoutRef<typeof ToolbarPrimitive.ToggleGroup>;

/** A set of mutually-exclusive or multi-select toggles (a view switcher, bold/italic). */
export const ToolbarToggleGroup = forwardRef<
  ElementRef<typeof ToolbarPrimitive.ToggleGroup>,
  ToolbarToggleGroupProps
>(function ToolbarToggleGroup({ className, ...props }, ref) {
  return (
    <ToolbarPrimitive.ToggleGroup
      ref={ref}
      data-slot="toolbar-toggle-group"
      className={cn("flex items-center gap-1", className)}
      {...props}
    />
  );
});

export interface ToolbarToggleItemProps
  extends
    ComponentPropsWithoutRef<typeof ToolbarPrimitive.ToggleItem>,
    Pick<VariantProps<typeof toggleVariants>, "size"> {}

/** One toggle. Shares `Toggle`'s pressed styling, so state reads the same everywhere. */
export const ToolbarToggleItem = forwardRef<
  ElementRef<typeof ToolbarPrimitive.ToggleItem>,
  ToolbarToggleItemProps
>(function ToolbarToggleItem({ className, size = "sm", ...props }, ref) {
  return (
    <ToolbarPrimitive.ToggleItem
      ref={ref}
      data-slot="toolbar-toggle-item"
      className={cn(toggleVariants({ size }), className)}
      {...props}
    />
  );
});

/**
 * An escape hatch for anything the parts above do not cover — a `Select`, an
 * input, a `DropdownMenu` trigger. `asChild` hands the roving-tabindex wiring to
 * whatever you render, so the control stays part of the arrow-key sequence
 * instead of becoming a second tab stop inside a single-tab-stop row.
 */
export const ToolbarSlot = ToolbarPrimitive.Button;
