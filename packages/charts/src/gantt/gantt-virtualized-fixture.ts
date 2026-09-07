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
 */
const d = (offset: number): Date => {
  const base = new Date("2024-03-01");
  base.setDate(base.getDate() + offset);
  return base;
};

const VIRTUALIZED_SEED = 1;

export const virtualizedTasks: GanttTask[] = Array.from({ length: 60 }, (_, i) => ({
  id: `task-${i}`,
  name: `Task ${i + 1}`,
  start: d(i * 2),
  end: d(i * 2 + 5 + (i % 4)),
  progress: seededRnd(i, VIRTUALIZED_SEED),
  status: (["success", "info", "warning", "neutral"] as const)[i % 4],
}));
