import type { GanttTask } from "./gantt";
import { seededRnd } from "../marks/seeded-rnd";

/**
 * Fixture data shared by the virtualized story (`gantt.stories.tsx`) and its
 * determinism lock (`gantt.test.tsx`). Lives in its own non-story module
 * because `*.stories.tsx` is excluded from `tsconfig.json`'s `include` —
 * importing straight from the story file for the regression test pulled it
 * into the type-checked program anyway and surfaced an unrelated TS4023 on
 * `meta` (#275).
 *
 * `progress` is seeded (not `Math.random()`) — a random draw would make every
 * mount of `charts-gantt--virtualized` draw a different picture, which a
 * visual-regression shot or play-function assertion can never agree with.
 *
 * Exported as a FUNCTION, not a precomputed array (#275 round 2): a
 * module-level `const` is evaluated once and then shared by reference, so a
 * test that imports it and renders it twice proves only that React renders
 * the same object twice — true regardless of whether the values inside it
 * came from `seededRnd` or `Math.random()`. `buildVirtualizedTasks()` must be
 * called again to prove determinism; two independent calls only agree if the
 * generator itself is deterministic.
 */
const d = (offset: number): Date => {
  const base = new Date("2024-03-01");
  base.setDate(base.getDate() + offset);
  return base;
};

const VIRTUALIZED_SEED = 1;

export function buildVirtualizedTasks(): GanttTask[] {
  return Array.from({ length: 60 }, (_, i) => ({
    id: `task-${i}`,
    name: `Task ${i + 1}`,
    start: d(i * 2),
    end: d(i * 2 + 5 + (i % 4)),
    progress: seededRnd(i, VIRTUALIZED_SEED),
    status: (["success", "info", "warning", "neutral"] as const)[i % 4],
  }));
}

export const virtualizedTasks: GanttTask[] = buildVirtualizedTasks();
