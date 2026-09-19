import type { GanttMarker, GanttTask } from "@elabs-ai/components-charts";

/** Acme Logistics — opening the Lyon depot. Dates are facts; every status word is derived. */
const day = (month: number, date: number) => new Date(Date.UTC(2026, month - 1, date));

export const LAUNCH_TODAY = day(9, 19);
export const LAUNCH_GO_LIVE = day(11, 2);

export const launchTasks: GanttTask[] = [
  { id: "site", name: "Site and permits", start: day(8, 3), end: day(9, 25), progress: 90 },
  {
    id: "lease",
    name: "Lease signed",
    parentId: "site",
    start: day(8, 3),
    end: day(8, 21),
    progress: 100,
    status: "success",
  },
  {
    id: "permit",
    name: "Operating permit",
    parentId: "site",
    start: day(8, 17),
    end: day(9, 25),
    progress: 80,
    status: "warning",
    dependencies: ["lease"],
    baseline: { start: day(8, 17), end: day(9, 11) },
  },
  { id: "fitout", name: "Fit-out", start: day(9, 1), end: day(10, 16), progress: 45 },
  {
    id: "racking",
    name: "Racking and docks",
    parentId: "fitout",
    start: day(9, 1),
    end: day(9, 30),
    progress: 70,
    status: "info",
  },
  {
    id: "systems",
    name: "Scanners and network",
    parentId: "fitout",
    start: day(9, 21),
    end: day(10, 16),
    progress: 10,
    status: "info",
    dependencies: ["racking"],
  },
  { id: "people", name: "People", start: day(9, 7), end: day(10, 23), progress: 35 },
  {
    id: "hiring",
    name: "Hire 24 operators",
    parentId: "people",
    start: day(9, 7),
    end: day(10, 9),
    progress: 50,
    status: "info",
  },
  {
    id: "training",
    name: "Safety and systems training",
    parentId: "people",
    start: day(10, 5),
    end: day(10, 23),
    progress: 0,
    dependencies: ["hiring", "systems"],
  },
  {
    id: "dry-run",
    name: "Dry run with live freight",
    start: day(10, 26),
    end: day(10, 30),
    progress: 0,
    dependencies: ["training", "permit"],
  },
  {
    id: "go-live",
    name: "Go live",
    start: LAUNCH_GO_LIVE,
    end: LAUNCH_GO_LIVE,
    isMilestone: true,
    dependencies: ["dry-run"],
  },
];

export const launchMarkers: GanttMarker[] = [
  { id: "today", date: LAUNCH_TODAY, label: "Today" },
  { id: "go-live", date: LAUNCH_GO_LIVE, label: "Go live" },
];
