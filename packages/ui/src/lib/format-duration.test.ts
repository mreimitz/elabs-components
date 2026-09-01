import { describe, expect, it } from "vitest";
import { formatElapsed } from "./format-duration";

describe("formatElapsed", () => {
  it.each([
    // [elapsedMs, expected]
    [0, "0ms"],
    [420, "420ms"],
    [999, "999ms"],
    [1000, "1.0s"],
    [8000, "8.0s"],
    [9949, "9.9s"],
    [10000, "10s"],
    [42000, "42s"],
    [59000, "59s"],
    [60000, "1m00s"],
    [77000, "1m17s"],
    [605000, "10m05s"],
  ] as const)("formats %dms as %s", (elapsedMs, expected) => {
    expect(formatElapsed(elapsedMs)).toBe(expected);
  });
});
