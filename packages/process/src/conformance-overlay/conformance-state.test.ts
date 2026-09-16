import { describe, expect, it } from "vitest";
import { tokenReplay } from "../core/token-replay";
import { liftHappyPath } from "../core/reference-model";
import { discoverGraph } from "../core/discover-graph";
import { buildProcessMapModel } from "../process-map/map-model";
import { CONFORMANCE_FIXTURE_LOG, CONFORMANCE_FIXTURE_PATH } from "./conformance-fixture";
import {
  activityConformance,
  CONFORMANCE_STATE_ENCODING,
  CONFORMANCE_STATES,
  resolveConformanceStates,
  transitionConformance,
  withActivityConformance,
  withTransitionConformance,
} from "./conformance-state";

const conformance = tokenReplay(CONFORMANCE_FIXTURE_LOG, liftHappyPath(CONFORMANCE_FIXTURE_PATH));
const states = resolveConformanceStates(conformance);

describe("resolveConformanceStates — the RM-062 acceptance fixture", () => {
  it("marks the deliberately skipped step modelOnly", () => {
    expect(activityConformance(states, "Check credit")).toBe("modelOnly");
  });

  it("marks an activity outside the model logOnly and conforming steps both", () => {
    expect(activityConformance(states, "Escalate")).toBe("logOnly");
    expect(activityConformance(states, "Register")).toBe("both");
    expect(activityConformance(states, "Pay")).toBe("both");
    // An `incomplete` deviation does not move a modelled activity out of the model.
    expect(activityConformance(states, "Approve")).toBe("both");
  });

  it("marks the edges where the log diverged logOnly", () => {
    // The skip: cases jumped straight from Register to Approve.
    expect(transitionConformance(states, "Register", "Approve")).toBe("logOnly");
    // Into and out of the undesired activity.
    expect(transitionConformance(states, "Check credit", "Escalate")).toBe("logOnly");
    expect(transitionConformance(states, "Escalate", "Approve")).toBe("logOnly");
    // The prescribed arcs.
    expect(transitionConformance(states, "Register", "Check credit")).toBe("both");
    expect(transitionConformance(states, "Approve", "Pay")).toBe("both");
  });
});

describe("CONFORMANCE_STATE_ENCODING — never colour alone", () => {
  it("gives each state a distinct tone, glyph and dash", () => {
    for (const channel of ["tone", "glyph", "dash"] as const) {
      const values = CONFORMANCE_STATES.map((state) => CONFORMANCE_STATE_ENCODING[state][channel]);
      expect(new Set(values).size).toBe(CONFORMANCE_STATES.length);
    }
  });
});

describe("withActivityConformance / withTransitionConformance", () => {
  const model = buildProcessMapModel({
    graph: discoverGraph(CONFORMANCE_FIXTURE_LOG),
    metric: { node: "absolute_case", edge: "absolute" },
  });

  it("adds data-conformance beside data-selection and names the state", () => {
    const node = model.nodes.find((n) => n.id === "Check credit")!;
    const decorated = withActivityConformance(node, states);
    expect(decorated.data.conformance).toBe("modelOnly");
    expect(decorated.domAttributes).toMatchObject({
      "data-selection": node.data.selectionState,
      "data-conformance": "modelOnly",
    });
    expect(decorated.ariaLabel).toMatch(/Model only/);
    expect(decorated.ariaLabel?.startsWith(node.ariaLabel ?? "")).toBe(true);
  });

  it("folds the state into the edge's label-pill name as well as the edge's own", () => {
    const edge = model.edges.find((e) => e.source === "Register" && e.target === "Approve")!;
    const decorated = withTransitionConformance(edge, states);
    expect(decorated.data?.conformance).toBe("logOnly");
    expect(decorated.ariaLabel).toMatch(/Log only/);
    expect(decorated.data?.ariaLabel).toBe(decorated.ariaLabel);
  });
});
