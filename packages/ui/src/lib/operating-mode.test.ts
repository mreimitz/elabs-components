import { describe, expect, it } from "vitest";
import { effortRungForIndex } from "./operating-mode";

describe("effortRungForIndex", () => {
  it("returns the smallest rung for a single-level scale", () => {
    expect(effortRungForIndex(0, 1)).toBe("size-2.5");
  });

  it("returns the smallest rung for the first of several levels", () => {
    expect(effortRungForIndex(0, 4)).toBe("size-2.5");
  });

  it("returns the largest rung for the last of several levels", () => {
    expect(effortRungForIndex(3, 4)).toBe("size-6");
  });

  it("grows monotonically across the scale", () => {
    const RUNGS = [
      "size-2.5",
      "size-3",
      "size-3.5",
      "size-4",
      "size-4.5",
      "size-5",
      "size-5.5",
      "size-6",
    ];
    const count = 5;
    const indices = Array.from({ length: count }, (_, i) =>
      RUNGS.indexOf(effortRungForIndex(i, count)),
    );
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThanOrEqual(indices[i - 1]!);
    }
  });
});
