import type { RowData, Table } from "../data-table/tanstack";
import type { ButtonHTMLAttributes, ReactElement, Ref } from "react";
import { forwardRef } from "react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  useLocale,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { columnLabel } from "../data-table/column-meta";

export interface ColumnPickerProps<
  TData extends RowData,
> extends ButtonHTMLAttributes<HTMLButtonElement> {
  table: Table<TData>;
  /** Trigger label. Defaults to "Columns". */
  label?: string;
}

function ColumnPickerInner<TData extends RowData>(
  { table, label, className, ...props }: ColumnPickerProps<TData>,
  ref: Ref<HTMLButtonElement>,
) {
  const { t } = useLocale();
  const resolvedLabel = label ?? t("data.columnPicker.label");
  // LEAF columns: a grouped header ("Latency") is not itself a column that can
  // be shown or hidden — its leaves ("p50", "p95") are.
  const columns = table.getAllLeafColumns().filter((c) => c.getCanHide());
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button ref={ref} variant="outline" size="sm" className={cn(className)} {...props}>
          {resolvedLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[12rem]">
        <DropdownMenuLabel>{t("data.columnPicker.toggleColumns")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((column) => (
          // A checkbox item: its checked state is exposed as `aria-checked`, so
          // a screen-reader user hears which columns are on (WCAG 4.1.2).
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={column.getIsVisible()}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={(checked) => column.toggleVisibility(checked === true)}
          >
            {columnLabel(column)}
          </DropdownMenuCheckboxItem>
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
export const ColumnPicker = forwardRef(ColumnPickerInner) as <TData extends RowData>(
  props: ColumnPickerProps<TData> & { ref?: Ref<HTMLButtonElement> },
) => ReactElement | null;
