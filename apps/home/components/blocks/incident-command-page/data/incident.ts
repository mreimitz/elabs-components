// registry: incident-command-page — copied 2026-09-19
/** Acme Logistics — one live incident on the dispatch platform. Facts only. */

export const incident = {
  id: "INC-2291",
  severity: "SEV-2",
  title: "Route planner latency above 800 ms; dispatches queueing in EMEA",
  startedAt: "09:12",
  commander: "Noor Haddad",
  /** The latency promise, ms at p95. */
  sloMs: 400,
  affected: "38% of EMEA dispatch requests",
};

/** p95 latency per minute, the 40 minutes around the start of the incident. */
export const latencyMinutes = Array.from({ length: 40 }, (_, i) => {
  const base = 240 + Math.sin(i / 3) * 25;
  const spike = i > 17 ? Math.min(680, (i - 17) * 95) * Math.exp(-Math.max(0, i - 31) / 6) : 0;
  return { date: new Date(Date.UTC(2026, 8, 19, 8, 54 + i)), p95: Math.round(base + spike) };
});

/** Shape of the error-rate stream, percent of requests. */
export function errorRateAt(second: number): number {
  return Math.round((3.4 + Math.sin(second / 6) * 0.9 + Math.cos(second / 2.5) * 0.4) * 100) / 100;
}

export interface RunbookStep {
  id: string;
  title: string;
  command: string;
  /** What the command prints. ANSI allowed. */
  output: string;
  /** The line the incident log gets when the step is run. */
  logLine: string;
}

export const runbook: RunbookStep[] = [
  {
    id: "pods",
    title: "Check the solver pool",
    command: "kubectl -n dispatch get pods -l app=route-solver",
    output:
      "NAME                 READY  STATUS   RESTARTS  AGE\r\nroute-solver-7c9f-1  1/1    Running  0         3d\r\nroute-solver-7c9f-2  1/1    Running  0         3d\r\nroute-solver-7c9f-3  0/1    \x1b[31mOOMKilled\x1b[0m  4       3d\r\nroute-solver-7c9f-4  0/1    \x1b[31mOOMKilled\x1b[0m  3       3d\r\n",
    logLine: "Two of four solver pods are OOMKilled — capacity is halved.",
  },
  {
    id: "cause",
    title: "Find what is eating memory",
    command: "kubectl -n dispatch logs route-solver-7c9f-3 --previous | tail -3",
    output:
      "09:11:42 re-plan requested: depot=RTM stops=\x1b[33m2140\x1b[0m\r\n09:11:43 building distance matrix 2140x2140\r\n09:11:58 \x1b[31mfatal: out of memory\x1b[0m\r\n",
    logLine: "Cause found: a 2,140-stop Rotterdam re-plan builds a matrix the pods cannot hold.",
  },
  {
    id: "scale",
    title: "Add two large-memory workers",
    command: "kubectl -n dispatch scale deploy/route-solver-xl --replicas=2",
    output: "deployment.apps/route-solver-xl \x1b[32mscaled\x1b[0m\r\n",
    logLine: "Two large-memory workers added; the re-plan is routed to them.",
  },
  {
    id: "verify",
    title: "Confirm latency is back under the promise",
    command: "dispatchctl slo route-planner --window 5m",
    output: "route-planner  p95=\x1b[32m312ms\x1b[0m  slo=400ms  \x1b[32mOK\x1b[0m\r\n",
    logLine: "p95 back to 312 ms, under the 400 ms promise.",
  },
];

export interface IncidentLogEntry {
  title: string;
  detail: string;
  time: string;
  status: "done" | "active" | "pending";
}

export const incidentLog: IncidentLogEntry[] = [
  {
    title: "Customers notified",
    detail: "Status page updated: dispatch in EMEA is slower than usual.",
    time: "09:20",
    status: "done",
  },
  {
    title: "Incident declared",
    detail: "Noor Haddad is commander; Ravi Menon on communications.",
    time: "09:14",
    status: "done",
  },
  {
    title: "Alert fired",
    detail: "route-planner p95 above 800 ms for two minutes.",
    time: "09:12",
    status: "done",
  },
];

export const responders = [
  { name: "Noor Haddad", role: "Incident commander" },
  { name: "Ravi Menon", role: "Communications" },
  { name: "Mei Tanaka", role: "Route planner on-call" },
];
