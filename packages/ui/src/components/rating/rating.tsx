// a2ui.exposed: yes
import {
  forwardRef,
  useCallback,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { Star } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

const ratingVariants = cva("inline-flex items-center", {
  variants: {
    size: {
      sm: "gap-0.5",
      md: "gap-1",
      lg: "gap-1.5",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

const STAR_SIZE: Record<NonNullable<VariantProps<typeof ratingVariants>["size"]>, string> = {
  sm: "size-4",
  md: "size-5",
  lg: "size-6",
};

export interface RatingProps
  extends
    Omit<HTMLAttributes<HTMLDivElement>, "onChange" | "defaultValue">,
    VariantProps<typeof ratingVariants> {
  /** Controlled value (0..max). */
  value?: number;
  /** Uncontrolled default value (0..max). Default 0. */
  defaultValue?: number;
  /** Called when the rating changes. */
  onValueChange?: (value: number) => void;
  /** Number of stars. Default 5. */
  max?: number;
  /** Allow half-star values (0.5 increments). Default false. */
  allowHalf?: boolean;
  /** Render as a non-interactive display of the value. */
  readOnly?: boolean;
  /** Disable interaction (interactive variant only). */
  disabled?: boolean;
  /** Accessible name for the rating group. Default "Rating". */
  "aria-label"?: string;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Rating — a star rating control.
 *
 * Controlled via `value`/`onValueChange`; uncontrolled via `defaultValue`.
 * Interactive mode is a `radiogroup` (keyboard ←/→ adjust by `allowHalf ? 0.5 : 1`,
 * Home clears, End sets max). `readOnly` renders a non-interactive `role="img"`
 * summary. Half-star clicks land on the left/right half of a star when `allowHalf`.
 */
export const Rating = forwardRef<HTMLDivElement, RatingProps>(function Rating(
  {
    value: valueProp,
    defaultValue = 0,
    onValueChange,
    max = 5,
    allowHalf = false,
    readOnly = false,
    disabled = false,
    size = "md",
    className,
    "aria-label": ariaLabel = "Rating",
    ...props
  },
  ref,
) {
  const isControlled = valueProp !== undefined;
  const [internalValue, setInternalValue] = useState<number>(defaultValue);
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const current = clamp(isControlled ? (valueProp ?? 0) : internalValue, 0, max);
  const interactive = !readOnly && !disabled;
  const display = interactive && hoverValue !== null ? hoverValue : current;

  const starRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const commit = useCallback(
    (next: number) => {
      const clamped = clamp(next, 0, max);
      if (!isControlled) setInternalValue(clamped);
      onValueChange?.(clamped);
    },
    [isControlled, max, onValueChange],
  );

  const step = allowHalf ? 0.5 : 1;

  const valueFromPointer = useCallback(
    (e: PointerEvent<HTMLButtonElement>, index: number): number => {
      if (!allowHalf) return index;
      const rect = e.currentTarget.getBoundingClientRect();
      const isLeftHalf = e.clientX - rect.left < rect.width / 2;
      return isLeftHalf ? index - 0.5 : index;
    },
    [allowHalf],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!interactive) return;
      let next = current;
      switch (e.key) {
        case "ArrowRight":
        case "ArrowUp":
          next = clamp(current + step, 0, max);
          break;
        case "ArrowLeft":
        case "ArrowDown":
          next = clamp(current - step, 0, max);
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = max;
          break;
        default:
          return;
      }
      e.preventDefault();
      commit(next);
      // Move focus to the star representing the new value (roving tabindex).
      const focusIndex = Math.max(0, Math.ceil(next) - 1);
      starRefs.current[focusIndex]?.focus();
    },
    [interactive, current, step, max, commit],
  );

  // Roving tabindex: the star at the current value (or the first) is the tab stop.
  const tabStopIndex = current > 0 ? Math.ceil(current) - 1 : 0;

  // Read-only / disabled: a single non-interactive summary.
  if (!interactive) {
    return (
      <div
        ref={ref}
        role="img"
        aria-label={`${current} out of ${max}`}
        className={cn(ratingVariants({ size }), disabled && "opacity-50", className)}
        {...props}
      >
        {Array.from({ length: max }, (_, i) => (
          <StarGlyph key={i} fill={clamp(display - i, 0, 1)} sizeClass={STAR_SIZE[size ?? "md"]} />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(ratingVariants({ size }), className)}
      onKeyDown={handleKeyDown}
      onPointerLeave={() => setHoverValue(null)}
      {...props}
    >
      {Array.from({ length: max }, (_, i) => {
        const index = i + 1;
        const checked = Math.ceil(current) === index;
        return (
          <button
            key={index}
            ref={(el) => {
              starRefs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={`${index} ${index === 1 ? "star" : "stars"}`}
            tabIndex={i === tabStopIndex ? 0 : -1}
            className="rounded-sm focus-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            onClick={(e) =>
              commit(valueFromPointer(e as unknown as PointerEvent<HTMLButtonElement>, index))
            }
            onPointerMove={(e) => setHoverValue(valueFromPointer(e, index))}
          >
            <StarGlyph fill={clamp(display - i, 0, 1)} sizeClass={STAR_SIZE[size ?? "md"]} />
          </button>
        );
      })}
    </div>
  );
});

interface StarGlyphProps {
  /** Fill fraction 0..1 for this star. */
  fill: number;
  sizeClass: string;
}

/** A single star rendered with a partial fill overlay (supports half stars). */
function StarGlyph({ fill, sizeClass }: StarGlyphProps) {
  return (
    <span className={cn("relative inline-block", sizeClass)} aria-hidden="true">
      <Star className={cn(sizeClass, "text-muted-foreground")} />
      {fill > 0 && (
        <span
          className="absolute inset-0 overflow-hidden"
          // Width is a layout value (the fill fraction), never a color.
          style={{ width: `${fill * 100}%` }}
        >
          <Star className={cn(sizeClass, "fill-current text-warning")} />
        </span>
      )}
    </span>
  );
}
