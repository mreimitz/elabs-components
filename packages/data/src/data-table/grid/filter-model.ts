/**
 * filter-model.ts — the column filter model behind DataTable / DataGrid's
 * filter UI (header filter menus, the floating filter row, filter chips).
 *
 * A column's filter VALUE in TanStack's `columnFilters` slice is one of the
 * serialisable models below, so saved views, URLs and agents can read and
 * write filters as plain JSON. Evaluation is pure (`matchesFilter`) and takes
 * `now` as an argument, so relative date ranges are deterministic in tests.
 */

export type TextOperator =
  | "contains"
  | "notContains"
  | "equals"
  | "notEquals"
  | "startsWith"
  | "endsWith"
  | "blank"
  | "notBlank";
export type NumberOperator =
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "blank"
  | "notBlank";
export type DateOperator = "on" | "before" | "after" | "between" | "blank" | "notBlank" | "preset";
export type DatePreset =
  | "today"
  | "yesterday"
  | "last7Days"
  | "last30Days"
  | "last90Days"
  | "thisWeek"
  | "lastWeek"
  | "thisMonth"
  | "lastMonth"
  | "thisQuarter"
  | "lastQuarter"
  | "thisYear"
  | "lastYear"
  | "yearToDate";

export const DATE_PRESETS: readonly DatePreset[] = [
  "today",
  "yesterday",
  "last7Days",
  "last30Days",
  "last90Days",
  "thisWeek",
  "lastWeek",
  "thisMonth",
  "lastMonth",
  "thisQuarter",
  "lastQuarter",
  "thisYear",
  "lastYear",
  "yearToDate",
];

export interface TextCondition {
  op: TextOperator;
  value?: string;
}
export interface NumberCondition {
  op: NumberOperator;
  value?: number;
  /** Upper bound for `between` (inclusive). */
  to?: number;
}
export interface DateCondition {
  op: DateOperator;
  /** ISO date `YYYY-MM-DD` (day precision, local time). */
  value?: string;
  /** Upper bound for `between` (inclusive), ISO date. */
  to?: string;
  preset?: DatePreset;
}

export type Join = "and" | "or";

export type ColumnFilterModel =
  | { type: "text"; conditions: TextCondition[]; join?: Join }
  | { type: "number"; conditions: NumberCondition[]; join?: Join }
  | { type: "date"; conditions: DateCondition[]; join?: Join }
  /** `values` are `filterKey`s of the INCLUDED values; `BLANK_KEY` is (Blanks). */
  | { type: "set"; values: string[] }
  | { type: "boolean"; value: boolean };

export type FilterKind = ColumnFilterModel["type"];

/** The key that stands for empty cells (null, undefined, "") in a set filter. */
export const BLANK_KEY = "\u0000blank";

const TYPES = new Set(["text", "number", "date", "set", "boolean"]);

export function isFilterModel(value: unknown): value is ColumnFilterModel {
  return (
    typeof value === "object" &&
    value !== null &&
    TYPES.has((value as { type?: unknown }).type as string)
  );
}

function isBlank(value: unknown): boolean {
  return (
    value === null || value === undefined || (typeof value === "string" && value.trim() === "")
  );
}

/** The set-filter key of a cell value. */
export function filterKey(value: unknown): string {
  if (isBlank(value)) return BLANK_KEY;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? BLANK_KEY : isoDay(value);
  return String(value);
}

// ─── Conditions that are "complete" (an operand is present when needed) ────

function textComplete(c: TextCondition): boolean {
  return c.op === "blank" || c.op === "notBlank" || (c.value ?? "") !== "";
}
function numberComplete(c: NumberCondition): boolean {
  if (c.op === "blank" || c.op === "notBlank") return true;
  if (c.op === "between") return Number.isFinite(c.value) && Number.isFinite(c.to);
  return Number.isFinite(c.value);
}
function dateComplete(c: DateCondition): boolean {
  if (c.op === "blank" || c.op === "notBlank") return true;
  if (c.op === "preset") return c.preset !== undefined;
  if (c.op === "between") return Boolean(c.value) && Boolean(c.to);
  return Boolean(c.value);
}

/** Whether a model filters anything at all (an empty model removes the filter). */
export function isActiveFilter(model: unknown): boolean {
  if (!isFilterModel(model)) return model !== undefined && model !== null && model !== "";
  switch (model.type) {
    case "text":
      return model.conditions.some(textComplete);
    case "number":
      return model.conditions.some(numberComplete);
    case "date":
      return model.conditions.some(dateComplete);
    case "set":
      return true;
    case "boolean":
      return true;
  }
}

// ─── Evaluation ───────────────────────────────────────────────────────────

