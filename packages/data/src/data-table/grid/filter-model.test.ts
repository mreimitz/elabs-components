import { describe, expect, it } from "vitest";
import {
  BLANK_KEY,
  compileFilter,
  filterKey,
  floatingText,
  inferFilterKind,
  isActiveFilter,
  isFilterModel,
  matchesFilter,
  parseFloatingInput,
  presetRange,
  toDay,
  type ColumnFilterModel,
} from "./filter-model";

// Wednesday 2026-09-23, local time.
const NOW = new Date(2026, 8, 23, 15, 30);

describe("text filters", () => {
  const f = (
    conditions: Extract<ColumnFilterModel, { type: "text" }>["conditions"],
    join?: "and" | "or",
  ) => ({ type: "text", conditions, join }) as ColumnFilterModel;

  it("matches case- and accent-insensitively", () => {
    expect(matchesFilter("Zürich", f([{ op: "contains", value: "zur" }]))).toBe(true);
    expect(matchesFilter("ACME", f([{ op: "equals", value: "acme" }]))).toBe(true);
    expect(matchesFilter("acme corp", f([{ op: "startsWith", value: "ACME" }]))).toBe(true);
    expect(matchesFilter("acme corp", f([{ op: "endsWith", value: "corp" }]))).toBe(true);
    expect(matchesFilter("acme", f([{ op: "notContains", value: "cm" }]))).toBe(false);
    expect(matchesFilter("acme", f([{ op: "notEquals", value: "acme" }]))).toBe(false);
  });

  it("treats null, undefined and whitespace as blank", () => {
    const blank = f([{ op: "blank" }]);
    expect(matchesFilter(null, blank)).toBe(true);
    expect(matchesFilter("  ", blank)).toBe(true);
    expect(matchesFilter("x", blank)).toBe(false);
    expect(matchesFilter(undefined, f([{ op: "notBlank" }]))).toBe(false);
  });

  it("joins conditions with AND / OR and ignores incomplete ones", () => {
    const and = f([
      { op: "contains", value: "a" },
      { op: "contains", value: "b" },
    ]);
    expect(matchesFilter("ab", and)).toBe(true);
    expect(matchesFilter("a", and)).toBe(false);
    const or = f(
      [
        { op: "contains", value: "a" },
        { op: "contains", value: "b" },
      ],
      "or",
    );
    expect(matchesFilter("b", or)).toBe(true);
    expect(matchesFilter("z", f([{ op: "contains", value: "" }]))).toBe(true);
  });
});

describe("number filters", () => {
  const n = (c: Extract<ColumnFilterModel, { type: "number" }>["conditions"][number]) =>
    ({ type: "number", conditions: [c] }) as ColumnFilterModel;
  it("compares numbers and numeric strings", () => {
    expect(matchesFilter(5, n({ op: "gt", value: 4 }))).toBe(true);
    expect(matchesFilter("5", n({ op: "gte", value: 5 }))).toBe(true);
    expect(matchesFilter(5, n({ op: "lt", value: 5 }))).toBe(false);
    expect(matchesFilter(5, n({ op: "lte", value: 5 }))).toBe(true);
    expect(matchesFilter(5, n({ op: "eq", value: 5 }))).toBe(true);
    expect(matchesFilter(5, n({ op: "ne", value: 5 }))).toBe(false);
  });
  it("between is inclusive and order-insensitive", () => {
    expect(matchesFilter(10, n({ op: "between", value: 10, to: 1 }))).toBe(true);
    expect(matchesFilter(11, n({ op: "between", value: 1, to: 10 }))).toBe(false);
  });
  it("non-numbers only pass blank", () => {
    expect(matchesFilter(null, n({ op: "gt", value: 0 }))).toBe(false);
    expect(matchesFilter("abc", n({ op: "blank" }))).toBe(true);
  });
});

