import { describe, expect, it } from "vitest";
import { columnSizeStyle, formatCellValue, resolveShowAt } from "./column-meta";

const fmt = (n: number, opts?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat("en-US", opts).format(n);

describe("column-meta", () => {
  it("formatCellValue mirrors the charts valueFormat object shape", () => {
    expect(formatCellValue(1234.5, undefined, fmt)).toBe("1,234.5");
    expect(formatCellValue(1234.5, { abbreviate: false, decimals: 0 }, fmt)).toBe("1,235");
    expect(formatCellValue(1500, {}, fmt)).toBe("1.5K");
    expect(formatCellValue(0.423, { style: "percent" }, fmt)).toBe("42.3%");
    expect(formatCellValue(12, { sign: "always", suffix: " pts" }, fmt)).toBe("+12 pts");
    expect(formatCellValue(-12, { sign: "parens" }, fmt)).toBe("(12)");
    expect(formatCellValue(12, { decimals: 1, optionalDecimals: false }, fmt)).toBe("12.0");
    expect(formatCellValue(820, { style: "currency", currency: "EUR", decimals: 0 }, fmt)).toBe(
      "€820",
    );
    expect(formatCellValue(12345, { abbreviate: false, grouping: false }, fmt)).toBe("12345");
    expect(formatCellValue("text", { decimals: 2 }, fmt)).toBe("text");
    expect(formatCellValue(null, undefined, fmt)).toBe("");
  });

  it("resolveShowAt: base is the wide value, narrow overrides below 450 px", () => {
    expect(resolveShowAt(undefined, "narrow")).toBe(true);
    expect(resolveShowAt(false, "wide")).toBe(false);
    expect(resolveShowAt({ base: true, narrow: false }, "wide")).toBe(true);
    expect(resolveShowAt({ base: true, narrow: false }, "narrow")).toBe(false);
    expect(resolveShowAt({ base: false }, "narrow")).toBe(false);
  });

  it("columnSizeStyle: width %, min width px, style last; nothing for a plain column", () => {
    expect(columnSizeStyle(undefined)).toBeUndefined();
    expect(columnSizeStyle({ numeric: true })).toBeUndefined();
    expect(columnSizeStyle({ width: 30, minWidth: 80, style: { fontStyle: "italic" } })).toEqual({
      width: "30%",
      minWidth: 80,
      fontStyle: "italic",
    });
    expect(columnSizeStyle({ width: -4 })).toEqual({ width: "0%" });
  });
});
