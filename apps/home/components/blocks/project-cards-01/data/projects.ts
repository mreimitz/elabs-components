// registry: project-cards-01 — copied 2026-09-19
/** A delivery team's projects this cycle. Facts only; health is derived at render time. */

export type ProjectKind = "Launch" | "Improvement" | "Fix" | "Maintenance";
export type ProjectState = "active" | "paused" | "done";

export interface Project {
  id: string;
  name: string;
  kind: ProjectKind;
  state: ProjectState;
  lead: string;
  team: string[];
  /** Tasks closed and in total. */
  closed: number;
  total: number;
  /** Days into the cycle and its length. */
  day: number;
  days: number;
  due: string;
}

export const projects: Project[] = [
  {
    id: "REP-241",
    name: "Live re-planning",
    kind: "Launch",
    state: "active",
    lead: "Mei Tanaka",
    team: ["Mei Tanaka", "Noor Haddad", "Ravi Menon"],
    closed: 31,
    total: 42,
    day: 30,
    days: 42,
    due: "2 Oct",
  },
  {
    id: "CUS-118",
    name: "Customs pre-check",
    kind: "Improvement",
    state: "active",
    lead: "Leila Haddad",
    team: ["Leila Haddad", "Jonas Weber"],
    closed: 9,
    total: 27,
    day: 24,
    days: 35,
    due: "9 Oct",
  },
  {
    id: "DRV-077",
    name: "Driver app sessions",
    kind: "Fix",
    state: "active",
    lead: "Sven Aalto",
    team: ["Sven Aalto", "Mei Tanaka"],
    closed: 12,
    total: 13,
    day: 9,
    days: 14,
    due: "24 Sep",
  },
  {
    id: "CAR-052",
    name: "Per-lane carbon report",
    kind: "Launch",
    state: "active",
    lead: "Ava Reyes",
    team: ["Ava Reyes", "Ravi Menon", "Leila Haddad", "Jonas Weber"],
    closed: 4,
    total: 30,
    day: 12,
    days: 56,
    due: "13 Nov",
  },
  {
    id: "INF-033",
    name: "Solver pool capacity",
    kind: "Maintenance",
    state: "paused",
    lead: "Noor Haddad",
    team: ["Noor Haddad"],
    closed: 6,
    total: 11,
    day: 20,
    days: 28,
    due: "On hold",
  },
  {
    id: "SET-019",
    name: "Audit log export",
    kind: "Improvement",
    state: "done",
    lead: "Ravi Menon",
    team: ["Ravi Menon", "Noor Haddad"],
    closed: 8,
    total: 8,
    day: 14,
    days: 14,
    due: "Shipped 12 Sep",
  },
];

/** A project is behind when its share of tasks closed trails its share of time used by this much. */
export const BEHIND_BY = 0.15;
