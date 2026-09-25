"use client";

/**
 * column-filter.tsx — the per-column filter UI of DataTable / DataGrid: a
 * funnel button in the header cell that opens a panel for the column's
 * filter kind (text / number / date conditions with AND / OR, a set
 * checklist with counts and search, or a yes / no choice). The panel applies
 * as you go (typed values debounce) and writes a `ColumnFilterModel` —
 * plain JSON — into TanStack's `columnFilters` slice.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { ListFilter } from "lucide-react";
import {
  Button,
  Checkbox,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  ToggleGroup,
  ToggleGroupItem,
  useLocale,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  BLANK_KEY,
  DATE_PRESETS,
  filterKey,
  isActiveFilter,
  isFilterModel,
  type ColumnFilterModel,
  type DateCondition,
  type DateOperator,
  type DatePreset,
  type FilterKind,
  type Join,
  type NumberCondition,
  type NumberOperator,
  type TextCondition,
  type TextOperator,
} from "./filter-model";

type T = ReturnType<typeof useLocale>["t"];

// ─── Labels (literal keys, so the locale-key guard can see every one) ─────────

function textOpLabel(t: T, op: TextOperator): string {
  switch (op) {
    case "contains":
      return t("data.table.filterOpContains");
    case "notContains":
      return t("data.table.filterOpNotContains");
    case "equals":
      return t("data.table.filterOpEquals");
    case "notEquals":
      return t("data.table.filterOpNotEquals");
    case "startsWith":
      return t("data.table.filterOpStartsWith");
    case "endsWith":
      return t("data.table.filterOpEndsWith");
    case "blank":
      return t("data.table.filterOpBlank");
    case "notBlank":
      return t("data.table.filterOpNotBlank");
  }
}

function numberOpLabel(t: T, op: NumberOperator): string {
  switch (op) {
    case "eq":
      return t("data.table.filterOpEquals");
    case "ne":
      return t("data.table.filterOpNotEquals");
    case "gt":
      return t("data.table.filterOpGt");
    case "gte":
      return t("data.table.filterOpGte");
    case "lt":
      return t("data.table.filterOpLt");
    case "lte":
      return t("data.table.filterOpLte");
    case "between":
      return t("data.table.filterOpBetween");
    case "blank":
      return t("data.table.filterOpBlank");
    case "notBlank":
      return t("data.table.filterOpNotBlank");
  }
}

function dateOpLabel(t: T, op: Exclude<DateOperator, "preset">): string {
  switch (op) {
    case "on":
      return t("data.table.filterOpOn");
    case "before":
      return t("data.table.filterOpBefore");
    case "after":
      return t("data.table.filterOpAfter");
    case "between":
      return t("data.table.filterOpBetween");
    case "blank":
      return t("data.table.filterOpBlank");
    case "notBlank":
      return t("data.table.filterOpNotBlank");
  }
}

export function presetLabel(t: T, preset: DatePreset): string {
  switch (preset) {
    case "today":
      return t("data.table.filterPresetToday");
    case "yesterday":
      return t("data.table.filterPresetYesterday");
    case "last7Days":
      return t("data.table.filterPresetLast7Days");
    case "last30Days":
      return t("data.table.filterPresetLast30Days");
    case "last90Days":
      return t("data.table.filterPresetLast90Days");
    case "thisWeek":
      return t("data.table.filterPresetThisWeek");
    case "lastWeek":
      return t("data.table.filterPresetLastWeek");
    case "thisMonth":
      return t("data.table.filterPresetThisMonth");
    case "lastMonth":
      return t("data.table.filterPresetLastMonth");
    case "thisQuarter":
      return t("data.table.filterPresetThisQuarter");
    case "lastQuarter":
      return t("data.table.filterPresetLastQuarter");
    case "thisYear":
      return t("data.table.filterPresetThisYear");
    case "lastYear":
      return t("data.table.filterPresetLastYear");
    case "yearToDate":
      return t("data.table.filterPresetYearToDate");
  }
}

const TEXT_OPS: TextOperator[] = [
  "contains",
  "notContains",
  "equals",
  "notEquals",
  "startsWith",
  "endsWith",
  "blank",
  "notBlank",
];
const NUMBER_OPS: NumberOperator[] = [
  "eq",
  "ne",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
  "blank",
  "notBlank",
];
const DATE_OPS: Exclude<DateOperator, "preset">[] = [
  "on",
  "before",
  "after",
  "between",
  "blank",
  "notBlank",
];

const needsNoValue = (op: string) => op === "blank" || op === "notBlank";

// ─── Summary text (chips, floating cells) ────────────────────────────────────

/**
 * One line describing a filter — "Contains “ac”", "EU, US +2", "Last 7 days".
 * `formatValue` prints set values and numbers the way the column does.
 */