describe("date filters", () => {
  const d = (c: Extract<ColumnFilterModel, { type: "date" }>["conditions"][number]) =>
    ({ type: "date", conditions: [c] }) as ColumnFilterModel;
  it("reads Date objects, ISO days, timestamps and epoch ms as local days", () => {
    expect(toDay(new Date(2026, 0, 2, 23, 59))).toBe("2026-01-02");
    expect(toDay("2026-01-02")).toBe("2026-01-02");
    expect(toDay(new Date(2026, 0, 2).getTime())).toBe("2026-01-02");
    expect(toDay("nope")).toBeNull();
  });
  it("on / before / after / between", () => {
    expect(matchesFilter("2026-03-01", d({ op: "on", value: "2026-03-01" }))).toBe(true);
    expect(matchesFilter("2026-03-01", d({ op: "before", value: "2026-03-01" }))).toBe(false);
    expect(matchesFilter("2026-03-02", d({ op: "after", value: "2026-03-01" }))).toBe(true);
    expect(
      matchesFilter("2026-03-05", d({ op: "between", value: "2026-03-09", to: "2026-03-01" })),
    ).toBe(true);
  });
  it("resolves relative ranges against now (weeks start Monday)", () => {
    expect(presetRange("today", NOW)).toEqual(["2026-09-23", "2026-09-23"]);
    expect(presetRange("yesterday", NOW)).toEqual(["2026-09-22", "2026-09-22"]);
    expect(presetRange("last7Days", NOW)).toEqual(["2026-09-17", "2026-09-23"]);
    expect(presetRange("thisWeek", NOW)).toEqual(["2026-09-21", "2026-09-27"]);
    expect(presetRange("lastWeek", NOW)).toEqual(["2026-09-14", "2026-09-20"]);
    expect(presetRange("thisMonth", NOW)).toEqual(["2026-09-01", "2026-09-30"]);
    expect(presetRange("lastMonth", NOW)).toEqual(["2026-08-01", "2026-08-31"]);
    expect(presetRange("thisQuarter", NOW)).toEqual(["2026-07-01", "2026-09-30"]);
    expect(presetRange("lastQuarter", NOW)).toEqual(["2026-04-01", "2026-06-30"]);
    expect(presetRange("lastYear", NOW)).toEqual(["2025-01-01", "2025-12-31"]);
    expect(presetRange("yearToDate", NOW)).toEqual(["2026-01-01", "2026-09-23"]);
    expect(presetRange("lastQuarter", new Date(2026, 1, 1))).toEqual(["2025-10-01", "2025-12-31"]);
    const pred = compileFilter(
      { type: "date", conditions: [{ op: "preset", preset: "last7Days" }] },
      NOW,
    );
    expect(pred("2026-09-17")).toBe(true);
    expect(pred("2026-09-16")).toBe(false);
  });
});

describe("set and boolean filters", () => {
  it("includes listed keys, (Blanks) and any value of a multi-valued cell", () => {
    const set: ColumnFilterModel = { type: "set", values: ["EU", BLANK_KEY] };
    expect(matchesFilter("EU", set)).toBe(true);
    expect(matchesFilter("US", set)).toBe(false);
    expect(matchesFilter(null, set)).toBe(true);
    expect(matchesFilter(["US", "EU"], set)).toBe(true);
    expect(matchesFilter([], set)).toBe(true);
    expect(matchesFilter(3, { type: "set", values: ["3"] })).toBe(true);
    expect(matchesFilter("x", { type: "set", values: [] })).toBe(false);
  });
  it("boolean", () => {
    expect(matchesFilter(true, { type: "boolean", value: true })).toBe(true);
    expect(matchesFilter(null, { type: "boolean", value: false })).toBe(true);
  });
  it("filterKey", () => {
    expect(filterKey("")).toBe(BLANK_KEY);
    expect(filterKey(new Date(2026, 0, 2))).toBe("2026-01-02");
  });
});

describe("model helpers", () => {
  it("recognises models and activity", () => {
    expect(isFilterModel({ type: "text", conditions: [] })).toBe(true);
    expect(isFilterModel(["a"])).toBe(false);
    expect(isActiveFilter({ type: "text", conditions: [{ op: "contains", value: "" }] })).toBe(
      false,
    );
    expect(isActiveFilter({ type: "number", conditions: [{ op: "between", value: 1 }] })).toBe(
      false,
    );
    expect(isActiveFilter({ type: "set", values: [] })).toBe(true);
    expect(isActiveFilter(["legacy"])).toBe(true);
  });
  it("infers a filter kind from sample values", () => {
    expect(inferFilterKind([1, 2, null])).toBe("number");
    expect(inferFilterKind([true, false])).toBe("boolean");
    expect(inferFilterKind(["2026-01-01", "2026-02-01T10:00:00Z"])).toBe("date");
    expect(inferFilterKind(["EU", "US", "EU"])).toBe("set");
    expect(inferFilterKind(Array.from({ length: 500 }, (_, i) => `name ${i}`))).toBe("text");
    expect(inferFilterKind([])).toBe("text");
  });
  it("parses and prints floating filter shorthand", () => {
    expect(parseFloatingInput("text", " ac ")).toEqual({
      type: "text",
      conditions: [{ op: "contains", value: "ac" }],
    });
    expect(parseFloatingInput("number", ">=1,000")).toEqual({
      type: "number",
      conditions: [{ op: "gte", value: 1000 }],
    });
    expect(parseFloatingInput("number", "5..10")).toEqual({
      type: "number",
      conditions: [{ op: "between", value: 5, to: 10 }],
    });
    expect(parseFloatingInput("number", "abc")).toBeUndefined();
    expect(parseFloatingInput("number", "")).toBeUndefined();
    for (const input of ["5", ">5", "<=2", "!=3", "1..4"]) {
      expect(floatingText(parseFloatingInput("number", input))).toBe(input);
    }
    expect(floatingText({ type: "set", values: [] })).toBe("");
  });
});
