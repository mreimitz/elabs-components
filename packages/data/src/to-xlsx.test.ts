import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { columnName, crc32, tableToXlsx, toXlsx, zipStore } from "./to-xlsx";

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe("xlsx", () => {
  it("computes CRC-32 and column names", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    expect([0, 25, 26, 27, 701, 702].map(columnName)).toEqual(["A", "Z", "AA", "AB", "ZZ", "AAA"]);
  });

  it("writes a zip whose entries are stored verbatim", () => {
    const zip = zipStore([{ name: "a.txt", data: new TextEncoder().encode("hello") }]);
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
    expect(text(zip)).toContain("hello");
    expect(text(zip)).toContain("a.txt");
  });

  it("types cells, bolds and freezes the header, escapes XML", () => {
    const bytes = toXlsx(
      [
        ["A&B <x>", 12.5, true, new Date(2026, 0, 2)],
        [null, -1, false, undefined],
      ],
      { headers: ["Name", "Qty", "Ok", "Day"], sheetName: "Trades: Q1" },
    );
    const body = text(bytes);
    expect(body).toContain('<c r="A1" t="inlineStr" s="1">');
    expect(body).toContain("A&amp;B &lt;x&gt;");
    expect(body).toContain('<c r="B2"><v>12.5</v></c>');
    expect(body).toContain('<c r="C2" t="b"><v>1</v></c>');
    expect(body).toContain('<c r="D2" s="2"><v>46024</v></c>');
    expect(body).toContain('state="frozen"');
    expect(body).toContain('name="Trades  Q1"');
    if (process.env.XLSX_OUT) writeFileSync(process.env.XLSX_OUT, bytes);
  });

  it("exports a table's filtered, sorted rows with ISO days as dates", () => {
    const table = {
      getVisibleLeafColumns: () => [
        { id: "name", columnDef: { header: "Name" } },
        { id: "day", columnDef: { header: "Day" } },
      ],
      getPrePaginatedRowModel: () => ({
        rows: [{ getValue: (id: string) => (id === "name" ? "x" : "2026-01-02") }],
      }),
    };
    const body = text(tableToXlsx(table));
    expect(body).toContain('<c r="B2" s="2"><v>46024</v></c>');
  });
});