function combine(results: boolean[], join: Join | undefined): boolean {
  if (results.length === 0) return true;
  return join === "or" ? results.some(Boolean) : results.every(Boolean);
}

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function matchText(value: unknown, c: TextCondition): boolean {
  if (c.op === "blank") return isBlank(value);
  if (c.op === "notBlank") return !isBlank(value);
  const cell = normalizeText(value);
  const q = normalizeText(c.value);
  switch (c.op) {
    case "contains":
      return cell.includes(q);
    case "notContains":
      return !cell.includes(q);
    case "equals":
      return cell === q;
    case "notEquals":
      return cell !== q;
    case "startsWith":
      return cell.startsWith(q);
    case "endsWith":
      return cell.endsWith(q);
  }
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function matchNumber(value: unknown, c: NumberCondition): boolean {
  const n = toNumber(value);
  if (c.op === "blank") return n === null;
  if (c.op === "notBlank") return n !== null;
  if (n === null) return false;
  const v = c.value ?? 0;
  switch (c.op) {
    case "eq":
      return n === v;
    case "ne":
      return n !== v;
    case "gt":
      return n > v;
    case "gte":
      return n >= v;
    case "lt":
      return n < v;
    case "lte":
      return n <= v;
    case "between": {
      const lo = Math.min(v, c.to ?? v);
      const hi = Math.max(v, c.to ?? v);
      return n >= lo && n <= hi;
    }
  }
}

/** `YYYY-MM-DD` of a date in LOCAL time. */
export function isoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** A cell value as a local calendar day, or null. Accepts Date, ISO strings and epoch ms. */
export function toDay(value: unknown): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : isoDay(value);
  if (typeof value === "number" && Number.isFinite(value)) return isoDay(new Date(value));
  if (typeof value === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (m) {
      // A bare date is a calendar day; a timestamp is converted to local time.
      if (value.length === 10) return value;
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? `${m[1]}-${m[2]}-${m[3]}` : isoDay(d);
    }
  }
  return null;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

/** Inclusive `[from, to]` ISO days for a relative range, evaluated at `now` (weeks start Monday). */
export function presetRange(preset: DatePreset, now: Date): readonly [string, string] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekday = (today.getDay() + 6) % 7; // Monday = 0
  const q = Math.floor(today.getMonth() / 3);
  const day = (d: Date) => isoDay(d);
  switch (preset) {
    case "today":
      return [day(today), day(today)];
    case "yesterday": {
      const y = addDays(today, -1);
      return [day(y), day(y)];
    }
    case "last7Days":
      return [day(addDays(today, -6)), day(today)];
    case "last30Days":
      return [day(addDays(today, -29)), day(today)];
    case "last90Days":
      return [day(addDays(today, -89)), day(today)];
    case "thisWeek": {
      const start = addDays(today, -weekday);
      return [day(start), day(addDays(start, 6))];
    }
    case "lastWeek": {
      const start = addDays(today, -weekday - 7);
      return [day(start), day(addDays(start, 6))];
    }
    case "thisMonth":
      return [
        day(new Date(today.getFullYear(), today.getMonth(), 1)),
        day(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
      ];
    case "lastMonth":
      return [
        day(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        day(new Date(today.getFullYear(), today.getMonth(), 0)),
      ];
    case "thisQuarter":
      return [
        day(new Date(today.getFullYear(), q * 3, 1)),
        day(new Date(today.getFullYear(), q * 3 + 3, 0)),
      ];
    case "lastQuarter":
      return [
        day(new Date(today.getFullYear(), q * 3 - 3, 1)),
        day(new Date(today.getFullYear(), q * 3, 0)),
      ];
    case "thisYear":
      return [`${today.getFullYear()}-01-01`, `${today.getFullYear()}-12-31`];
    case "lastYear":
      return [`${today.getFullYear() - 1}-01-01`, `${today.getFullYear() - 1}-12-31`];
    case "yearToDate":
      return [`${today.getFullYear()}-01-01`, day(today)];
  }
}

function matchDate(value: unknown, c: DateCondition, now: Date): boolean {
  const d = toDay(value);
  if (c.op === "blank") return d === null;
  if (c.op === "notBlank") return d !== null;
  if (d === null) return false;
  switch (c.op) {
    case "on":
      return d === c.value;
    case "before":
      return d < (c.value ?? "");
    case "after":
      return d > (c.value ?? "");
    case "between": {
      const [lo, hi] = [c.value ?? "", c.to ?? ""].sort();
      return d >= lo! && d <= hi!;
    }
    case "preset": {
      if (!c.preset) return true;
      const [lo, hi] = presetRange(c.preset, now);
      return d >= lo && d <= hi;
    }
  }
}

/** Whether a cell value passes a column filter model. */
export function matchesFilter(
  value: unknown,
  model: ColumnFilterModel,
  now: Date = new Date(),
): boolean {
  return compileFilter(model, now)(value);
}

/**
 * Compiles a model into a predicate once per filter pass: relative date
 * ranges resolve against `now`, text queries normalise once, set values
 * become a `Set`. The filtered row model then calls only the predicate.
 */
export function compileFilter(
  model: ColumnFilterModel,
  now: Date = new Date(),
): (value: unknown) => boolean {
  switch (model.type) {
    case "text": {
      const conditions = model.conditions.filter(textComplete);
      if (conditions.length === 0) return () => true;
      return (value) =>
        combine(
          conditions.map((c) => matchText(value, c)),
          model.join,
        );
    }
    case "number": {
      const conditions = model.conditions.filter(numberComplete);
      if (conditions.length === 0) return () => true;
      return (value) =>
        combine(
          conditions.map((c) => matchNumber(value, c)),
          model.join,
        );
    }
    case "date": {
      const conditions: DateCondition[] = model.conditions.filter(dateComplete).map((c) => {
        if (c.op !== "preset" || !c.preset) return c;
        const [value, to] = presetRange(c.preset, now);
        return { op: "between", value, to };
      });
      if (conditions.length === 0) return () => true;
      return (value) =>
        combine(
          conditions.map((c) => matchDate(value, c, now)),
          model.join,
        );
    }
    case "set": {
      const included = new Set(model.values);
      return (value) => {
        if (Array.isArray(value)) {
          // Multi-valued cells (tags): the row passes when ANY value is included.
          return value.length === 0
            ? included.has(BLANK_KEY)
            : value.some((v) => included.has(filterKey(v)));
        }
        return included.has(filterKey(value));
      };
    }
    case "boolean":
      return (value) => Boolean(value) === model.value;
  }
}

// ─── Inference ──────────────────────────────────────────────────────────────

/** Unique string values at or below this count get a checklist (set) filter by default. */
export const SET_FILTER_MAX_UNIQUE = 200;

/**
 * The filter a column gets when its `meta.filter` doesn't say: numbers →
 * number, booleans → boolean, dates (Date / ISO strings) → date, low-
 * cardinality strings → set (a checklist, like a spreadsheet's AutoFilter),
 * other strings → text. Samples at most `limit` rows.
 */
export function inferFilterKind(values: Iterable<unknown>, limit = 2000): FilterKind {
  let n = 0;
  let numbers = 0;
  let booleans = 0;
  let dates = 0;
  let strings = 0;
  const unique = new Set<string>();
  for (const v of values) {
    if (n++ >= limit) break;
    if (isBlank(v)) continue;
    if (typeof v === "number" || typeof v === "bigint") numbers++;
    else if (typeof v === "boolean") booleans++;
    else if (v instanceof Date) dates++;
    else if (typeof v === "string") {
      if (/^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/.test(v)) dates++;
      else {
        strings++;
        if (unique.size <= SET_FILTER_MAX_UNIQUE) unique.add(v);
      }
    } else if (Array.isArray(v)) {
      strings++;
      for (const item of v) if (unique.size <= SET_FILTER_MAX_UNIQUE) unique.add(String(item));
    }
  }
  const max = Math.max(numbers, booleans, dates, strings);
  if (max === 0) return "text";
  if (max === numbers) return "number";
  if (max === booleans) return "boolean";
  if (max === dates) return "date";
  return unique.size <= SET_FILTER_MAX_UNIQUE ? "set" : "text";
}

// ─── Floating filter shorthand ───────────────────────────────────────────────

/**
 * Parses what someone types into a floating (header-row) filter:
 * text → `contains`; numbers accept `>5`, `>=5`, `<5`, `<=5`, `=5`, `!=5`,
 * `5..10` (between) or a bare number (equals). Empty input → `undefined`.
 */
export function parseFloatingInput(
  kind: "text" | "number",
  input: string,
): ColumnFilterModel | undefined {
  const s = input.trim();
  if (s === "") return undefined;
  if (kind === "text") return { type: "text", conditions: [{ op: "contains", value: s }] };
  const range = /^(-?\d+(?:\.\d+)?)\s*\.\.\s*(-?\d+(?:\.\d+)?)$/.exec(s);
  if (range) {
    return {
      type: "number",
      conditions: [{ op: "between", value: Number(range[1]), to: Number(range[2]) }],
    };
  }
  const m = /^(>=|<=|!=|<>|>|<|=)?\s*(-?\d+(?:\.\d+)?)$/.exec(s.replace(/,/g, ""));
  if (!m) return undefined;
  const ops: Record<string, NumberOperator> = {
    ">": "gt",
    ">=": "gte",
    "<": "lt",
    "<=": "lte",
    "=": "eq",
    "!=": "ne",
    "<>": "ne",
  };
  return { type: "number", conditions: [{ op: ops[m[1] ?? "="] ?? "eq", value: Number(m[2]) }] };
}

/** The inverse of `parseFloatingInput` for a model the floating input can show. */
export function floatingText(model: ColumnFilterModel | undefined): string {
  if (!model) return "";
  if (
    model.type === "text" &&
    model.conditions.length === 1 &&
    model.conditions[0]!.op === "contains"
  ) {
    return model.conditions[0]!.value ?? "";
  }
  if (model.type === "number" && model.conditions.length === 1) {
    const c = model.conditions[0]!;
    const sym: Partial<Record<NumberOperator, string>> = {
      eq: "",
      ne: "!=",
      gt: ">",
      gte: ">=",
      lt: "<",
      lte: "<=",
    };
    if (c.op === "between") return `${c.value ?? ""}..${c.to ?? ""}`;
    if (c.op in sym && c.value !== undefined) return `${sym[c.op]}${c.value}`;
  }
  return "";
}
