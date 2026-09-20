/** A product team's board, mid-cycle. */

export type IssueStatus = "backlog" | "todo" | "doing" | "review" | "done";
export type IssuePriority = "urgent" | "high" | "normal" | "low";

export interface Issue {
  id: string;
  title: string;
  status: IssueStatus;
  priority: IssuePriority;
  assignee: string;
  labels: string[];
  /** Estimate in points. */
  points: number;
}

export interface BoardColumn {
  id: IssueStatus;
  label: string;
  /** Most cards the team agreed to hold here at once. */
  limit?: number;
}

export const boardColumns: BoardColumn[] = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "To do", limit: 5 },
  { id: "doing", label: "In progress", limit: 3 },
  { id: "review", label: "In review", limit: 3 },
  { id: "done", label: "Done" },
];

export const issues: Issue[] = [
  {
    id: "OPS-412",
    title: "Re-plan routes when an order lands after cut-off",
    status: "doing",
    priority: "urgent",
    assignee: "Mei Tanaka",
    labels: ["planner"],
    points: 8,
  },
  {
    id: "OPS-409",
    title: "Driver app: keep the session through an app update",
    status: "review",
    priority: "high",
    assignee: "Sven Aalto",
    labels: ["driver app", "bug"],
    points: 3,
  },
  {
    id: "OPS-405",
    title: "Customs: check HS codes before the vessel cut-off",
    status: "doing",
    priority: "high",
    assignee: "Leila Haddad",
    labels: ["customs"],
    points: 5,
  },
  {
    id: "OPS-401",
    title: "Exceptions table: sort by closest promise",
    status: "done",
    priority: "normal",
    assignee: "Ravi Menon",
    labels: ["control tower"],
    points: 2,
  },
  {
    id: "OPS-398",
    title: "Label printing falls back to factory media after power loss",
    status: "doing",
    priority: "high",
    assignee: "Jonas Weber",
    labels: ["depot", "bug"],
    points: 3,
  },
  {
    id: "OPS-396",
    title: "Per-lane carbon report",
    status: "todo",
    priority: "normal",
    assignee: "Ava Reyes",
    labels: ["reports"],
    points: 8,
  },
  {
    id: "OPS-390",
    title: "Invite flow: show seats left before sending",
    status: "todo",
    priority: "low",
    assignee: "Noor Haddad",
    labels: ["settings"],
    points: 2,
  },
  {
    id: "OPS-388",
    title: "Solver pool: route large re-plans to high-memory workers",
    status: "review",
    priority: "urgent",
    assignee: "Noor Haddad",
    labels: ["planner", "reliability"],
    points: 5,
  },
  {
    id: "OPS-381",
    title: "Returns module: first cut",
    status: "backlog",
    priority: "normal",
    assignee: "Mei Tanaka",
    labels: ["returns"],
    points: 13,
  },
  {
    id: "OPS-377",
    title: "Dark theme for the driver app",
    status: "backlog",
    priority: "low",
    assignee: "Sven Aalto",
    labels: ["driver app"],
    points: 5,
  },
  {
    id: "OPS-370",
    title: "Audit log export as CSV",
    status: "done",
    priority: "normal",
    assignee: "Ravi Menon",
    labels: ["settings"],
    points: 3,
  },
];
