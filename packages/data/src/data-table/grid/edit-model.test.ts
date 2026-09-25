import { describe, expect, it } from "vitest";
import {
  EditHistory,
  applyCellChanges,
  editText,
  inferEditor,
  parseCellText,
  parseDateText,
  parseNumberText,
  parseTsv,
  planFillDown,
  planPaste,
} from "./edit-model";

describe("parsing typed / pasted text", () => {
  it("reads numbers the way people write them", () => {
    expect(parseNumberText("1,234.5")).toBe(1234.5);
    expect(parseNumberText(" $1 234 ")).toBe(1234);
    expect(parseNumberText("(12)")).toBe(-12);
    expect(parseNumberText("12,5")).toBe(12.5);
    expect(parseNumberText("45%")).toBeCloseTo(0.45);
    expect(parseNumberText("-3e2")).toBe(-300);
    expect(parseNumberText("abc")).toBeNull();
    expect(parseNumberText("")).toBeNull();
  });
  it("reads dates as ISO days and rejects impossible ones", () => {
    expect(parseDateText("2026-2-3")).toBe("2026-02-03");
    expect(parseDateText("2026/12/31")).toBe("2026-12-31");
    expect(parseDateText("2026-02-30")).toBeNull();
    expect(parseDateText("nope")).toBeNull();
  });
  it("parses per editor kind", () => {
    expect(parseCellText("number", "")).toEqual({ ok: true, value: null });
    expect(parseCellText("number", "x")).toEqual({ ok: false, reason: "number" });
    expect(parseCellText("checkbox", "Yes")).toEqual({ ok: true, value: true });
    expect(parseCellText("checkbox", "maybe")).toEqual({ ok: false, reason: "option" });
    const options = [{ value: "eu", label: "Europe" }];
    expect(parseCellText("select", "europe", options)).toEqual({ ok: true, value: "eu" });
    expect(parseCellText("select", "Asia", options)).toEqual({ ok: false, reason: "option" });
    const prev = new Date(2026, 0, 1);
    const r = parseCellText("date", "2026-03-04", [], prev);
    expect(r.ok && r.value instanceof Date && r.value.getMonth()).toBe(2);
  });
  it("infers editors and starting text", () => {
    expect(inferEditor(3, false)).toBe("number");
    expect(inferEditor(true, false)).toBe("checkbox");
    expect(inferEditor("2026-01-01", false)).toBe("date");
    expect(inferEditor("x", true)).toBe("select");
    expect(inferEditor("x", false)).toBe("text");
    expect(editText("date", new Date(2026, 0, 2))).toBe("2026-01-02");
    expect(editText("number", null)).toBe("");
  });
});

describe("clipboard", () => {
  it("parses TSV with quotes, CRLF and a trailing newline", () => {
    expect(parseTsv('a\tb\r\n"c\td"\t"e ""q"""\n')).toEqual([
      ["a", "b"],
      ["c\td", 'e "q"'],
    ]);
    expect(parseTsv('"multi\nline"\tx')).toEqual([["multi\nline", "x"]]);
    expect(parseTsv("")).toEqual([]);
  });
  const box = (minRow: number, maxRow: number, minCol: number, maxCol: number) => ({
    minRow,
    maxRow,
    minCol,
    maxCol,
  });
  it("fills a selection with one value", () => {
    const plan = planPaste([["7"]], { row: 0, col: 0 }, [box(0, 1, 0, 1)], 10, 10);
    expect(plan).toHaveLength(4);
    expect(plan.every((p) => p.text === "7")).toBe(true);
  });
  it("tiles a block over a range that is a whole multiple of it", () => {
    const plan = planPaste([["a", "b"]], { row: 0, col: 0 }, [box(0, 1, 0, 3)], 10, 10);
    expect(plan.map((p) => p.text).join("")).toBe("abababab");
  });
  it("otherwise pastes from the active cell, clipped to the grid", () => {
    const plan = planPaste(
      [
        ["a", "b"],
        ["c", "d"],
      ],
      { row: 2, col: 1 },
      [box(2, 2, 1, 1)],
      3,
      2,
    );
    expect(plan).toEqual([{ row: 2, col: 1, text: "a" }]);
  });
  it("fill down copies each range's top row", () => {
    expect(planFillDown([box(0, 2, 1, 1)])).toEqual([
      { row: 1, col: 1, fromRow: 0 },
      { row: 2, col: 1, fromRow: 0 },
    ]);
  });
});

describe("history and applying", () => {
  const change = (value: number, previousValue: number) => ({
    rowId: "r1",
    columnId: "qty",
    value,
    previousValue,
  });
  it("undoes and redoes batches", () => {
    const h = new EditHistory();
    h.push([change(2, 1)]);
    h.push([change(3, 2)]);
    expect(h.undo()).toEqual([change(2, 3)]);
    expect(h.canRedo).toBe(true);
    expect(h.redo()).toEqual([change(3, 2)]);
    h.undo();
    h.push([change(9, 2)]);
    expect(h.canRedo).toBe(false);
    h.clear();
    expect(h.undo()).toBeNull();
  });
  it("applies changes immutably, by field then id, into nested objects", () => {
    const data = [
      { id: "r1", qty: 1, meta: { tag: "a" } },
      { id: "r2", qty: 2, meta: { tag: "b" } },
    ];
    const next = applyCellChanges(
      data,
      [
        { rowId: "r1", columnId: "qty", value: 5, previousValue: 1 },
        { rowId: "r1", columnId: "meta_tag", field: "meta.tag", value: "z", previousValue: "a" },
      ],
      (r) => r.id,
    );
    expect(next[0]).toEqual({ id: "r1", qty: 5, meta: { tag: "z" } });
    expect(next[1]).toBe(data[1]);
    expect(data[0]!.qty).toBe(1);
  });
});
