import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { cn } from "../../lib/cn";
import { buttonVariants } from "../button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/** Date picker calendar (react-day-picker v9), themed with brand tokens. */
export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        // `months` is the positioning context for the nav overlay below: in
        // react-day-picker v9 the <nav> is a SIBLING of the month(s), not a child
        // of the caption, so the caption cannot anchor it.
        months: "relative flex flex-col gap-2 sm:flex-row",
        month: "flex flex-col gap-4",
        // `min-h-7` matches the nav button row so the two align; it can still grow
        // for a taller caption (e.g. `captionLayout="dropdown"`), and `px-8` keeps
        // the label clear of the buttons overlaying either edge.
        month_caption: "flex min-h-7 items-center justify-center px-8",
        caption_label: "text-sm font-medium",
        // Overlays the caption row and pushes the buttons to either edge; the
        // buttons themselves stay in normal flow inside it.
        nav: "absolute inset-x-0 top-0 flex h-7 items-center justify-between",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "size-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "size-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday: "w-8 rounded-md text-[0.8rem] font-normal text-muted-foreground",
        week: "mt-2 flex w-full",
        day: "relative size-8 p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-range-end)]:rounded-e-md first:[&:has([aria-selected])]:rounded-s-md last:[&:has([aria-selected])]:rounded-e-md",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "size-8 p-0 font-normal aria-selected:opacity-100",
        ),
        range_start: "day-range-start rounded-s-md",
        range_end: "day-range-end rounded-e-md",
        range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        today: "bg-accent text-accent-foreground",
        outside: "day-outside text-muted-foreground aria-selected:text-muted-foreground",
        disabled: "text-muted-foreground opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
          return <Icon className="size-4" data-rtl-flip />;
        },
      }}
      {...props}
    />
  );
}
