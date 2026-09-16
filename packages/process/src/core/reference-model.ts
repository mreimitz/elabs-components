/**
 * Reference model — RM-061.
 *
 * A HAPPY PATH (the prescribed sequence of activities an owner or auditor expects) lifted
 * to the smallest workflow-net-like structure token replay can run against: one place
 * between consecutive steps, one visible transition per step, a silent SKIP transition
 * beside every optional step and a SELF-LOOP transition after every repeatable one.
 *
 * Scope boundary (analysis §9 risk 2): this is deliberately NOT a general Petri-net
 * importer. No BPMN, no parallel gateways, no alignments beyond skip/repeat. A host that
 * needs full alignment-based conformance brings a backend; this module never grows one.
 *
 * Framework-free, deterministic: no React, no `@elabs-ai/components-*` import.
 */

/** One prescribed step of a happy path. */
export interface HappyPathStep {
  /** Activity name, matched exactly against `EventRow.activity`. */
  activity: string;
  /** The step may be left out without a deviation (a silent skip arc is added). */
  optional?: boolean;
  /** The step may run several times in a row without a deviation (a self-loop is added). */
  repeatable?: boolean;
}

/** A prescribed process: an ordered list of steps. */
export interface HappyPath {
  id: string;
  label: string;
  steps: HappyPathStep[];
}

/**
 * What a transition stands for. `"step"` fires a step's activity for the first time,
 * `"repeat"` fires it again from the place after it, `"skip"` is SILENT (no activity is
 * observed) and moves the token past an optional step.
 */
export type ReplayTransitionKind = "step" | "skip" | "repeat";

/** One transition of a {@link ReplayModel}. */
export interface ReplayTransition {
  id: string;
  /** The activity this transition fires on. The skipped step's activity for a `"skip"`. */
  activity: string;
  kind: ReplayTransitionKind;
  /** Input places — one token each is consumed when the transition fires. */
  consumes: string[];
  /** Output places — one token each is produced when the transition fires. */
  produces: string[];
}

/** A workflow-net-like replay structure. Places are listed in path order. */
export interface ReplayModel {
  places: string[];
  initialMarking: string[];
  finalMarking: string[];
  transitions: ReplayTransition[];
}

/** Name of the place before step `index` (and after step `index - 1`). */
function placeName(index: number): string {
  return `p${index}`;
}

/**
 * Lift a happy path to a {@link ReplayModel}.
 *
 * For `n` steps the model has places `p0 … pn`, starts with one token in `p0` and ends
 * with one token in `pn`. Step `i` gets transition `t<i>` (`p<i>` → `p<i+1>`); an optional
 * step also gets a silent `skip<i>` over the same places; a repeatable step also gets
 * `repeat<i>` consuming and producing `p<i+1>`. An empty path lifts to a single place
 * that is both initial and final.
 */
export function liftHappyPath(path: HappyPath): ReplayModel {
  const steps = path.steps;
  const places: string[] = [];
  for (let i = 0; i <= steps.length; i += 1) places.push(placeName(i));

  const transitions: ReplayTransition[] = [];
  steps.forEach((step, i) => {
    const before = placeName(i);
    const after = placeName(i + 1);
    transitions.push({
      id: `t${i}`,
      activity: step.activity,
      kind: "step",
      consumes: [before],
      produces: [after],
    });
    if (step.optional) {
      transitions.push({
        id: `skip${i}`,
        activity: step.activity,
        kind: "skip",
        consumes: [before],
        produces: [after],
      });
    }
    if (step.repeatable) {
      transitions.push({
        id: `repeat${i}`,
        activity: step.activity,
        kind: "repeat",
        consumes: [after],
        produces: [after],
      });
    }
  });

  return {
    places,
    initialMarking: [placeName(0)],
    finalMarking: [placeName(steps.length)],
    transitions,
  };
}
