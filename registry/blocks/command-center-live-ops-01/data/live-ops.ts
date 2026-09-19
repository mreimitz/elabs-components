/**
 * Acme Logistics — the dispatch platform's operations wall. Facts only; the block derives
 * every status word from these numbers at render time.
 */

function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** The shape of the throughput wave, so the stream looks like traffic and not noise. */
export function throughputAt(second: number): number {
  const wave = Math.sin(second / 5) * 140 + Math.cos(second / 2.2) * 45;
  return Math.round(1180 + wave + Math.sin(second / 17) * 90);
}

export interface OpsDial {
  id: string;
  label: string;
  /** 0–100. */
  value: number;
  target: number;
  suffix: string;
  caption: string;
}

export const opsDials: OpsDial[] = [
  {
    id: "sla",
    label: "on time",
    value: 94,
    target: 96,
    suffix: "%",
    caption: "Deliveries inside their promised window today; the target is 96%.",
  },
  {
    id: "capacity",
    label: "fleet in use",
    value: 81,
    target: 85,
    suffix: "%",
    caption: "Vehicles on a route right now; above 85% the next surge has nowhere to go.",
  },
  {
    id: "budget",
    label: "error budget left",
    value: 62,
    target: 50,
    suffix: "%",
    caption: "Share of this month's error budget still unspent; below 50% freezes releases.",
  },
];

export type ServiceState = "healthy" | "degraded" | "down";

export interface OpsService {
  name: string;
  state: ServiceState;
  /** p95 latency, ms. */
  latency: number;
  /** Requests per second, the trailing 20 minutes. */
  traffic: number[];
}

export const opsServices: OpsService[] = (() => {
  const rnd = seeded(9);
  const series = (base: number, swing: number) =>
    Array.from({ length: 20 }, (_, i) =>
      Math.round(base + Math.sin(i / 3) * swing + rnd() * swing),
    );
  return [
    { name: "Dispatch API", state: "healthy", latency: 182, traffic: series(420, 60) },
    { name: "Route planner", state: "degraded", latency: 910, traffic: series(160, 70) },
    { name: "Driver app sync", state: "healthy", latency: 240, traffic: series(610, 90) },
    { name: "Label printing", state: "healthy", latency: 96, traffic: series(80, 20) },
    {
      name: "Customs filing",
      state: "down",
      latency: 0,
      traffic: series(12, 10).map((v, i) => (i > 14 ? 0 : v)),
    },
  ];
})();

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));

/** Dispatches per weekday and hour, the trailing four weeks. */
export const dispatchLoad = (() => {
  const rnd = seeded(23);
  const rows: { day: string; hour: string; dispatches: number }[] = [];
  for (const day of DAYS) {
    const weekend = day === "Sat" || day === "Sun";
    for (const hour of HOURS) {
      const h = Number(hour);
      const morning = Math.exp(-((h - 8) ** 2) / 9);
      const evening = Math.exp(-((h - 17) ** 2) / 12) * 0.8;
      const level = (weekend ? 0.35 : 1) * (0.08 + morning + evening);
      rows.push({ day, hour, dispatches: Math.round(level * 320 * (0.8 + rnd() * 0.4)) });
    }
  }
  return { rows, days: DAYS, hours: HOURS };
})();

export interface OpsIncident {
  title: string;
  detail: string;
  time: string;
  status: "done" | "active" | "pending";
}

export const opsIncidents: OpsIncident[] = [
  {
    title: "Customs filing is down",
    detail: "Broker endpoint returns 503. Filings queue locally; nothing is lost.",
    time: "09:31",
    status: "active",
  },
  {
    title: "Route planner latency above 800 ms",
    detail: "Solver pool saturated by the Rotterdam re-plan. Two workers added.",
    time: "09:12",
    status: "active",
  },
  {
    title: "Driver app sync recovered",
    detail: "Token refresh fix deployed; backlog drained in six minutes.",
    time: "08:47",
    status: "done",
  },
  {
    title: "Label printer fleet firmware",
    detail: "Rollout scheduled for 22:00, after the evening wave.",
    time: "08:05",
    status: "pending",
  },
];
