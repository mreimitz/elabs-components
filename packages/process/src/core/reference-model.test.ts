import { describe, expect, it } from "vitest";

import { liftHappyPath } from "./reference-model";

describe("liftHappyPath", () => {
  it("lifts a plain sequence to one place between consecutive steps", () => {
    const model = liftHappyPath({
      id: "p",
      label: "Plain",
      steps: [{ activity: "A" }, { activity: "B" }],
    });
    expect(model.places).toEqual(["p0", "p1", "p2"]);
    expect(model.initialMarking).toEqual(["p0"]);
    expect(model.finalMarking).toEqual(["p2"]);
    expect(model.transitions).toEqual([
      { id: "t0", activity: "A", kind: "step", consumes: ["p0"], produces: ["p1"] },
      { id: "t1", activity: "B", kind: "step", consumes: ["p1"], produces: ["p2"] },
    ]);
  });

  it("adds a silent skip arc for an optional step and a self-loop for a repeatable one", () => {
    const model = liftHappyPath({
      id: "p",
      label: "Flags",
      steps: [{ activity: "A", optional: true, repeatable: true }],
    });
    expect(model.transitions).toEqual([
      { id: "t0", activity: "A", kind: "step", consumes: ["p0"], produces: ["p1"] },
      { id: "skip0", activity: "A", kind: "skip", consumes: ["p0"], produces: ["p1"] },
      { id: "repeat0", activity: "A", kind: "repeat", consumes: ["p1"], produces: ["p1"] },
    ]);
  });

  it("lifts an empty path to a single place that is both initial and final", () => {
    const model = liftHappyPath({ id: "e", label: "Empty", steps: [] });
    expect(model).toEqual({
      places: ["p0"],
      initialMarking: ["p0"],
      finalMarking: ["p0"],
      transitions: [],
    });
  });
});
