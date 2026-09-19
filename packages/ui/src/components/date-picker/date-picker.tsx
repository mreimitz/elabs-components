"use client";

import { forwardRef } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "../../lib/cn";
import { useControllableState } from "../../lib/use-controllable-state";
import { Button } from "../button";
import { Calendar } from "../calendar";
import { useLocale } from "../locale-provider";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";

export interface DatePickerProps {
  value?: Date;
  onValueChange?: (date?: Date) => void;
  placeholder?: string;
  className?: string;
}

/** Single-date picker (Popover + Calendar). Controlled or uncontrolled. */
export const DatePicker = forwardRef<HTMLButtonElement, DatePickerProps>(function DatePicker(
  { value, onValueChange, placeholder = "Pick a date", className },
  ref,
) {
  const { formatDate } = useLocale();
  const [date, setDate] = useControllableState<Date | undefined>(value, undefined, onValueChange);
  const label = date ? formatDate(date, { dateStyle: "medium" }) : placeholder;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          variant="outline"
          className={cn(
            "w-full justify-start gap-2 text-start font-normal",
            !date && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="size-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={setDate} autoFocus />
      </PopoverContent>
    </Popover>
  );
});
