// a2ui.exposed: yes
"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { cn } from "../../lib/cn";
import { useControllableState } from "../../lib/use-controllable-state";
import { useIsMobile } from "../../lib/use-mobile";
import { Button } from "../button";
import { Calendar } from "../calendar";
import { useLocale } from "../locale-provider";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";

/** Below this width, the calendar collapses to a single month (Tailwind `sm`). */
const NARROW_BREAKPOINT = 640;

export type { DateRange };

export interface DateRangePreset {
  label: string;
  getRange: () => DateRange;
}

export interface DateRangePickerProps extends Omit<
  HTMLAttributes<HTMLButtonElement>,
  "onSelect" | "children" | "value" | "defaultValue"
> {
  value?: DateRange;
  defaultValue?: DateRange;
  onValueChange?: (range?: DateRange) => void;
  presets?: DateRangePreset[];
  numberOfMonths?: number;
  placeholder?: string;
  className?: string;
}

/**
 * Date range picker (Popover + Calendar in range mode).
 * Supports optional preset quick-picks, controlled or uncontrolled.
 */
export const DateRangePicker = forwardRef<HTMLButtonElement, DateRangePickerProps>(
  function DateRangePicker(
    {
      value,
      defaultValue,
      onValueChange,
      presets,
      numberOfMonths = 2,
      placeholder = "Pick a date range",
      className,
      ...props
    },
    ref,
  ) {
    const { formatDate } = useLocale();
    const [range, setRange] = useControllableState<DateRange | undefined>(
      value,
      defaultValue,
      onValueChange,
    );

    const fmt = (date: Date) => formatDate(date, { dateStyle: "medium" });
    const formatRange = (r: DateRange | undefined): string => {
      if (!r) return placeholder;
      if (r.from && r.to) return `${fmt(r.from)} – ${fmt(r.to)}`;
      if (r.from) return `${fmt(r.from)} – …`;
      return placeholder;
    };

    const hasRange = Boolean(range?.from);
    const label = formatRange(range);

    // Below `sm`, two side-by-side months push the popover off-screen (#reviewed).
    const isNarrow = useIsMobile(NARROW_BREAKPOINT);
    const monthsToShow = isNarrow ? 1 : numberOfMonths;

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            variant="outline"
            aria-haspopup="dialog"
            {...props}
            className={cn(
              "w-full justify-start gap-2 text-start font-normal",
              !hasRange && "text-muted-foreground",
              className,
            )}
          >
            <CalendarIcon className="size-4" aria-hidden="true" />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto max-w-[calc(100vw-1rem)] p-0"
          align="start"
          collisionPadding={8}
        >
          {presets && presets.length > 0 ? (
            <div className="flex">
              <div className="flex flex-col gap-1 border-e border-border p-2">
                {presets.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="ghost"
                    size="sm"
                    className="justify-start"
                    onClick={() => setRange(preset.getRange())}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              <Calendar
                mode="range"
                numberOfMonths={monthsToShow}
                selected={range}
                onSelect={setRange}
                autoFocus
              />
            </div>
          ) : (
            <Calendar
              mode="range"
              numberOfMonths={monthsToShow}
              selected={range}
              onSelect={setRange}
              autoFocus
            />
          )}
        </PopoverContent>
      </Popover>
    );
  },
);
