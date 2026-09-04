import { forwardRef, type ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";
import { Button } from "../button";
import { Input } from "../input";
import { Textarea } from "../textarea";

export const inputGroupVariants = cva(
  cn(
    "group/input-group relative flex w-full flex-wrap items-center rounded-md outline-none transition-[color,box-shadow] duration-fast ease-standard",
    // Grow to fit a textarea even when it's nested (e.g. wrapped in a
    // `display:contents` body like PromptInputBody). `:has(>textarea)`
    // misses through that wrapper, so match any descendant textarea.
    "h-9 has-[textarea]:h-auto",
    "has-[[data-slot=input-group-control]:focus-visible]:focus-ring-static has-[[data-slot=input-group-control]:focus-visible]:ring-offset-1 has-[[data-slot=input-group-control]:focus-visible]:ring-offset-background has-[[data-slot=input-group-control]:focus-visible]:outline-1 has-[[data-slot=input-group-control]:focus-visible]:outline-ring-contour has-[[data-slot=input-group-control]:focus-visible]:outline-offset-[3px]",
    "has-[[data-slot=input-group-control][aria-invalid=true]]:ring-2 has-[[data-slot=input-group-control][aria-invalid=true]]:ring-destructive",
  ),
  {
    variants: {
      variant: {
        // The form-field look: the strong `--input` boundary is the field's
        // sole structural cue, so it stays on the strong rung.
        outline: "border border-input shadow-sm",
        // The composer look (#194, research 08 §C.1/§D): a soft fill with the
        // focus-within ring carrying focus — NO hard border. Separation comes
        // from the fill (the chat footer already draws its own `border-t`).
        surface: "bg-surface-muted",
        // The double-card well (#254): a `bg-card` fill meant to nest inside
        // an ALREADY-tinted outer frame (e.g. `bg-surface-muted`) — the outer
        // tint is the redundant/complementary cue, so the well itself needs no
        // border either. NOT universally "white": `--card`'s lightness
        // relative to `--surface-muted` is theme-driven, same trade-off as the
        // `bg-surface-muted`-as-a-well note above — raised (lighter than the
        // outer frame) on light themes, recessed (darker) on dark and
        // a low-chroma palette. The well still reads as a distinct, legible tone in every
        // theme; only the light-themes' "raised" framing is theme-specific.
        card: "bg-card",
      },
    },
    defaultVariants: { variant: "outline" },
  },
);

export type InputGroupProps = ComponentProps<"div"> & VariantProps<typeof inputGroupVariants>;

export const InputGroup = forwardRef<HTMLDivElement, InputGroupProps>(function InputGroup(
  { className, variant, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      role="group"
      data-slot="input-group"
      className={cn(inputGroupVariants({ variant }), className)}
      {...props}
    />
  );
});

export const inputGroupAddonVariants = cva(
  "flex h-auto cursor-text items-center gap-2 py-1.5 text-sm font-medium text-muted-foreground select-none [&>svg:not([class*='size-'])]:size-4",
  {
    variants: {
      align: {
        "inline-start": "order-first ps-3 has-[>button]:ms-[-0.45rem]",
        "inline-end": "order-last pe-3 has-[>button]:me-[-0.45rem]",
        "block-start": "order-first w-full justify-start px-3 pt-2.5",
        "block-end": "order-last w-full justify-start px-3 pt-0 pb-2.5",
      },
    },
    defaultVariants: { align: "inline-start" },
  },
);

export const InputGroupAddon = forwardRef<
  HTMLDivElement,
  ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>
>(function InputGroupAddon({ className, align = "inline-start", ...props }, ref) {
  return (
    <div
      ref={ref}
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      {...props}
    />
  );
});

const inputGroupButtonVariants = cva("flex items-center gap-2 text-sm shadow-none", {
  variants: {
    size: {
      xs: "h-6 gap-1 rounded-sm px-2 has-[>svg]:px-2 [&>svg:not([class*='size-'])]:size-3.5",
      sm: "h-8 gap-1.5 rounded-md px-2.5 has-[>svg]:px-2.5",
      "icon-xs": "size-6 rounded-sm p-0 has-[>svg]:p-0",
      "icon-sm": "size-8 p-0 has-[>svg]:p-0",
    },
  },
  defaultVariants: { size: "xs" },
});

export const InputGroupButton = forwardRef<
  HTMLButtonElement,
  Omit<ComponentProps<typeof Button>, "size"> & {
    size?: "xs" | "sm" | "icon-xs" | "icon-sm";
  }
>(function InputGroupButton(
  { className, type = "button", variant = "ghost", size = "xs", ...props },
  ref,
) {
  return (
    <Button
      ref={ref}
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  );
});

export const InputGroupText = forwardRef<HTMLSpanElement, ComponentProps<"span">>(
  function InputGroupText({ className, ...props }, ref) {
    return (
      <span
        ref={ref}
        className={cn(
          "flex items-center gap-2 text-sm text-muted-foreground [&_svg:not([class*='size-'])]:size-4",
          className,
        )}
        {...props}
      />
    );
  },
);

export const InputGroupInput = forwardRef<HTMLInputElement, ComponentProps<typeof Input>>(
  function InputGroupInput({ className, ...props }, ref) {
    return (
      <Input
        ref={ref}
        data-slot="input-group-control"
        className={cn(
          "flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
          className,
        )}
        {...props}
      />
    );
  },
);

export const InputGroupTextarea = forwardRef<HTMLTextAreaElement, ComponentProps<typeof Textarea>>(
  function InputGroupTextarea({ className, ...props }, ref) {
    return (
      <Textarea
        ref={ref}
        data-slot="input-group-control"
        className={cn(
          "flex-1 resize-none rounded-none border-0 bg-transparent py-2.5 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
          className,
        )}
        {...props}
      />
    );
  },
);
