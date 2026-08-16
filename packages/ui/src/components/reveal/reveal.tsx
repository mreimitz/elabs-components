import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  type CSSProperties,
  type HTMLAttributes,
  type ReactElement,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

/**
 * Entrance-animation classes (tw-animate-css), gated by the motion system: the
 * `duration-*` utility feeds `--tw-duration` (= the gated `--t-*`), so the
 * reveal slows to ~0 when motion is reduced/off. `fill-mode-both` holds the
 * start state through any stagger delay so items don't flash in early.
 */
export const revealVariants = cva("animate-in fill-mode-both", {
  variants: {
    appear: {
      // Travel ~24px (slide-*-6): below ~16px a slide reads as a flicker/pop, not
      // trackable motion — distance, not duration, is what makes it feel smooth.
      fade: "fade-in",
      up: "fade-in slide-in-from-bottom-6",
      down: "fade-in slide-in-from-top-6",
      left: "fade-in slide-in-from-right-6",
      right: "fade-in slide-in-from-left-6",
      zoom: "fade-in zoom-in-95",
    },
    speed: {
      fast: "duration-fast ease-entrance",
      base: "duration-base ease-entrance",
      slow: "duration-slow ease-entrance",
    },
  },
  defaultVariants: { appear: "up", speed: "slow" },
});

export interface RevealProps
  extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof revealVariants> {
  /** Animation delay in ms (RevealGroup sets this per child to stagger). */
  delayMs?: number;
}

/**
 * Animates its content in on mount (fade + directional slide/zoom). Gated by the
 * motion system — no animation when motion is reduced/off. For a list/grid, use
 * {@link RevealGroup} to stagger children.
 */
export const Reveal = forwardRef<HTMLDivElement, RevealProps>(function Reveal(
  { className, appear, speed, delayMs, style, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(revealVariants({ appear, speed }), className)}
      style={delayMs ? { animationDelay: `${delayMs}ms`, ...style } : style}
      {...props}
    />
  );
});

export interface RevealGroupProps
  extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof revealVariants> {
  /** Delay added per successive child, in ms. */
  staggerMs?: number;
}

type RevealableChild = ReactElement<{ className?: string; style?: CSSProperties }>;

/**
 * Staggers an entrance across direct children. Clones each child to add the
 * reveal classes + an incremental `animation-delay` — no wrapper elements, so it
 * is safe inside flex/grid layouts. Remount it (e.g. via a changing `key`) to
 * replay. Gated by the motion system.
 */
export const RevealGroup = forwardRef<HTMLDivElement, RevealGroupProps>(function RevealGroup(
  { children, className, appear, speed, staggerMs = 60, ...props },
  ref,
) {
  return (
    <div ref={ref} className={className} {...props}>
      {Children.map(children, (child, index) => {
        if (!isValidElement(child)) return child;
        const el = child as RevealableChild;
        return cloneElement(el, {
          className: cn(revealVariants({ appear, speed }), el.props.className),
          style: { animationDelay: `${index * staggerMs}ms`, ...el.props.style },
        });
      })}
    </div>
  );
});
