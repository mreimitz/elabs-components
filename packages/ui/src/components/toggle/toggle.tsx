import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

export const toggleVariants = cva(
  // Pressed (data-[state=on]) reads as a clearly-distinct, AA-safe state: an
  // accent fill + bolded label (accent/accent-foreground is a guaranteed AA
  // pair) plus a solid `primary` border as a ≥3:1 non-text boundary cue. We
  // deliberately do NOT use `bg-primary`/`text-primary-foreground`: under the
  // pre-debrand green palette that pair measured only 3.61:1 in `light`, which
  // fails AA for text labels (#148). The retuned palette flipped
  // `--primary-foreground` to near-black on a light primary and clears AA
  // comfortably, so the CONTRAST argument is spent — the shape stands on design
  // grounds instead: a pressed toggle is a secondary state and an accent fill is
  // the right weight for it. The border carries the strength; the focus ring is
  // untouched.
  //
  // Active styles are keyed on BOTH data-[state=on]: AND aria-pressed:/aria-checked:
  // (belt-and-suspenders, mirroring the `segmented` variant). A TooltipTrigger
  // asChild wrapper overwrites data-state="on" with "closed" — aria-pressed
  // (Toggle) and aria-checked (ToggleGroupItem) are set by the toggle primitive
  // alone and survive the merge. (#214)
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors duration-fast ease-standard hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground data-[state=on]:font-semibold aria-pressed:bg-accent aria-pressed:text-accent-foreground aria-pressed:font-semibold aria-checked:bg-accent aria-checked:text-accent-foreground aria-checked:font-semibold [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // `border border-transparent` reserves the 1px so the pressed
        // `border-primary` does not shift layout.
        default:
          "border border-transparent bg-transparent data-[state=on]:border-primary aria-pressed:border-primary aria-checked:border-primary",
        outline:
          "border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground data-[state=on]:border-primary aria-pressed:border-primary aria-checked:border-primary",
        // Segmented mode switch: the SAME elevation grammar as TabsTrigger —
        // raised elevated segment on a recessed `bg-muted` track (the track
        // comes from ToggleGroup `variant="segmented"`). No `border-primary`
        // here: within a group the active boundary is the fill/elevation
        // change (1.4.11 redundant boundary), and no weight shift on press
        // (labels would jiggle the segment widths).
        // Keyed off aria-checked/aria-pressed, NOT data-[state=on]: a
        // TooltipTrigger asChild wrapper overwrites the toggle's data-state
        // with the tooltip's ("closed"), silently killing the active style —
        // the aria attributes are set by the toggle primitive alone.
        segmented:
          "border-0 bg-transparent text-muted-foreground hover:bg-transparent hover:text-foreground aria-checked:bg-surface-elevated aria-checked:text-foreground aria-checked:font-medium aria-checked:shadow-sm aria-pressed:bg-surface-elevated aria-pressed:text-foreground aria-pressed:font-medium aria-pressed:shadow-sm data-[state=on]:bg-surface-elevated data-[state=on]:text-foreground data-[state=on]:font-medium data-[state=on]:shadow-sm",
      },
      size: { default: "h-9 px-2.5 min-w-9", sm: "h-8 px-2 min-w-8", lg: "h-10 px-3 min-w-10" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export const Toggle = forwardRef<
  ElementRef<typeof TogglePrimitive.Root>,
  ComponentPropsWithoutRef<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>
>(function Toggle({ className, variant, size, ...props }, ref) {
  return (
    <TogglePrimitive.Root
      ref={ref}
      className={cn(toggleVariants({ variant, size }), className)}
      {...props}
    />
  );
});
