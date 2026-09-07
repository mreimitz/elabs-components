"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { useControllableState } from "@radix-ui/react-use-controllable-state";
import {
  RadioGroup,
  RadioGroupItem,
  cn,
  effortRungForIndex,
  type EffortLevel,
} from "@elabs-ai/components-ui";

// `EffortLevel` and the growing-square size ramp (`effortRungForIndex`,
// formerly this file's private `SIZE_RUNGS`/`rungForIndex`) moved to
// `@elabs-ai/components-ui` (`lib/operating-mode.ts`) — the terminal CLI
// look-alike family's own effort chips (issue #117) reuse the same
// vocabulary shape, and `@elabs-ai/components-ai`/
// `@elabs-ai/components-terminal` are layer-2 DAG siblings that may not
// import each other (T0; see
// docs/decisions/2026-09-01-brainless-adoption-architecture.md § 4). Imported
// above; NOT re-exported from here — a consumer imports `EffortLevel` from
// `@elabs-ai/components-ui`.

export type PromptInputEffortProps = Omit<HTMLAttributes<HTMLDivElement>, "onChange"> & {
  /** Ordered low → high. The order IS the semantics — render in this order. */
  levels: EffortLevel[];
  /** Controlled selected level id. Omit for the uncontrolled default (`levels[0]`). */
  value?: string;
  /** Fires with the chosen level's id. */
  onValueChange?: (id: string) => void;
  /**
   * Accessible name for the whole scale (e.g. "Reasoning effort", "Thinking
   * budget") — required because the NAME of the scale is as much the
   * consumer's vocabulary as its levels are; this component has no default
   * to fall back to.
   */
  "aria-label": string;
};

/**
 * PromptInputEffort — an ORDERED reasoning-effort/budget control.
 *
 * Renders `levels` as a row of same-shape squares that GROW in size, low to
 * high — the size ramp encodes the order on its own, before any selection is
 * made. Selecting a level fills every square up to and including it (solid
 * fill + coloured border) and leaves the rest hollow (outline only): the
 * indicator's FILL is the second, non-colour channel required by a
 * greyscale-legibility read — the size ramp and the solid/hollow shape both
 * survive a greyscale render, so the level is recoverable without colour.
 * The current level's name is additionally rendered as text.
 *
 * Built on Radix (`RadioGroup`/`RadioGroupItem` from `@elabs-ai/components-ui`,
 * `role="radiogroup"` of `role="radio"`s) for arrow-key navigation, roving
 * focus and an accessible-name announcement on the checked item — no
 * hand-rolled key handling.
 */
export const PromptInputEffort = forwardRef<HTMLDivElement, PromptInputEffortProps>(
  function PromptInputEffort(
    { levels, value, onValueChange, className, "aria-label": ariaLabel, ...props },
    ref,
  ) {
    const [selected, setSelected] = useControllableState<string>({
      defaultProp: levels[0]?.id ?? "",
      onChange: onValueChange,
      prop: value,
    });

    const handleChange = (next: string) => {
      if (!next) return;
      setSelected(next);
    };

    const currentIndex = levels.findIndex((level) => level.id === selected);
    const current = currentIndex >= 0 ? levels[currentIndex] : levels[0];

    return (
      <div
        ref={ref}
        data-slot="prompt-input-effort"
        className={cn("inline-flex items-center gap-2", className)}
        {...props}
      >
        <RadioGroup
          value={selected}
          onValueChange={handleChange}
          orientation="horizontal"
          aria-label={ariaLabel}
          data-slot="prompt-input-effort-scale"
          className="flex items-end gap-1"
        >
          {levels.map((level, index) => {
            const filled = currentIndex >= 0 && index <= currentIndex;
            return (
              // The visible bar (`-visual`) and the click/tap/focus target
              // (the radio itself) are decoupled (WCAG 2.5.8, #161): the
              // radio's authored size IS the ramp's meaning, so it can't
              // simply grow to 24px without flattening the ramp. Instead the
              // radio is stretched to fill this `size-6` (24px) frame —
              // invisible, but a real >=24x24 hit box — while a separate,
              // `aria-hidden` sibling paints the small bar at its authored
              // `effortRungForIndex` size. Both are bottom-flush + centered
              // so the radio's own checked-state indicator still lands on
              // (and stays invisible against) the visible bar, exactly as
              // when the radio painted the bar directly.
              <span
                key={level.id}
                data-slot="prompt-input-effort-item-frame"
                className="relative inline-flex size-6 shrink-0 items-end justify-center"
              >
                <span
                  aria-hidden="true"
                  data-slot="prompt-input-effort-item-visual"
                  className={cn(
                    effortRungForIndex(index, levels.length),
                    "rounded-sm border",
                    filled ? "border-primary bg-primary" : "border-border-strong bg-transparent",
                  )}
                />
                <RadioGroupItem
                  value={level.id}
                  aria-label={level.label}
                  data-slot="prompt-input-effort-item"
                  data-filled={filled ? "true" : "false"}
                  className="absolute inset-0 flex size-full items-end justify-center rounded-sm border-0 bg-transparent p-0 shadow-none"
                />
              </span>
            );
          })}
        </RadioGroup>
        <span className="text-body" data-slot="prompt-input-effort-label">
          {current?.label}
        </span>
      </div>
    );
  },
);
