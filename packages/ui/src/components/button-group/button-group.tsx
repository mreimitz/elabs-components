import { forwardRef, type ComponentProps } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";
import { Separator } from "../separator";

export const buttonGroupVariants = cva(
  "flex w-fit items-stretch [&>*]:relative [&>*]:focus-within:z-10 has-[>[data-slot=button-group]]:gap-2",
  {
    variants: {
      orientation: {
        horizontal:
          "[&>*:not(:first-child)]:rounded-s-none [&>*:not(:first-child)]:border-s-0 [&>*:not(:last-child)]:rounded-e-none",
        vertical:
          "flex-col [&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t-0 [&>*:not(:last-child)]:rounded-b-none",
      },
    },
    defaultVariants: { orientation: "horizontal" },
  },
);

export const ButtonGroup = forwardRef<
  HTMLDivElement,
  ComponentProps<"div"> & VariantProps<typeof buttonGroupVariants>
>(function ButtonGroup({ className, orientation = "horizontal", ...props }, ref) {
  return (
    <div
      ref={ref}
      role="group"
      data-slot="button-group"
      data-orientation={orientation}
      className={cn(buttonGroupVariants({ orientation }), className)}
      {...props}
    />
  );
});

export const ButtonGroupText = forwardRef<
  HTMLDivElement,
  ComponentProps<"div"> & { asChild?: boolean }
>(function ButtonGroupText({ className, asChild = false, ...props }, ref) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      ref={ref}
      className={cn(
        "flex items-center gap-2 rounded-md border bg-muted px-4 text-sm font-medium shadow-sm [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
});

export const ButtonGroupSeparator = forwardRef<HTMLDivElement, ComponentProps<typeof Separator>>(
  function ButtonGroupSeparator({ className, orientation = "vertical", ...props }, ref) {
    return (
      <Separator
        ref={ref}
        data-slot="button-group-separator"
        orientation={orientation}
        className={cn(
          "relative !m-0 self-stretch bg-input data-[orientation=vertical]:h-auto",
          className,
        )}
        {...props}
      />
    );
  },
);