export function describeFilter(
  model: ColumnFilterModel,
  t: T,
  formatValue: (value: unknown) => string,
  formatDay: (iso: string) => string,
): string {
  const join = (parts: string[], j: Join | undefined) =>
    parts.join(` ${j === "or" ? t("data.table.filterOr") : t("data.table.filterAnd")} `);
  switch (model.type) {
    case "text":
      return join(
        model.conditions
          .filter((c) => isActiveFilter({ type: "text", conditions: [c] }))
          .map((c) =>
            needsNoValue(c.op)
              ? textOpLabel(t, c.op)
              : t("data.table.filterSummary", { op: textOpLabel(t, c.op), value: `“${c.value}”` }),
          ),
        model.join,
      );
    case "number":
      return join(
        model.conditions
          .filter((c) => isActiveFilter({ type: "number", conditions: [c] }))
          .map((c) =>
            needsNoValue(c.op)
              ? numberOpLabel(t, c.op)
              : t("data.table.filterSummary", {
                  op: numberOpLabel(t, c.op),
                  value:
                    c.op === "between"
                      ? `${formatValue(c.value)}–${formatValue(c.to)}`
                      : formatValue(c.value),
                }),
          ),
        model.join,
      );
    case "date":
      return join(
        model.conditions
          .filter((c) => isActiveFilter({ type: "date", conditions: [c] }))
          .map((c) => {
            if (c.op === "preset" && c.preset) return presetLabel(t, c.preset);
            if (needsNoValue(c.op) || c.op === "preset") return dateOpLabel(t, c.op as "blank");
            return t("data.table.filterSummary", {
              op: dateOpLabel(t, c.op),
              value:
                c.op === "between"
                  ? `${formatDay(c.value ?? "")}–${formatDay(c.to ?? "")}`
                  : formatDay(c.value ?? ""),
            });
          }),
        model.join,
      );
    case "set": {
      const names = model.values.map((v) => (v === BLANK_KEY ? t("data.table.filterBlanks") : v));
      if (names.length <= 2) return names.join(", ");
      return t("data.table.filterSetMore", { first: names[0]!, count: names.length - 1 });
    }
    case "boolean":
      return model.value ? t("data.table.filterTrue") : t("data.table.filterFalse");
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseNumber(text: string): number | undefined {
  const s = text.trim().replace(/[\s,]/g, "");
  if (s === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** Commits a model, debounced for typing; flushes on unmount so nothing typed is lost. */
function useCommit(onChange: (next: ColumnFilterModel | undefined) => void, delay = 250) {
  const pending = useRef<{ model: ColumnFilterModel | undefined } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const flush = useCallback(() => {
    clearTimeout(timer.current);
    if (pending.current) {
      const { model } = pending.current;
      pending.current = null;
      onChangeRef.current(model && isActiveFilter(model) ? model : undefined);
    }
  }, []);
  useEffect(() => flush, [flush]);
  return useCallback(
    (model: ColumnFilterModel | undefined, immediate = false) => {
      pending.current = { model };
      clearTimeout(timer.current);
      if (immediate) flush();
      else timer.current = setTimeout(flush, delay);
    },
    [delay, flush],
  );
}

// ─── Condition panels ────────────────────────────────────────────────────────

function OperatorSelect<Op extends string>({
  value,
  ops,
  label,
  onChange,
  extra,
}: {
  value: Op;
  ops: readonly Op[];
  label: (op: Op) => string;
  onChange: (op: Op) => void;
  extra?: ReactNode;
}) {
  const { t } = useLocale();
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Op)}>
      <SelectTrigger
        size="sm"
        aria-label={t("data.table.filterOperator")}
        data-slot="data-table-filter-operator"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ops.map((op) => (
          <SelectItem key={op} value={op}>
            {label(op)}
          </SelectItem>
        ))}
        {extra}
      </SelectContent>
    </Select>
  );
}

