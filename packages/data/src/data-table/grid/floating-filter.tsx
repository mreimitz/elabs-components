"use client";

/**
 * floating-filter.tsx — one cell of the floating filter row under the
 * headers. Text and number columns get an inline field (numbers read
 * `>100`, `<=5`, `!=0`, `10..20`); every other kind, or a filter the field
 * cannot express, shows its summary as a button that opens the column's
 * filter panel.
 */
import { useEffect, useRef, useState } from "react";
import { Input, useLocale } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  floatingText,
  isFilterModel,
  parseFloatingInput,
  type ColumnFilterModel,
  type FilterKind,
} from "./filter-model";

export interface FloatingFilterProps {
  label: string;
  kind: FilterKind;
  value: unknown;
  onChange: (next: ColumnFilterModel | undefined) => void;
  /** Opens the column's full filter panel. */
  onOpenPanel: () => void;
  /** The active filter as one line ("" when none). */
  summary: string;
  numeric?: boolean;
}

export function FloatingFilter({
  label,
  kind,
  value,
  onChange,
  onOpenPanel,
  summary,
  numeric,
}: FloatingFilterProps) {
  const { t } = useLocale();
  const inline =
    (kind === "text" || kind === "number") &&
    (value === undefined || (isFilterModel(value) && floatingText(value) !== ""));
  if (inline) {
    return (
      <FloatingInput
        label={label}
        kind={kind}
        value={value as ColumnFilterModel | undefined}
        onChange={onChange}
        numeric={numeric}
      />
    );
  }
  return (
    <button
      type="button"
      data-slot="data-table-floating-filter-summary"
      aria-label={t("data.table.filter", { name: label })}
      aria-haspopup="dialog"
      onClick={onOpenPanel}
      className={cn(
        "flex h-control-sm w-full min-w-0 items-center rounded-md border border-input bg-background px-2 text-start text-meta focus-ring",
        summary ? "text-foreground" : "text-muted-foreground",
      )}
    >
      <span className="min-w-0 truncate">{summary}</span>
    </button>
  );
}

function FloatingInput({
  label,
  kind,
  value,
  onChange,
  numeric,
}: {
  label: string;
  kind: "text" | "number";
  value: ColumnFilterModel | undefined;
  onChange: (next: ColumnFilterModel | undefined) => void;
  numeric?: boolean;
}) {
  const { t } = useLocale();
  const external = floatingText(value);
  const [text, setText] = useState(external);
  // What this field last committed: an external change (a chip removed, the
  // panel edited) shows up as a different model text and replaces the draft.
  const committed = useRef(external);
  useEffect(() => {
    if (external !== committed.current) {
      committed.current = external;
      setText(external);
    }
  }, [external]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const commit = (next: string, immediate: boolean) => {
    clearTimeout(timer.current);
    const run = () => {
      const model = parseFloatingInput(kind, next);
      // An unparseable number ("abc", a lone ">") leaves the filter as it was.
      if (next.trim() !== "" && !model) return;
      committed.current = floatingText(model);
      onChange(model);
    };
    if (immediate) run();
    else timer.current = setTimeout(run, 250);
  };
  return (
    <Input
      data-slot="data-table-floating-filter"
      aria-label={t("data.table.filter", { name: label })}
      inputMode={kind === "number" ? "decimal" : undefined}
      className={cn("h-control-sm px-2 text-meta", numeric && "text-end tabular-nums")}
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        commit(event.target.value, false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit(text, true);
        if (event.key === "Escape" && text !== "") {
          event.stopPropagation();
          setText("");
          commit("", true);
        }
      }}
    />
  );
}
