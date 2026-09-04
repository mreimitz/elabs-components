import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "../../lib/cn";

/** Props for a single `SliderPrimitive.Thumb` — see `SliderProps["thumbProps"]`. */
export type SliderThumbProps = ComponentPropsWithoutRef<typeof SliderPrimitive.Thumb>;

export type SliderProps = ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
  /**
   * Announced instead of the raw numeric value (e.g. `"step 3 of 12"` for a
   * replay scrubber). Forwarded to the thumb alongside `aria-label`/
   * `aria-labelledby` — see the doc comment below for why it has to land
   * there, not on the root.
   */
  "aria-valuetext"?: string;
  /**
   * Escape hatch spread onto the thumb LAST — for `data-*`/`style`/etc, or to
   * deliberately override `aria-label`/`aria-labelledby`/`aria-valuetext`
   * (an explicit key here always wins over the matching top-level prop).
   *
   * The six keys that MAKE the element a slider are ignored on purpose:
   * `role`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`,
   * `aria-orientation` and `tabIndex`. Radix derives every one of them from
   * the slider's live state and spreads consumer props AFTER its own, so
   * passing them here would silently destroy the widget (a wrong
   * `aria-valuenow` mis-announces the value; `role`/`tabIndex` make it
   * unreachable). Change the VALUE (`value`/`min`/`max`/`orientation`/
   * `disabled`) on `Slider` instead; use `aria-valuetext` to change how the
   * value is spoken.
   *
   * Radix renders one thumb per element of `value`/`defaultValue` — pass a
   * single object to apply the same props to every thumb (the historical
   * single-thumb shape, unchanged), or an ARRAY to give each thumb its own
   * props, indexed positionally against `value`/`defaultValue` (#398). A
   * missing array slot falls back to no per-thumb override for that thumb.
   */
  thumbProps?: SliderThumbProps | SliderThumbProps[];
};

/**
 * Attributes Radix computes for the thumb and then lets consumer props
 * overwrite (`SliderThumbImpl` spreads them before `...thumbProps`). Dropping
 * them here is what keeps the escape hatch from being a foot-gun.
 */
const PROTECTED_THUMB_KEYS = [
  "role",
  "aria-valuenow",
  "aria-valuemin",
  "aria-valuemax",
  "aria-orientation",
  "tabIndex",
] as const;

function withoutProtectedKeys(
  thumbProps: SliderThumbProps | undefined,
): SliderThumbProps | undefined {
  if (!thumbProps) return thumbProps;
  let safe = thumbProps;
  for (const key of PROTECTED_THUMB_KEYS) {
    if (!(key in safe)) continue;
    const { [key]: _dropped, ...rest } = safe;
    safe = rest;
  }
  return safe;
}

/** `thumbProps` for the thumb at `index` — the shared object for every thumb, or that array slot. */
function getThumbPropsAt(
  thumbProps: SliderProps["thumbProps"],
  index: number,
): SliderThumbProps | undefined {
  if (!thumbProps) return undefined;
  return Array.isArray(thumbProps) ? thumbProps[index] : thumbProps;
}

/**
 * Range input — a single-thumb value by default, or a multi-thumb range
 * slider when `value`/`defaultValue` is an array with more than one element
 * (Radix's own range-slider shape; #398). One `Thumb` is rendered per value.
 *
 * `aria-label` / `aria-labelledby` / `aria-valuetext` are routed to the
 * THUMB(S), not the root: Radix puts `role="slider"` on the thumb, so a name
 * (or value text) on the root would never reach the widget. Pass `aria-label`
 * (or `aria-labelledby`, for a visible `<Label>`) — an unnamed slider is an
 * accessibility failure. For a range slider, pass an ARRAY to `thumbProps` so
 * each thumb gets its own name/valuetext (e.g. "Minimum price"/"Maximum
 * price") — the top-level `aria-label`/`aria-valuetext` apply identically to
 * every thumb, which is rarely what a multi-thumb slider wants.
 */
export const Slider = forwardRef<ElementRef<typeof SliderPrimitive.Root>, SliderProps>(
  function Slider(
    {
      className,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledby,
      "aria-valuetext": ariaValueText,
      thumbProps,
      value,
      defaultValue,
      ...props
    },
    ref,
  ) {
    const values = value ?? defaultValue;
    const thumbCount = Array.isArray(values) ? values.length : 1;
    return (
      <SliderPrimitive.Root
        ref={ref}
        className={cn("relative flex w-full touch-none select-none items-center", className)}
        value={value}
        defaultValue={defaultValue}
        {...props}
      >
        <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
          <SliderPrimitive.Range className="absolute h-full bg-primary" />
        </SliderPrimitive.Track>
        {Array.from({ length: thumbCount }, (_, index) => {
          const safeThumbProps = withoutProtectedKeys(getThumbPropsAt(thumbProps, index));
          return (
            <SliderPrimitive.Thumb
              key={index}
              aria-label={ariaLabel}
              aria-labelledby={ariaLabelledby}
              aria-valuetext={ariaValueText}
              {...safeThumbProps}
              className={cn(
                "block size-4 rounded-full border border-primary/50 bg-background shadow transition-colors focus-ring disabled:pointer-events-none disabled:opacity-50",
                safeThumbProps?.className,
              )}
            />
          );
        })}
      </SliderPrimitive.Root>
    );
  },
);
