import type { ButtonHTMLAttributes } from "react";
import { forwardRef } from "react";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";

export interface FacetOption {
  label: string;
  value: string;
}

export interface FacetFilterProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> {
  title: string;
  options: FacetOption[];
  /** Currently selected values (controlled). */
  selected: string[];
  onSelectedChange: (values: string[]) => void;
}

/**
 * Multi-select faceted filter rendered as a dropdown of toggles.
 *
 * `disabled` (forwarded to the trigger `Button`) is how a consumer signals a
 * pending fetch (D5 — the app owns fetch state, this control just reflects
 * it; see loading-states.md).
 *
 * The trigger takes `Button`'s DEFAULT size (`h-9`), not `sm` (#346): a facet
 * filter lives in a toolbar beside `Select` / `Input` / `DatePicker`, all of
 * which land on `h-9` (Select's own default rung, Input hardcoded, DatePicker
 * via this same Button default). An `sm` trigger was the lone `h-8` outlier in
 * that row, so the top and bottom edges of a filter bar didn't line up.
 */
export const FacetFilter = forwardRef<HTMLButtonElement, FacetFilterProps>(function FacetFilter(
  { title, options, selected, onSelectedChange, className, ...props },
  ref,
) {
  const selectedSet = new Set(selected);
  const toggle = (value: string) => {
    const next = new Set(selectedSet);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onSelectedChange([...next]);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button ref={ref} variant="outline" className={cn("border-dashed", className)} {...props}>
          {title}
          {selected.length > 0 ? (
            <Badge
              variant="secondary"
              className="ms-1 rounded px-1.5 animate-in fade-in zoom-in-95 duration-fast ease-entrance"
            >
              {selected.length}
            </Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-[12rem]">
        <DropdownMenuLabel>{title}</DropdownMenuLabel>
        {options.map((opt) => {
          const checked = selectedSet.has(opt.value);
          return (
            <DropdownMenuItem
              key={opt.value}
              onSelect={(e) => {
                e.preventDefault();
                toggle(opt.value);
              }}
            >
              <span
                aria-hidden="true"
                className={
                  "flex size-4 items-center justify-center rounded border transition-colors duration-fast ease-standard " +
                  (checked ? "border-primary bg-primary text-primary-foreground" : "border-input")
                }
              >
                {checked ? "✓" : ""}
              </span>
              {opt.label}
            </DropdownMenuItem>
          );
        })}
        {selected.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onSelectedChange([])}>Clear filters</DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

FacetFilter.displayName = "FacetFilter";
