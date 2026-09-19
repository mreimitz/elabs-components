import { describe, expect, it } from "vitest";
import { stickyRowPinning } from "./sticky-rows";

describe("stickyRowPinning", () => {
  const data = [{ n: "a" }, { n: "avg" }, { n: "b" }, { n: "total" }];
  it("maps records to TanStack row ids (index, or getRowId) in data order", () => {
    const sticky = (r: { n: string }) =>
      r.n === "avg" ? "top" : r.n === "total" ? "bottom" : undefined;
    expect(stickyRowPinning(data, sticky)).toEqual({ top: ["1"], bottom: ["3"] });
    expect(stickyRowPinning(data, sticky, (r) => r.n)).toEqual({ top: ["avg"], bottom: ["total"] });
  });
  it("is empty without a predicate or a match", () => {
    expect(stickyRowPinning(data, undefined)).toEqual({ top: [], bottom: [] });
    expect(stickyRowPinning(data, () => undefined)).toEqual({ top: [], bottom: [] });
  });
});
