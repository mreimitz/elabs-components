import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap touch-manipulation rounded-control text-body font-control transition-[color,background-color,border-color,box-shadow,scale] duration-fast ease-standard active:scale-[0.98] motion-reduce:active:scale-100 focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive-hover active:bg-destructive-active disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        // The calm "outlined but quiet" rung (#194, research 02 §3a). `outline` uses
        // the form-field `border-input` token, `outline-subtle` uses `border-border`.
        // Since the ADR 0010 Amendment (2026-06-20) returned `--input` to the subtle
        // rung, these two are now VISUALLY IDENTICAL by default — both variant names
        // are kept as a SEMANTIC SEAM (a future brand could re-separate `--input` from
        // `--border`) and to avoid churning `outline-subtle` callers (e.g.
        // change-review.tsx). `outline` stays for genuinely form-adjacent controls.
        "outline-subtle":
          "border border-border bg-background hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        // #399 — a link button is TEXT on the page: `--link` defaults to the
        // on-surface `--primary-text` rung; `bg-primary` above keeps the fill rung.
        link: "text-link underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-control-sm px-3 text-meta",
        default: "h-control px-4 py-2",
        lg: "h-control-lg px-6",
        icon: "size-control",
        "icon-sm": "size-control-sm",
        "icon-lg": "size-control-lg",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Render the child element as the button (Radix Slot) instead of a <button>. */
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      type={asChild ? undefined : (type ?? "button")}
      {...props}
    />
  );
});
