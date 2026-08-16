// a2ui.exposed: yes
"use client";

import { forwardRef, useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { cn } from "../../lib/cn";
import { Button } from "../button";
import { Calendar } from "../calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";

export type { DateRange };

export interface DateRangePreset {
  label: string;
  getRange: () => DateRange;
}

export interface DateRangePickerProps {
  value?: DateRange;
  defaultValue?: DateRange;
  onValueChange?: (range?: DateRange) => void;
  presets?: DateRangePreset[];
  numberOfMonths?: number;
  placeholder?: string;
  className?: string;
}

const fmt = (date: Date) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);

function formatRange(range: DateRange | undefined, placeholder: string): string {
  if (!range) return placeholder;
  if (range.from && range.to) return `${fmt(range.from)} – ${fmt(range.to)}`;
  if (range.from) return `${fmt(range.from)} – …`;
  return placeholder;
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
    },
    ref,
  ) {
    const [internal, setInternal] = useState<DateRange | undefined>(defaultValue);

    const isControlled = value !== undefined;
    const range = isControlled ? value : internal;

    const setRange = (r?: DateRange) => {
      if (!isControlled) {
        setInternal(r);
      }
      // Always fire the callback so uncontrolled consumers can observe changes
      onValueChange?.(r);
    };

    const hasRange = Boolean(range?.from);
    const label = formatRange(range, placeholder);

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            variant="outline"
            aria-haspopup="dialog"
            className={cn(
              "w-72 justify-start gap-2 text-start font-normal",
              !hasRange && "text-muted-foreground",
              className,
            )}
          >
            <CalendarIcon className="size-4" aria-hidden="true" />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          {presets && presets.length > 0 ? (
            <div className="flex">
              <div className="flex flex-col gap-1 border-r border-border p-2">
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
                numberOfMonths={numberOfMonths}
                selected={range}
                onSelect={setRange}
                autoFocus
              />
            </div>
          ) : (
            <Calendar
              mode="range"
              numberOfMonths={numberOfMonths}
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
