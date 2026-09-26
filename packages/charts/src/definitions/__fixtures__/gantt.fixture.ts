/**
 * Gantt: two tasks, one dependency.
 * Minimal props, so every default is exercised (RM-176).
 */

import type { GanttProps } from "../../gantt/gantt";
import { ganttTasks } from "./data";
import type { ChartFixture } from "./types";

export const GANTT_FIXTURE = {
  id: "Gantt",
  props: { tasks: ganttTasks } satisfies Omit<GanttProps, "children">,
  children: [],
} satisfies ChartFixture;
