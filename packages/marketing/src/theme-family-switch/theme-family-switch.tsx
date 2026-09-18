"use client";

import { forwardRef, type HTMLAttributes } from "react";
import {
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";

export type ThemeFamilySwitchMode = "light" | "dark";
export type ThemeFamilySwitchSize = "sm" | "md" | "lg";

/** The two colours a family's chip is painted with — any CSS colour, resolved by the host. */
export interface ThemeFamilySwatch {
  /** The family's ground (`--background` in the active mode). */
  background: string;
  /** The family's accent (`--primary` in the active mode). */
  primary: string;
}

export interface ThemeFamilySwitchFamily {
  /** Family id — what `value` holds and `onChange` reports. */
  id: string;
  /** Display name: the swatch's accessible name and its tooltip wordmark. */
  label: string;
  /** Chip colours. The switch never imports a theme; the host passes these in. */
  swatch: ThemeFamilySwatch;
}

export interface ThemeFamilySwitchLabels {
  /** Accessible name of the swatch row. */
  families: string;
  /** Accessible name of the mode toggle. */
  mode: string;
  light: string;
  dark: string;
}

export const DEFAULT_THEME_FAMILY_SWITCH_LABELS: ThemeFamilySwitchLabels = {
  families: "Theme family",
  mode: "Colour mode",
  light: "Light",
  dark: "Dark",
};

export interface ThemeFamilySwitchProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange" | "defaultValue"
> {
  /** Families in display order. */
  families: readonly ThemeFamilySwitchFamily[];
  /** Id of the active family. */
  value: string;
  /** A family was applied (click, Enter or Space). Arrow keys only move focus. */
  onChange: (familyId: string) => void;
  /** Active mode; with `onModeChange`, renders the Light/Dark toggle after the swatches. */
  mode?: ThemeFamilySwitchMode;
  onModeChange?: (mode: ThemeFamilySwitchMode) => void;
  size?: ThemeFamilySwitchSize;
  /** UI strings, for localisation. */
  labels?: Partial<ThemeFamilySwitchLabels>;
}

/** Hit target per size (the chip sits inside it, inset by the selection border). */
const ITEM_SIZE: Record<ThemeFamilySwitchSize, string> = {
  sm: "size-7",
  md: "size-9",
  lg: "size-11",
};
const MODE_SIZE: Record<ThemeFamilySwitchSize, "sm" | "default" | "lg"> = {
  sm: "sm",
  md: "default",
  lg: "lg",
};

/**
 * One control that re-skins a page across theme families (concept §5a): a row of two-tone
 * family chips with roving focus — Tab enters the row, arrow keys move, Enter/Space apply —
 * plus an optional Light/Dark toggle. The selected chip carries a solid ring (a shape cue,
 * not colour alone) and `aria-checked`; each chip is named by its family.
 */
export const ThemeFamilySwitch = forwardRef<HTMLDivElement, ThemeFamilySwitchProps>(
  function ThemeFamilySwitch(
    {
      families,
      value,
      onChange,
      mode,
      onModeChange,
      size = "md",
      labels: labelsProp,
      className,
      ...props
    },
    ref,
  ) {
    const labels = { ...DEFAULT_THEME_FAMILY_SWITCH_LABELS, ...labelsProp };
    return (
      <TooltipProvider delayDuration={300}>
        <div
          ref={ref}
          data-slot="theme-family-switch"
          data-size={size}
          className={cn("inline-flex flex-wrap items-center gap-3", className)}
          {...props}
        >
          <ToggleGroup
            type="single"
            value={value}
            // Radix reports "" when the pressed item is pressed again — a family stays applied.
            onValueChange={(next) => {
              if (next && next !== value) onChange(next);
            }}
            aria-label={labels.families}
            data-slot="theme-family-switch-families"
            className="flex-wrap gap-1"
          >
            {families.map((family) => (
              <Tooltip key={family.id}>
                <TooltipTrigger asChild>
                  <ToggleGroupItem
                    value={family.id}
                    aria-label={family.label}
                    data-slot="theme-family-switch-item"
                    className={cn(
                      ITEM_SIZE[size],
                      "min-w-0 rounded-full border-2 border-transparent p-0.5",
                      "bg-transparent hover:bg-transparent data-[state=on]:bg-transparent aria-checked:bg-transparent",
                      "data-[state=on]:border-foreground aria-checked:border-foreground",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      data-slot="theme-family-switch-swatch"
                      className="size-full rounded-full shadow-hairline"
                      style={{
                        background: `linear-gradient(135deg, ${family.swatch.background} 0 50%, ${family.swatch.primary} 50% 100%)`,
                      }}
                    />
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent data-slot="theme-family-switch-wordmark">
                  {family.label}
                </TooltipContent>
              </Tooltip>
            ))}
          </ToggleGroup>
          {mode !== undefined && onModeChange ? (
            <ToggleGroup
              type="single"
              variant="segmented"
              size={MODE_SIZE[size]}
              value={mode}
              onValueChange={(next) => {
                if (next === "light" || next === "dark") onModeChange(next);
              }}
              aria-label={labels.mode}
              data-slot="theme-family-switch-mode"
            >
              <ToggleGroupItem value="light">{labels.light}</ToggleGroupItem>
              <ToggleGroupItem value="dark">{labels.dark}</ToggleGroupItem>
            </ToggleGroup>
          ) : null}
        </div>
      </TooltipProvider>
    );
  },
);