function JoinToggle({ value, onChange }: { value: Join; onChange: (join: Join) => void }) {
  const { t } = useLocale();
  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="segmented"
      value={value}
      aria-label={t("data.table.filterJoin")}
      onValueChange={(v) => v && onChange(v as Join)}
      className="self-start"
    >
      <ToggleGroupItem value="and">{t("data.table.filterAnd")}</ToggleGroupItem>
      <ToggleGroupItem value="or">{t("data.table.filterOr")}</ToggleGroupItem>
    </ToggleGroup>
  );
}

/** Text and number conditions share one layout: operator, value(s), and a second condition. */
function ConditionsPanel({
  kind,
  initial,
  commit,
  autoFocus,
}: {
  kind: "text" | "number";
  initial: ColumnFilterModel | undefined;
  commit: (model: ColumnFilterModel | undefined, immediate?: boolean) => void;
  autoFocus: boolean;
}) {
  const { t } = useLocale();
  // `id` is the condition slot (first / second): a stable key.
  type Row = { id: number; op: string; value: string; to: string };
  const fromModel = (): Row[] => {
    const conditions =
      initial && initial.type === kind
        ? (initial.conditions as (TextCondition | NumberCondition)[])
        : [];
    const rows = conditions.slice(0, 2).map((c, id) => ({
      id,
      op: c.op,
      value: c.value === undefined ? "" : String(c.value),
      to: "to" in c && c.to !== undefined ? String(c.to) : "",
    }));
    return rows.length > 0
      ? rows
      : [{ id: 0, op: kind === "text" ? "contains" : "eq", value: "", to: "" }];
  };
  const [rows, setRows] = useState<Row[]>(fromModel);
  const [join, setJoin] = useState<Join>(
    initial && "join" in initial && initial.join ? initial.join : "and",
  );

  const toModel = (next: Row[], j: Join): ColumnFilterModel =>
    kind === "text"
      ? {
          type: "text",
          join: j,
          conditions: next.map((r) => ({ op: r.op as TextOperator, value: r.value })),
        }
      : {
          type: "number",
          join: j,
          conditions: next.map((r) => ({
            op: r.op as NumberOperator,
            value: parseNumber(r.value),
            ...(r.op === "between" ? { to: parseNumber(r.to) } : null),
          })),
        };

  const update = (index: number, patch: Partial<Row>, immediate: boolean) => {
    const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
    setRows(next);
    commit(toModel(next, join), immediate);
  };
  const complete = (r: Row) =>
    needsNoValue(r.op) ||
    (kind === "text"
      ? r.value !== ""
      : parseNumber(r.value) !== undefined &&
        (r.op !== "between" || parseNumber(r.to) !== undefined));
  // A second condition appears once the first one filters something.
  const shown =
    complete(rows[0]!) && rows.length < 2
      ? [...rows, { id: 1, op: rows[0]!.op, value: "", to: "" }]
      : rows;
  const ops = (kind === "text" ? TEXT_OPS : NUMBER_OPS) as string[];
  const label = (op: string) =>
    kind === "text" ? textOpLabel(t, op as TextOperator) : numberOpLabel(t, op as NumberOperator);

  return (
    <div className="flex flex-col gap-2">
      {shown.map((row, index) => (
        <div key={row.id} className="flex flex-col gap-2">
          {index === 1 && (
            <JoinToggle
              value={join}
              onChange={(j) => {
                setJoin(j);
                commit(toModel(rows, j), true);
              }}
            />
          )}
          <OperatorSelect
            value={row.op}
            ops={ops}
            label={label}
            onChange={(op) => {
              const base = index < rows.length ? rows : shown;
              const next = base.map((r, i) => (i === index ? { ...r, op } : r));
              setRows(next);
              commit(toModel(next, join), true);
            }}
          />
          {!needsNoValue(row.op) && (
            <div className="flex items-center gap-2">
              <Input
                // First field of the panel takes focus when it opens.
                autoFocus={autoFocus && index === 0}
                aria-label={t("data.table.filterValue")}
                data-slot="data-table-filter-value"
                inputMode={kind === "number" ? "decimal" : undefined}
                className="h-control-sm"
                value={row.value}
                onChange={(event) => {
                  if (index >= rows.length) {
                    const next = [...rows, { ...row, value: event.target.value }];
                    setRows(next);
                    commit(toModel(next, join));
                  } else update(index, { value: event.target.value }, false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commit(toModel(rows, join), true);
                }}
              />
              {row.op === "between" && (
                <>
                  <span className="shrink-0 text-meta text-muted-foreground">
                    {t("data.table.filterTo")}
                  </span>
                  <Input
                    aria-label={t("data.table.filterTo")}
                    inputMode="decimal"
                    className="h-control-sm"
                    value={row.to}
                    onChange={(event) => update(index, { to: event.target.value }, false)}
                  />
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DatePanel({
  initial,
  commit,
}: {
  initial: ColumnFilterModel | undefined;
  commit: (model: ColumnFilterModel | undefined, immediate?: boolean) => void;
}) {
  const { t } = useLocale();
  const first: DateCondition =
    initial?.type === "date" && initial.conditions[0] ? initial.conditions[0] : { op: "on" };
  const [cond, setCond] = useState<DateCondition>(first);
  const set = (next: DateCondition) => {
    setCond(next);
    commit({ type: "date", conditions: [next] }, true);
  };
  const selectValue = cond.op === "preset" ? `preset:${cond.preset}` : cond.op;
  return (
    <div className="flex flex-col gap-2">
      <Select
        value={selectValue}
        onValueChange={(v) => {
          if (v.startsWith("preset:")) set({ op: "preset", preset: v.slice(7) as DatePreset });
          else set({ op: v as DateOperator, value: cond.value, to: cond.to });
        }}
      >
        <SelectTrigger
          size="sm"
          aria-label={t("data.table.filterOperator")}
          data-slot="data-table-filter-operator"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DATE_OPS.map((op) => (
            <SelectItem key={op} value={op}>
              {dateOpLabel(t, op)}
            </SelectItem>
          ))}
          <SelectSeparator />
          {DATE_PRESETS.map((preset) => (
            <SelectItem key={preset} value={`preset:${preset}`}>
              {presetLabel(t, preset)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {cond.op !== "preset" && !needsNoValue(cond.op) && (
        <div className="flex flex-col gap-2">
          {/* The native date field: keyboard-typable, locale-formatted by the
              browser, and no calendar library in every grid's bundle. */}
          <Input
            type="date"
            aria-label={
              cond.op === "between" ? t("data.table.filterPickDate") : t("data.table.filterValue")
            }
            data-slot="data-table-filter-value"
            className="h-control-sm"
            value={cond.value ?? ""}
            onChange={(event) => set({ ...cond, value: event.target.value || undefined })}
          />
          {cond.op === "between" && (
            <>
              <span className="text-meta text-muted-foreground">{t("data.table.filterTo")}</span>
              <Input
                type="date"
                aria-label={t("data.table.filterTo")}
                className="h-control-sm"
                value={cond.to ?? ""}
                onChange={(event) => set({ ...cond, to: event.target.value || undefined })}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Most values a set list renders at once; the search narrows the rest. */
export const SET_LIST_LIMIT = 500;

interface SetItem {
  key: string;
  label: string;
  count: number;
  sortValue: unknown;
}

function SetPanel({
  initial,
  commit,
  getFacets,
  formatValue,
  autoFocus,
}: {
  initial: unknown;
  commit: (model: ColumnFilterModel | undefined, immediate?: boolean) => void;
  getFacets: () => Map<unknown, number>;
  formatValue: (value: unknown) => string;
  autoFocus: boolean;
}) {
  const { t } = useLocale();
  const items = useMemo<SetItem[]>(() => {
    const byKey = new Map<string, SetItem>();
    const add = (value: unknown, count: number) => {
      const key = filterKey(value);
      const existing = byKey.get(key);
      if (existing) existing.count += count;
      else
        byKey.set(key, {
          key,
          label: key === BLANK_KEY ? t("data.table.filterBlanks") : formatValue(value),
          count,
          sortValue: value,
        });
    };
    for (const [value, count] of getFacets()) {
      if (Array.isArray(value)) {
        if (value.length === 0) add(null, count);
        for (const v of value) add(v, count);
      } else add(value, count);
    }
    const list = [...byKey.values()];
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
    list.sort((a, b) => {
      if (a.key === BLANK_KEY) return -1;
      if (b.key === BLANK_KEY) return 1;
      if (typeof a.sortValue === "number" && typeof b.sortValue === "number")
        return a.sortValue - b.sortValue;
      return collator.compare(a.label, b.label);
    });
    return list;
    // Facets are read once per open; the panel remounts on every open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allKeys = useMemo(() => items.map((i) => i.key), [items]);
  const [selected, setSelected] = useState<Set<string>>(() => {
    if (isFilterModel(initial) && initial.type === "set") return new Set(initial.values);
    // A FacetFilter-style array of raw values reads as the included set.
    if (Array.isArray(initial)) return new Set(initial.map(filterKey));
    return new Set(allKeys);
  });
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return q ? items.filter((i) => i.label.toLocaleLowerCase().includes(q)) : items;
  }, [items, query]);
  const rendered = visible.slice(0, SET_LIST_LIMIT);

  const apply = (next: Set<string>) => {
    setSelected(next);
    const all = allKeys.every((k) => next.has(k));
    commit(all ? undefined : { type: "set", values: allKeys.filter((k) => next.has(k)) }, true);
  };
  const visibleChecked = visible.filter((i) => selected.has(i.key)).length;
  const allState =
    visibleChecked === 0
      ? false
      : visibleChecked === visible.length
        ? true
        : ("indeterminate" as const);
  const listRef = useRef<HTMLDivElement>(null);
  const searchId = useId();

  // Arrow keys move between the checkboxes (one list, not 500 tab stops).
  const onListKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (
      event.key !== "ArrowDown" &&
      event.key !== "ArrowUp" &&
      event.key !== "Home" &&
      event.key !== "End"
    )
      return;
    const boxes = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[role="checkbox"]') ?? [],
    );
    const at = boxes.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? boxes.length - 1
          : Math.max(0, Math.min(boxes.length - 1, at + (event.key === "ArrowDown" ? 1 : -1)));
    boxes[next]?.focus();
    event.preventDefault();
  };

  return (
    <div className="flex flex-col gap-2">
      <Input
        id={searchId}
        autoFocus={autoFocus}
        type="search"
        aria-label={t("data.table.filterSearchValues")}
        placeholder={t("data.table.filterSearchValues")}
        className="h-control-sm"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            listRef.current?.querySelector<HTMLElement>('[role="checkbox"]')?.focus();
            event.preventDefault();
          }
        }}
      />
      {visible.length === 0 ? (
        <p className="px-1 py-2 text-meta text-muted-foreground">
          {t("data.table.filterNoValues")}
        </p>
      ) : (
        <div
          ref={listRef}
          data-slot="data-table-filter-values"
          className="-mx-1 flex max-h-64 flex-col overflow-y-auto px-1"
          onKeyDown={onListKeyDown}
        >
          <label className="flex items-center gap-2 rounded-sm px-1 py-1 text-body font-medium hover:bg-accent">
            <Checkbox
              checked={allState}
              onCheckedChange={(checked) => {
                const next = new Set(selected);
                for (const i of visible) {
                  if (checked === true) next.add(i.key);
                  else next.delete(i.key);
                }
                apply(next);
              }}
            />
            <span className="min-w-0 truncate">{t("data.table.filterSelectAll")}</span>
          </label>
          {rendered.map((item) => (
            <label
              key={item.key}
              data-slot="data-table-filter-value-option"
              className="flex items-center gap-2 rounded-sm px-1 py-1 text-body hover:bg-accent"
            >
              <Checkbox
                checked={selected.has(item.key)}
                onCheckedChange={(checked) => {
                  const next = new Set(selected);
                  if (checked === true) next.add(item.key);
                  else next.delete(item.key);
                  apply(next);
                }}
              />
              <span className={cn("min-w-0 flex-1 truncate", item.key === BLANK_KEY && "italic")}>
                {item.label}
              </span>
              <span className="shrink-0 text-meta tabular-nums text-muted-foreground">
                {item.count}
              </span>
            </label>
          ))}
          {visible.length > rendered.length && (
            <p className="px-1 py-1 text-meta text-muted-foreground">
              {t("data.table.filterMoreValues", { count: visible.length - rendered.length })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function BooleanPanel({
  initial,
  commit,
}: {
  initial: ColumnFilterModel | undefined;
  commit: (model: ColumnFilterModel | undefined, immediate?: boolean) => void;
}) {
  const { t } = useLocale();
  const [value, setValue] = useState(initial?.type === "boolean" ? String(initial.value) : "any");
  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="segmented"
      aria-label={t("data.table.filterOperator")}
      value={value}
      onValueChange={(v) => {
        if (!v) return;
        setValue(v);
        commit(v === "any" ? undefined : { type: "boolean", value: v === "true" }, true);
      }}
    >
      <ToggleGroupItem value="any">{t("data.table.filterAny")}</ToggleGroupItem>
      <ToggleGroupItem value="true">{t("data.table.filterTrue")}</ToggleGroupItem>
      <ToggleGroupItem value="false">{t("data.table.filterFalse")}</ToggleGroupItem>
    </ToggleGroup>
  );
}

// ─── The panel and its header button ──────────────────────────────────────────

export interface ColumnFilterPanelProps {
  kind: FilterKind;
  /** The column's current filter value (a model, or a legacy TanStack value). */
  value: unknown;
  onChange: (next: ColumnFilterModel | undefined) => void;
  /** The column's values with counts (TanStack faceting), read when the panel opens. */
  getFacets: () => Map<unknown, number>;
  /** How a raw value prints (set list, summaries). */
  formatValue: (value: unknown) => string;
  autoFocus?: boolean;
}

export function ColumnFilterPanel({
  kind,
  value,
  onChange,
  getFacets,
  formatValue,
  autoFocus = true,
}: ColumnFilterPanelProps) {
  const { t } = useLocale();
  const commit = useCommit(onChange);
  const [generation, setGeneration] = useState(0);
  const model = isFilterModel(value) ? value : undefined;
  const active = value !== undefined;
  return (
    <div data-slot="data-table-filter-panel" className="flex flex-col gap-3">
      <div key={generation}>
        {kind === "set" ? (
          <SetPanel
            initial={value}
            commit={commit}
            getFacets={getFacets}
            formatValue={formatValue}
            autoFocus={autoFocus}
          />
        ) : kind === "date" ? (
          <DatePanel initial={model} commit={commit} />
        ) : kind === "boolean" ? (
          <BooleanPanel initial={model} commit={commit} />
        ) : (
          <ConditionsPanel kind={kind} initial={model} commit={commit} autoFocus={autoFocus} />
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="self-end"
        disabled={!active}
        data-slot="data-table-filter-clear"
        onClick={() => {
          commit(undefined, true);
          // Remount the fields so they show the cleared state.
          setGeneration((g) => g + 1);
        }}
      >
        {t("data.table.filterClear")}
      </Button>
    </div>
  );
}

/** Whether focus is nowhere useful (the body, or inside the closing surface). */
export function focusIsLost(closing: HTMLElement | null): boolean {
  const active = document.activeElement;
  return !active || active === document.body || (closing?.contains(active) ?? false);
}

export interface ColumnFilterButtonProps extends ColumnFilterPanelProps {
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Grid mode: the header CELL is the tab stop, so the trigger is not. */
  inGrid: boolean;
  /** Where focus goes when the panel closes (grid mode: back to the header cell). */
  onCloseFocus?: () => void;
}

export function ColumnFilterButton({
  label,
  open,
  onOpenChange,
  inGrid,
  onCloseFocus,
  ...panel
}: ColumnFilterButtonProps) {
  const { t } = useLocale();
  const active = panel.value !== undefined;
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          tabIndex={inGrid ? -1 : undefined}
          data-slot="data-table-filter-trigger"
          data-active={active || undefined}
          aria-label={
            active
              ? t("data.table.filterActive", { name: label })
              : t("data.table.filter", { name: label })
          }
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          className={cn(
            "relative z-10 inline-flex size-6 shrink-0 items-center justify-center rounded-sm transition-opacity duration-fast ease-standard hover:bg-foreground/10 focus-ring",
            active
              ? // An active filter always shows, in the primary ink with a dot
                // (shape as well as colour, WCAG 1.4.1).
                "text-primary opacity-100 after:absolute after:end-0.5 after:top-0.5 after:size-1.5 after:rounded-full after:bg-primary after:content-['']"
              : // Takes no room until the header is hovered / focused, so a
                // narrow column keeps its label (the menu trigger does the same).
                "hidden text-muted-foreground hover:text-foreground group-hover/th:inline-flex group-focus-within/th:inline-flex data-[state=open]:inline-flex",
          )}
        >
          <ListFilter aria-hidden="true" className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 p-3"
        aria-label={t("data.table.filter", { name: label })}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          // The panel unmounts after its exit animation; if the person has
          // moved on meanwhile (opened another column's panel), leave focus there.
          if (!focusIsLost(event.currentTarget as HTMLElement | null)) return;
          if (onCloseFocus) onCloseFocus();
          else triggerRef.current?.focus();
        }}
      >
        <ColumnFilterPanel {...panel} />
      </PopoverContent>
    </Popover>
  );
}
