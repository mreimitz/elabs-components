import { describe, expect, it } from "vitest";
import { DATA_TABLE_BREAKPOINT_THRESHOLDS, tableBreakpointForWidth } from "./use-table-breakpoint";

describe("tableBreakpointForWidth", () => {
  it("is narrow below 450 px; the boundary and unmeasured widths are wide", () => {
    expect(DATA_TABLE_BREAKPOINT_THRESHOLDS.narrow).toBe(450);
    expect(tableBreakpointForWidth(348)).toBe("narrow");
    expect(tableBreakpointForWidth(449.5)).toBe("narrow");
    expect(tableBreakpointForWidth(450)).toBe("wide");
    expect(tableBreakpointForWidth(640)).toBe("wide");
    expect(tableBreakpointForWidth(0)).toBe("wide");
    expect(tableBreakpointForWidth(Number.NaN)).toBe("wide");
  });
});
