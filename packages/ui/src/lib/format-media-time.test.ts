import { describe, expect, it } from "vitest";
import { formatMediaTime } from "./format-media-time";

describe("formatMediaTime", () => {
  it.each([
    [0, "0:00"],
    [0.99, "0:00"],
    [5, "0:05"],
    [59.9, "0:59"],
    [60, "1:00"],
    [83, "1:23"],
    [599, "9:59"],
    [600, "10:00"],
    [3599, "59:59"],
    [3600, "1:00:00"],
    [3723, "1:02:03"],
    [36000, "10:00:00"],
  ])("formats %s seconds as %s", (seconds, expected) => {
    expect(formatMediaTime(seconds)).toBe(expected);
  });

  it.each([NaN, Infinity, -Infinity, -5])("reads %s as 0:00", (seconds) => {
    expect(formatMediaTime(seconds)).toBe("0:00");
  });

  it("forces hours on request", () => {
    expect(formatMediaTime(65, { hours: true })).toBe("0:01:05");
    expect(formatMediaTime(NaN, { hours: true })).toBe("0:00:00");
  });
});
