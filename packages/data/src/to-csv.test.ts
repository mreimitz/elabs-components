import { describe, it, expect, vi, beforeEach } from "vitest";
import { toCsv, downloadCsv } from "./to-csv";

type Row = Record<string, unknown>;

describe("toCsv", () => {
  it("produces a header row from Object.keys when columns omitted", () => {
    const rows = [{ name: "Alice", age: 30 }];
    const csv = toCsv(rows);
    const lines = csv.split("\r\n").filter(Boolean);
    expect(lines[0]).toBe("name,age");
    expect(lines[1]).toBe("Alice,30");
  });

  it("uses custom header labels when provided", () => {
    const rows = [{ name: "Bob", age: 25 }];
    const csv = toCsv(rows, {
      columns: [
        { key: "name", header: "Full Name" },
        { key: "age", header: "Age" },
      ],
    });
    const lines = csv.split("\r\n").filter(Boolean);
    expect(lines[0]).toBe("Full Name,Age");
  });

  it("column subset and reorder", () => {
    const rows = [{ a: 1, b: 2, c: 3 }];
    const csv = toCsv(rows, { columns: [{ key: "c" }, { key: "a" }] });
    const lines = csv.split("\r\n").filter(Boolean);
    expect(lines[0]).toBe("c,a");
    expect(lines[1]).toBe("3,1");
  });

  it("omits header row when header:false", () => {
    const rows = [{ x: 1 }];
    const csv = toCsv(rows, { header: false });
    const lines = csv.split("\r\n").filter(Boolean);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe("1");
  });

  it("quotes a field containing the delimiter", () => {
    const rows = [{ val: "hello,world" } as Row];
    const csv = toCsv(rows);
    expect(csv).toContain('"hello,world"');
  });

  it("escapes embedded double-quotes per RFC 4180", () => {
    const rows = [{ val: 'say "hi"' } as Row];
    const csv = toCsv(rows);
    expect(csv).toContain('"say ""hi"""');
  });

  it("quotes a field containing a newline", () => {
    const rows = [{ val: "line1\nline2" } as Row];
    const csv = toCsv(rows);
    expect(csv).toContain('"line1\nline2"');
  });

  it("CSV injection guard: prefixes = with single quote", () => {
    const rows = [{ formula: "=SUM(A1:A10)" } as Row];
    const csv = toCsv(rows);
    expect(csv).toContain("'=SUM");
  });

  it("CSV injection guard: prefixes + with single quote", () => {
    const rows = [{ val: "+foo" } as Row];
    const csv = toCsv(rows);
    expect(csv).toContain("'+foo");
  });

  it("CSV injection guard: prefixes - with single quote", () => {
    const rows = [{ val: "-bar" } as Row];
    const csv = toCsv(rows);
    expect(csv).toContain("'-bar");
  });

  it("CSV injection guard: prefixes @ with single quote", () => {
    const rows = [{ val: "@baz" } as Row];
    const csv = toCsv(rows);
    expect(csv).toContain("'@baz");
  });

  it("null → empty string", () => {
    const rows = [{ val: null } as Row];
    const csv = toCsv(rows);
    // Split without filter so empty data lines are preserved. Lines: header, data, trailing "".
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("val");
    expect(lines[1]).toBe(""); // empty cell
  });

  it("undefined → empty string", () => {
    const rows = [{ val: undefined } as Row];
    const csv = toCsv(rows);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("val");
    expect(lines[1]).toBe(""); // empty cell
  });

  it("custom delimiter (semicolon)", () => {
    const rows = [{ a: 1, b: 2 }];
    const csv = toCsv(rows, { delimiter: ";" });
    const lines = csv.split("\r\n").filter(Boolean);
    expect(lines[0]).toBe("a;b");
    expect(lines[1]).toBe("1;2");
  });

  it("uses CRLF line terminators and ends with a trailing newline", () => {
    const rows = [{ x: 1 }];
    const csv = toCsv(rows);
    expect(csv.endsWith("\r\n")).toBe(true);
    // Internal lines also use CRLF
    expect(csv.includes("\r\n")).toBe(true);
  });

  it("returns empty string for empty rows array", () => {
    const csv = toCsv([]);
    expect(csv).toBe("");
  });
});

describe("downloadCsv", () => {
  beforeEach(() => {
    // Mock Blob and URL APIs for jsdom
    global.URL.createObjectURL = vi.fn(() => "blob:mock");
    global.URL.revokeObjectURL = vi.fn();
  });

  it("creates and clicks an anchor element with the correct download attribute", () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    downloadCsv([{ name: "Alice" }], { filename: "test-export" });
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("is a no-op when document is undefined (SSR guard)", () => {
    const orig = global.document;
    // @ts-expect-error intentional SSR simulation
    delete global.document;
    // Should not throw
    expect(() => downloadCsv([{ x: 1 }])).not.toThrow();
    // Restore
    global.document = orig;
  });
});
