import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap touch-manipulation rounded-control text-body font-control transition-[color,background-color,border-color,box-shadow,scale] duration-fast ease-standard active:scale-[0.98] motion-reduce:active:scale-100 focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Disabled treatment is ONE rule for every variant, inherited from the
        // base string above (`disabled:pointer-events-none disabled:opacity-50`)
        // — no per-variant fill swap. A solid-fill variant fading via opacity
        // still reads as "off" against `--muted`/`--background` in both themes;
        // keeping one mechanism (vs. a bg-muted swap on some variants only) is
        // what made Input's disabled state internally inconsistent (#286).
        default:
          "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active",
        // `inset-ring`, not `border`: a real border would widen the plate by 2px.
        // `--secondary-border` defaults to transparent (today's borderless plate);
        // a theme can give the neutral button an edge without switching variants.
        secondary:
          "inset-ring inset-ring-secondary-border bg-secondary text-secondary-text hover:bg-secondary/80",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive-hover active:bg-destructive-active",
        // `text-foreground` is load-bearing, not decoration: an outline button
        // paints its OWN `bg-background` plate, so inheriting the surrounding
        // ink turns it invisible on a coloured band (a `bg-primary` CTA handed
        // it `--primary-foreground`, 1.06:1 against its own plate). A caller's
        // own `text-*` still wins through `cn()`.
        outline:
          "border border-button-outline-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
        // The calm "outlined but quiet" rung (#194, research 02 §3a). `outline` uses
        // `--button-outline-border` (default `var(--input)`, split from the
        // form-field token), `outline-subtle` uses `border-border`. Since the ADR
        // 0010 Amendment (2026-06-20) returned `--input` to the subtle rung, these
        // two are now VISUALLY IDENTICAL by default — both variant names are kept
        // as a SEMANTIC SEAM (a theme can now give buttons and text fields
        // different edges) and to avoid churning `outline-subtle` callers (e.g.
        // change-review.tsx). `outline` stays for genuinely form-adjacent controls.
        "outline-subtle":
          "border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
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
