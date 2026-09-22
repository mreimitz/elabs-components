import { describe, expect, it } from "vitest";

import type { ResolvedTask } from "./gantt-context";
import { computeCriticalPath, progressPointAt } from "./gantt-schedule";

const day = 86_400_000;
const d = (n: number) => new Date(Date.UTC(2024, 0, 1) + n * day);
const task = (
  id: string,
  start: number,
  end: number,
  extra: Partial<ResolvedTask> = {},
): ResolvedTask => ({
  id,
  name: id,
  start: d(start),
  end: d(end),
  level: 1,
  setSize: 1,
  posInSet: 1,
  hasChildren: false,
  ...extra,
});

describe("computeCriticalPath", () => {
  it("finds the longest dependency chain and its edges", () => {
    // A(0-4) → B(4-10) → D(10-12) is 12 days; A → C(4-6) → D has float.
    const path = computeCriticalPath([
      task("A", 0, 4),
      task("B", 4, 10, { dependencies: ["A"] }),
      task("C", 4, 6, { dependencies: ["A"] }),
      task("D", 10, 12, { dependencies: ["B", "C"] }),
    ]);
    expect([...path.tasks].sort()).toEqual(["A", "B", "D"]);
    expect([...path.edges].sort()).toEqual(["A→B", "B→D"]);
  });

  it("skips summaries and survives a cycle", () => {
    const path = computeCriticalPath([
      task("S", 0, 10, { hasChildren: true }),
      task("X", 0, 5, { dependencies: ["Y"], parentId: "S" }),
      task("Y", 5, 10, { dependencies: ["X"], parentId: "S" }),
      task("Z", 0, 10),
    ]);
    expect([...path.tasks]).toEqual(["Z"]);
  });

  it("an independent task ending at the project finish is critical too", () => {
    const path = computeCriticalPath([task("A", 0, 3), task("B", 0, 5)]);
    expect([...path.tasks]).toEqual(["B"]);
  });
});

describe("progressPointAt", () => {
  const status = d(5);
  it("sits at the status date for work not yet started", () => {
    expect(progressPointAt(task("A", 6, 8), status)).toEqual(status);
  });
  it("bends to the reached point of a started task, behind or ahead", () => {
    expect(progressPointAt(task("A", 0, 10, { progress: 0.3 }), status)).toEqual(d(3));
    expect(progressPointAt(task("A", 0, 10, { progress: 0.7 }), status)).toEqual(d(7));
    expect(progressPointAt(task("A", 0, 4, { progress: 1 }), status)).toEqual(d(4));
  });
  it("a milestone before the status date is passed unless explicitly 0 % done", () => {
    expect(progressPointAt(task("M", 8, 8, { isMilestone: true }), status)).toEqual(status);
    expect(progressPointAt(task("M", 3, 3, { isMilestone: true }), status)).toEqual(d(3));
    expect(progressPointAt(task("M", 3, 3, { isMilestone: true, progress: 0 }), status)).toEqual(
      status,
    );
  });
});
