import { useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "../button";
import { Calendar } from "../calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";

export interface DatePickerProps {
  value?: Date;
  onValueChange?: (date?: Date) => void;
  placeholder?: string;
  className?: string;
}

/** Single-date picker (Popover + Calendar). Controlled or uncontrolled. */
export function DatePicker({
  value,
  onValueChange,
  placeholder = "Pick a date",
  className,
}: DatePickerProps) {
  const [internal, setInternal] = useState<Date | undefined>(undefined);
  const date = value ?? internal;
  const setDate = (d?: Date) => (onValueChange ? onValueChange(d) : setInternal(d));
  const label = date
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date)
    : placeholder;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-56 justify-start gap-2 text-start font-normal",
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
}
