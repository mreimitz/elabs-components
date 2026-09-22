/**
 * gantt-schedule.ts — framework-free schedule maths behind the critical path and the
 * progress line. Pure functions over `ResolvedTask`s; the Gantt only draws the result.
 */
import type { ResolvedTask } from "./gantt-context";

/** The critical path: task ids with zero total float and the dependency edges between them. */
export interface CriticalPath {
  tasks: Set<string>;
  /** `"${fromId}→${toId}"` keys of the edges on the path. */
  edges: Set<string>;
}

/**
 * Classic CPM forward/backward pass over the dependency graph (finish-to-start, no lag).
 *
 * Durations are the tasks' own spans (a summary's span is its children's envelope, so
 * summaries are skipped as nodes — their children carry the path). Tasks without a
 * dependency chain that end at the project finish are critical too: the path is every
 * task whose earliest and latest finish coincide. Cycles are cut at the first back edge.
 */
export function computeCriticalPath(tasks: readonly ResolvedTask[]): CriticalPath {
  const nodes = tasks.filter((t) => !t.hasChildren);
  const byId = new Map(nodes.map((t) => [t.id, t]));
  const durationOf = (t: ResolvedTask) => Math.max(0, t.end.getTime() - t.start.getTime());
  // Successors map + in-degree for Kahn's topological order (cycle-safe).
  const successors = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  for (const t of nodes) {
    successors.set(t.id, []);
    indegree.set(t.id, 0);
  }
  for (const t of nodes) {
    for (const dep of t.dependencies ?? []) {
      if (!byId.has(dep)) continue;
      successors.get(dep)!.push(t.id);
      indegree.set(t.id, (indegree.get(t.id) ?? 0) + 1);
    }
  }
  const order: string[] = [];
  const queue = nodes.filter((t) => (indegree.get(t.id) ?? 0) === 0).map((t) => t.id);
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of successors.get(id) ?? []) {
      const left = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, left);
      if (left === 0) queue.push(next);
    }
  }
  // Nodes left out of `order` sit on a cycle — they are neither scheduled nor critical.
  const empty: CriticalPath = { tasks: new Set(), edges: new Set() };
  if (order.length === 0) return empty;

  // Forward pass: earliest start/finish anchored at each task's own start (a task never
  // starts before its planned date, and never before its predecessors finish).
  const es = new Map<string, number>();
  const ef = new Map<string, number>();
  for (const id of order) {
    const t = byId.get(id)!;
    let start = t.start.getTime();
    for (const dep of t.dependencies ?? []) {
      const f = ef.get(dep);
      if (f !== undefined) start = Math.max(start, f);
    }
    es.set(id, start);
    ef.set(id, start + durationOf(t));
  }
  const projectFinish = Math.max(...order.map((id) => ef.get(id)!));

  // Backward pass: latest finish/start.
  const lf = new Map<string, number>();
  const ls = new Map<string, number>();
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i]!;
    const t = byId.get(id)!;
    let finish = projectFinish;
    for (const next of successors.get(id) ?? []) {
      const s = ls.get(next);
      if (s !== undefined) finish = Math.min(finish, s);
    }
    lf.set(id, finish);
    ls.set(id, finish - durationOf(t));
  }

  const critical = new Set<string>();
  for (const id of order) {
    if (ls.get(id)! - es.get(id)! <= 0 && ef.get(id)! >= lf.get(id)!) critical.add(id);
  }
  const edges = new Set<string>();
  for (const id of critical) {
    for (const dep of byId.get(id)!.dependencies ?? []) {
      // The edge is critical when the predecessor's finish drives this start.
      if (critical.has(dep) && ef.get(dep) === es.get(id)) edges.add(`${dep}→${id}`);
    }
  }
  return { tasks: critical, edges };
}

/**
 * Where the progress line bends on a task at `statusDate`: the point the task has reached
 * (start + progress × duration), or the status date itself for work not yet started, or
 * the task end once it is done. Milestones sit at their own date when reached.
 */
export function progressPointAt(task: ResolvedTask, statusDate: Date): Date {
  const status = statusDate.getTime();
  const start = task.start.getTime();
  const end = task.end.getTime();
  // A milestone before the status date is passed (unless explicitly 0 % done).
  if (task.isMilestone) return end <= status && task.progress !== 0 ? task.end : statusDate;
  if (start >= status) return statusDate;
  const progress = Math.min(1, Math.max(0, task.progress ?? 0));
  return new Date(Math.min(start + progress * (end - start), end));
}
