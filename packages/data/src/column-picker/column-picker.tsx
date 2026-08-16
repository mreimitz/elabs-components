import { type Table } from "@tanstack/react-table";
import type { ButtonHTMLAttributes, ReactElement, Ref } from "react";
import { forwardRef } from "react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";

export interface ColumnPickerProps<TData> extends ButtonHTMLAttributes<HTMLButtonElement> {
  table: Table<TData>;
  /** Trigger label. Defaults to "Columns". */
  label?: string;
}

function ColumnPickerInner<TData>(
  { table, label = "Columns", className, ...props }: ColumnPickerProps<TData>,
  ref: Ref<HTMLButtonElement>,
) {
  const columns = table.getAllColumns().filter((c) => c.getCanHide());
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button ref={ref} variant="outline" size="sm" className={cn(className)} {...props}>
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[12rem]">
        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((column) => (
          <DropdownMenuItem
            key={column.id}
            onSelect={(e) => {
              e.preventDefault();
              column.toggleVisibility(!column.getIsVisible());
            }}
          >
            <span
              aria-hidden="true"
              className={
                "flex size-4 items-center justify-center rounded border transition-colors duration-fast ease-standard " +
                (column.getIsVisible()
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input")
              }
            >
              {column.getIsVisible() ? "✓" : ""}
            </span>
            <span className="capitalize">{column.id}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

ColumnPickerInner.displayName = "ColumnPicker";

// React.forwardRef strips the generic parameter — the cast below restores it
// (same pattern as DataTable's public export) so callers get full type
// inference on `table` while still being able to forward a ref to the
// trigger `Button`.
//
// `disabled` (available via the extended `ButtonHTMLAttributes`, forwarded to
// the trigger) is how a consumer signals a pending fetch (D5 — the app owns
// fetch state; see loading-states.md).
export const ColumnPicker = forwardRef(ColumnPickerInner) as <TData>(
  props: ColumnPickerProps<TData> & { ref?: Ref<HTMLButtonElement> },
) => ReactElement | null;
