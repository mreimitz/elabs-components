/**
 * analytics/ — the framework-free statistics behind `analytics[]` (ADR 0040 §1):
 * the declared contract (`types.ts`, RM-136) and the maths (RM-137) that the
 * overlays of RM-138 / RM-139 call. Nothing here imports React, the DOM or
 * the chart context.
 */

export * from "./types";
export * from "./stats";
export * from "./regression";
export * from "./window";
export * from "./forecast";
