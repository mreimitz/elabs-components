/**
 * Meridian Commerce, a fictional online retailer — 90 days of production incidents as the
 * on-call desk sees them. Every number on screen (the KPIs, the per-day and per-service
 * aggregations, the table) is computed from these rows at render time.
 */

/** A small seeded generator so the sample data is identical on every render. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export const INCIDENTS_AS_OF = "30 Sep 2026";
export const INCIDENTS_SOURCE = "Pager log · postmortem tracker";

export const SEVERITIES = ["SEV1", "SEV2", "SEV3", "SEV4"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const INCIDENT_STATUSES = ["open", "mitigated", "resolved"] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

/** A `type`, not an interface, so a row satisfies the charts' `Record<string, unknown>` data. */
export type Incident = {
  id: string;
  /** The day it opened (UTC midnight) — the value the daily chart's time axis selects. */
  day: Date;
  openedAt: Date;
  service: string;
  severity: Severity;
  region: "EU" | "US" | "APAC";
  status: IncidentStatus;
  /** Minutes from page to resolved; `null` while still open. */
  minutesToResolve: number | null;
  summary: string;
};

/** The services, with how often each one pages and how badly. */
const SERVICES: ReadonlyArray<{ name: string; weight: number; severe: number }> = [
  { name: "Payments", weight: 2.2, severe: 0.32 },
  { name: "Checkout", weight: 1.9, severe: 0.24 },
  { name: "Search", weight: 1.4, severe: 0.12 },
  { name: "Auth", weight: 1.1, severe: 0.28 },
  { name: "Catalog", weight: 1.3, severe: 0.08 },
  { name: "Notifications", weight: 0.9, severe: 0.05 },
  { name: "Billing", weight: 0.8, severe: 0.18 },
  { name: "Mobile API", weight: 1.2, severe: 0.15 },
];

const REGIONS = ["EU", "US", "APAC"] as const;

const SUMMARIES: Record<Severity, readonly string[]> = {
  SEV1: [
    "Error rate above 5 % on the primary region",
    "Requests time out after the 14:00 deploy",
    "Queue backlog past the paging threshold",
  ],
  SEV2: [
    "p99 latency doubled for ten minutes",
    "Partial outage in one availability zone",
    "Retries saturate the downstream connection pool",
  ],
  SEV3: [
    "Elevated 5xx on a single endpoint",
    "Cache hit rate dropped after the config change",
    "Stale replicas served for a few minutes",
  ],
  SEV4: [
    "Alert flapped without customer impact",
    "Dashboard gap — metrics pipeline lagged",
    "Non-critical cron job missed its slot",
  ],
};

const DAY = 86_400_000;
/** The first of the 90 days (UTC). */
const FIRST_DAY = Date.UTC(2026, 6, 3);
export const INCIDENT_DAYS = 90;

/** Every day in the window, first to last — the daily chart's x values. */
export const incidentDays: Date[] = Array.from(
  { length: INCIDENT_DAYS },
  (_, i) => new Date(FIRST_DAY + i * DAY),
);

/**
 * ~230 incidents over 90 days: a baseline of two or three a day, more on Tuesdays (deploy
 * day), a bad week in late August when Payments was migrated, and a quiet spell after it.
 * Sorted newest first, the way the pager shows them.
 */
export const incidents: Incident[] = (() => {
  const rnd = seeded(23);
  const totalWeight = SERVICES.reduce((sum, s) => sum + s.weight, 0);
  const pickService = () => {
    let roll = rnd() * totalWeight;
    for (const s of SERVICES) {
      roll -= s.weight;
      if (roll <= 0) return s;
    }
    return SERVICES[SERVICES.length - 1]!;
  };
  const rows: Incident[] = [];
  let counter = 4120;
  for (let i = 0; i < INCIDENT_DAYS; i++) {
    const day = incidentDays[i]!;
    const weekday = day.getUTCDay();
    // Deploy Tuesdays page more; weekends less; the migration week (days 52–58) a lot more.
    let expected = 2.4;
    if (weekday === 2) expected += 1.2;
    if (weekday === 0 || weekday === 6) expected -= 1.1;
    if (i >= 52 && i <= 58) expected += 3.5;
    if (i >= 59 && i <= 70) expected -= 0.8;
    const count = Math.max(0, Math.round(expected + (rnd() - 0.5) * 2.4));
    for (let n = 0; n < count; n++) {
      const service = i >= 52 && i <= 58 && rnd() < 0.5 ? SERVICES[0]! : pickService();
      const severeRoll = rnd();
      const severity: Severity =
        severeRoll < service.severe * 0.35
          ? "SEV1"
          : severeRoll < service.severe
            ? "SEV2"
            : severeRoll < 0.72
              ? "SEV3"
              : "SEV4";
      const openedAt = new Date(day.getTime() + Math.floor(rnd() * 24 * 60) * 60_000);
      const isRecent = i >= INCIDENT_DAYS - 2;
      const status: IncidentStatus =
        isRecent && rnd() < 0.5 ? (rnd() < 0.5 ? "open" : "mitigated") : "resolved";
      const base = { SEV1: 95, SEV2: 60, SEV3: 38, SEV4: 22 }[severity];
      const minutesToResolve =
        status === "open" ? null : Math.round(base * (0.5 + rnd() * 1.4) + rnd() * 10);
      const summaries = SUMMARIES[severity];
      rows.push({
        id: `INC-${counter++}`,
        day,
        openedAt,
        service: service.name,
        severity,
        region: REGIONS[Math.floor(rnd() * REGIONS.length)]!,
        status,
        minutesToResolve,
        summary: summaries[Math.floor(rnd() * summaries.length)]!,
      });
    }
  }
  return rows.sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime());
})();

/** The services, in the order the ranking lists them: busiest first. */
export const serviceNames: string[] = (() => {
  const counts = new Map<string, number>();
  for (const row of incidents) counts.set(row.service, (counts.get(row.service) ?? 0) + 1);
  return SERVICES.map((s) => s.name).sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
})();
