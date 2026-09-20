import { describe, expect, it } from "vitest";

import {
  PLAN_FILL_OPACITY,
  PLAN_STATUSES,
  PLAN_STATUS_ENCODING,
  planStatusMatch,
} from "./plan-status";

describe("PLAN_STATUS_ENCODING", () => {
  it("covers every status exactly once, in legend order", () => {
    expect(PLAN_STATUSES).toEqual(["free", "occupied", "warning", "down"]);
    expect(Object.keys(PLAN_STATUS_ENCODING).sort()).toEqual([...PLAN_STATUSES].sort());
  });

  it("gives every status its own texture and its own outline style", () => {
    const patterns = PLAN_STATUSES.map((status) => PLAN_STATUS_ENCODING[status].pattern);
    const dashes = PLAN_STATUSES.map((status) => PLAN_STATUS_ENCODING[status].dash);

    // Four statuses, four textures, four outline styles: in greyscale they still
    // read apart, which is the whole point of the table (WCAG 1.4.1).
    expect(new Set(patterns).size).toBe(PLAN_STATUSES.length);
    expect(new Set(dashes).size).toBe(PLAN_STATUSES.length);
  });

  it("carries a glyph only on the two states that must never be missed", () => {
    expect(PLAN_STATUS_ENCODING.free.icon).toBeUndefined();
    expect(PLAN_STATUS_ENCODING.occupied.icon).toBeUndefined();
    expect(PLAN_STATUS_ENCODING.warning.icon).toBeDefined();
    expect(PLAN_STATUS_ENCODING.down.icon).toBeDefined();
    expect(PLAN_STATUS_ENCODING.warning.glyph).not.toBe(PLAN_STATUS_ENCODING.down.glyph);
  });

  it("leaves the free status solid, so a dash always means something", () => {
    expect(PLAN_STATUS_ENCODING.free.dashArray).toBeUndefined();
    for (const status of ["occupied", "warning", "down"] as const) {
      expect(PLAN_STATUS_ENCODING[status].dashArray?.length).toBeGreaterThan(1);
    }
  });

  it("keeps the ink rung off the mark rung", () => {
    for (const status of PLAN_STATUSES) {
      const encoding = PLAN_STATUS_ENCODING[status];
      expect(encoding.markClass.startsWith("bg-")).toBe(true);
      // `-text` is the ink rung; a bare `text-<tone>` would be the 3:1 fill rung.
      expect(
        encoding.textClass.endsWith("-text") || encoding.textClass === "text-muted-foreground",
      ).toBe(true);
    }
  });

  it("cannot be edited by a surface that reads it", () => {
    expect(Object.isFrozen(PLAN_STATUS_ENCODING)).toBe(true);
    expect(Object.isFrozen(PLAN_FILL_OPACITY)).toBe(true);
  });

  it("rises in opacity from rest through hover to selected", () => {
    expect(PLAN_FILL_OPACITY.rest).toBeLessThan(PLAN_FILL_OPACITY.hover);
    expect(PLAN_FILL_OPACITY.hover).toBeLessThan(PLAN_FILL_OPACITY.selected);
  });
});

describe("planStatusMatch", () => {
  it("builds one MapLibre match over the status property", () => {
    const expression = planStatusMatch("state", (encoding) => encoding.dash, "solid");

    expect(expression).toEqual([
      "match",
      ["get", "state"],
      "free",
      "solid",
      "occupied",
      "dotted",
      "warning",
      "dashed",
      "down",
      "dot-dash",
      "solid",
    ]);
  });

  it("falls back to the occupied value when no fallback is given", () => {
    const expression = planStatusMatch("status", (encoding) => encoding.pattern);

    expect(expression.at(-1)).toBe(PLAN_STATUS_ENCODING.occupied.pattern);
  });
});
