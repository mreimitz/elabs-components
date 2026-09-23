/**
 * Aldermere Mutual, a fictional insurer with offices and data centres on four continents — its
 * security operations centre on a Wednesday afternoon. The queue holds the alerts the detections
 * raised and nobody has closed yet; the assets are where they fired; the incident history is the
 * last 90 days as the incident explorer reads it. Every number on screen is computed from these
 * rows at render time.
 */
import {
  incidentDays,
  type Incident,
  type Severity as IncidentSeverity,
} from "@/components/incident-explorer-01/data/incident-explorer";

/** A small seeded generator so the sample data is identical on every render. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export const ALERTS_AS_OF = "30 Sep 2026 · 15:42 UTC";

export const ALERT_SEVERITIES = ["critical", "high", "medium", "low"] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const ALERT_SOURCES = ["Identity", "Endpoint", "Email", "Cloud", "Network"] as const;
export type AlertSource = (typeof ALERT_SOURCES)[number];

/** Where an alert stands in triage. `new` and `triaging` are open; the other two are done. */
export type AlertStatus = "new" | "triaging" | "contained" | "closed";

export interface Site {
  id: string;
  name: string;
  city: string;
  /** [longitude, latitude]. */
  position: [number, number];
  kind: "office" | "data centre" | "cloud region";
}

export interface Asset {
  id: string;
  hostname: string;
  siteId: string;
  /** [longitude, latitude] — the site, jittered so a cluster has something to open. */
  position: [number, number];
  owner: string;
  role: string;
}

export interface Alert {
  id: string;
  severity: AlertSeverity;
  source: AlertSource;
  /** The detection that fired, as the rule names itself. */
  rule: string;
  assetId: string;
  user: string;
  /** Minutes since the alert was raised, at `ALERTS_AS_OF`. */
  ageMinutes: number;
  status: AlertStatus;
  /** The ATT&CK-style tactic the rule is filed under. */
  tactic: string;
  /** What the detection saw — indicators an enrichment would look up. */
  indicators: string[];
  summary: string;
  /** The playbook's recommended response, as the runbook words it. */
  playbook: string;
}

export const sites: Site[] = [
  {
    id: "FRA",
    name: "Frankfurt DC-1",
    city: "Frankfurt",
    position: [8.68, 50.11],
    kind: "data centre",
  },
  { id: "DUB", name: "Dublin campus", city: "Dublin", position: [-6.26, 53.35], kind: "office" },
  { id: "LON", name: "London office", city: "London", position: [-0.12, 51.5], kind: "office" },
  {
    id: "NYC",
    name: "New York office",
    city: "New York",
    position: [-74.0, 40.71],
    kind: "office",
  },
  {
    id: "AWS-E1",
    name: "Cloud · us-east-1",
    city: "Ashburn",
    position: [-77.49, 39.04],
    kind: "cloud region",
  },
  {
    id: "SIN",
    name: "Singapore DC-2",
    city: "Singapore",
    position: [103.82, 1.35],
    kind: "data centre",
  },
  { id: "SYD", name: "Sydney office", city: "Sydney", position: [151.21, -33.87], kind: "office" },
  {
    id: "SAO",
    name: "São Paulo office",
    city: "São Paulo",
    position: [-46.63, -23.55],
    kind: "office",
  },
];

const OWNERS = [
  "a.okafor",
  "m.lindqvist",
  "r.tanaka",
  "s.varga",
  "j.mbeki",
  "l.ferreira",
  "k.nowak",
  "d.brennan",
  "p.iyer",
  "h.schulz",
  "c.moreau",
  "t.nguyen",
];

const ROLES: Record<Site["kind"], string[]> = {
  office: ["laptop", "laptop", "laptop", "meeting-room display", "print server"],
  "data centre": ["database", "app server", "file server", "domain controller", "jump host"],
  "cloud region": ["api gateway", "worker", "object store", "build runner", "identity provider"],
};

/** 84 assets: ten or twelve per site, laptops in offices, servers in the data centres. */
export const assets: Asset[] = (() => {
  const rnd = seeded(41);
  const rows: Asset[] = [];
  let n = 100;
  for (const site of sites) {
    const count = site.kind === "office" ? 12 : 9;
    for (let i = 0; i < count; i++) {
      const role = ROLES[site.kind][Math.floor(rnd() * ROLES[site.kind].length)]!;
      const prefix = role
        .split(" ")[0]!
        .replace(/[^a-z]/g, "")
        .slice(0, 3);
      rows.push({
        id: `AST-${n++}`,
        hostname: `${site.id.toLowerCase().replace(/-/g, "")}-${prefix}-${String(i + 1).padStart(2, "0")}`,
        siteId: site.id,
        position: [
          site.position[0] + (rnd() - 0.5) * 0.06,
          site.position[1] + (rnd() - 0.5) * 0.04,
        ],
        owner: OWNERS[Math.floor(rnd() * OWNERS.length)]!,
        role,
      });
    }
  }
  return rows;
})();

/** The first asset of a role at a site — the generator names the hosts, the alerts name roles. */
const at = (siteId: string, role: string) =>
  (assets.find((a) => a.siteId === siteId && a.role === role) ??
    assets.find((a) => a.siteId === siteId))!.id;

/**
 * The queue as the shift found it: 14 alerts, oldest a shift and a half old, three that belong
 * together (the same user, the same afternoon), and the noise that every queue carries.
 */
export const alerts: Alert[] = [
  {
    id: "ALT-7821",
    severity: "critical",
    source: "Endpoint",
    rule: "Credential dumping tool executed",
    assetId: at("FRA", "domain controller"),
    user: "svc-backup",
    ageMinutes: 9,
    status: "new",
    tactic: "Credential access",
    indicators: ["procdump64.exe", "sha256:4c1e…9b2a", "lsass.exe"],
    summary:
      "A process dump of lsass.exe was written by a service account that never runs interactively, on a domain controller.",
    playbook:
      "Isolate the host now, reset the service account, then hunt for the dump file on every host it reached.",
  },
  {
    id: "ALT-7819",
    severity: "critical",
    source: "Network",
    rule: "Outbound connection to a known command-and-control address",
    assetId: at("FRA", "domain controller"),
    user: "svc-backup",
    ageMinutes: 14,
    status: "new",
    tactic: "Command and control",
    indicators: ["203.0.113.34:443", "TLS SNI cdn-metrics.example", "beacon interval 60 s"],
    summary:
      "The same domain controller opened a TLS session to an address on two blocklists and has kept it up for eleven minutes at a steady interval.",
    playbook:
      "Block the address at the edge, isolate the host, capture the session before it drops.",
  },
  {
    id: "ALT-7816",
    severity: "high",
    source: "Identity",
    rule: "Impossible travel sign-in",
    assetId: at("AWS-E1", "identity provider"),
    user: "svc-backup",
    ageMinutes: 31,
    status: "triaging",
    tactic: "Initial access",
    indicators: [
      "sign-in from 203.0.113.34",
      "Frankfurt → Bucharest in 4 min",
      "MFA not challenged",
    ],
    summary:
      "A service account signed in from a second country four minutes after Frankfurt; the policy that should have prompted for MFA is scoped to people, not services.",
    playbook:
      "Revoke the account's sessions and tokens; extend the MFA policy to service principals.",
  },
  {
    id: "ALT-7823",
    severity: "high",
    source: "Email",
    rule: "Credential-harvesting page linked from external mail",
    assetId: at("LON", "laptop"),
    user: "c.moreau",
    ageMinutes: 6,
    status: "new",
    tactic: "Initial access",
    indicators: [
      "hxxps://aldermere-payroll.example/login",
      "sender payroll@aldermere-hr.example",
      "12 recipients",
    ],
    summary:
      "Twelve people in Finance received a payroll notice pointing at a page that imitates the sign-in screen; one has clicked.",
    playbook: "Pull the mail from every mailbox, block the domain, reset the one who clicked.",
  },
  {
    id: "ALT-7812",
    severity: "high",
    source: "Cloud",
    rule: "New administrator role granted outside change window",
    assetId: at("AWS-E1", "identity provider"),
    user: "k.nowak",
    ageMinutes: 58,
    status: "new",
    tactic: "Privilege escalation",
    indicators: ["role AdministratorAccess", "principal k.nowak", "no change ticket"],
    summary:
      "A platform engineer attached the broadest role to their own principal at 14:44, with no ticket referencing it.",
    playbook:
      "Confirm with the engineer's lead; remove the role if there is no ticket within the hour.",
  },
  {
    id: "ALT-7809",
    severity: "medium",
    source: "Endpoint",
    rule: "Mass file rename with a new extension",
    assetId: at("DUB", "laptop"),
    user: "s.varga",
    ageMinutes: 82,
    status: "triaging",
    tactic: "Impact",
    indicators: ["1,480 files renamed", "extension .bak → .zip", "explorer.exe"],
    summary:
      "A laptop renamed fourteen hundred files in a minute — the pattern a ransomware run makes, and the pattern an archive job makes.",
    playbook: "Ask the owner what ran; if nothing, isolate and image.",
  },
  {
    id: "ALT-7805",
    severity: "medium",
    source: "Identity",
    rule: "MFA fatigue — repeated push prompts",
    assetId: at("NYC", "laptop"),
    user: "d.brennan",
    ageMinutes: 121,
    status: "new",
    tactic: "Credential access",
    indicators: ["9 push prompts in 6 min", "all denied", "source 198.51.100.8"],
    summary: "Nine push prompts in six minutes, all denied by the user — someone has the password.",
    playbook: "Reset the password and re-enrol MFA; the denials mean nothing got in.",
  },
  {
    id: "ALT-7801",
    severity: "medium",
    source: "Cloud",
    rule: "Object store bucket made public",
    assetId: at("AWS-E1", "object store"),
    user: "t.nguyen",
    ageMinutes: 164,
    status: "new",
    tactic: "Exfiltration",
    indicators: ["bucket claims-export-prod", "ACL public-read", "2.1 GB"],
    summary:
      "A production export bucket was made world-readable by a deploy script; nothing has read it from outside yet.",
    playbook:
      "Revert the ACL, check the access log, tell the data-protection officer if anything read it.",
  },
  {
    id: "ALT-7798",
    severity: "medium",
    source: "Network",
    rule: "Port scan from an internal host",
    assetId: at("SIN", "jump host"),
    user: "p.iyer",
    ageMinutes: 190,
    status: "triaging",
    tactic: "Discovery",
    indicators: ["2,400 ports on 31 hosts", "nmap user agent", "jump host"],
    summary:
      "A jump host scanned the management network — a pen test is scheduled this week, but not on that host.",
    playbook: "Confirm the scan with the pen-test lead before anything else.",
  },
  {
    id: "ALT-7794",
    severity: "low",
    source: "Endpoint",
    rule: "Unsigned binary in a temp folder",
    assetId: at("SYD", "laptop"),
    user: "r.tanaka",
    ageMinutes: 240,
    status: "new",
    tactic: "Execution",
    indicators: ["C:\\Users\\r.tanaka\\AppData\\Local\\Temp\\setup_7.exe", "unsigned"],
    summary:
      "A developer ran an unsigned installer from a temp folder; the hash is unknown, the vendor is not.",
    playbook: "Check the hash; if it is the tool the owner says, add it to the allow list.",
  },
  {
    id: "ALT-7790",
    severity: "low",
    source: "Email",
    rule: "Attachment with a macro from a first-time sender",
    assetId: at("SAO", "laptop"),
    user: "l.ferreira",
    ageMinutes: 305,
    status: "new",
    tactic: "Initial access",
    indicators: ["invoice_0930.xlsm", "sender first seen today"],
    summary:
      "A macro-enabled spreadsheet from a supplier the mailbox has never seen — quarantined, not delivered.",
    playbook: "Detonate in the sandbox; release if it is the invoice it claims to be.",
  },
  {
    id: "ALT-7786",
    severity: "low",
    source: "Cloud",
    rule: "Access key unused for 90 days",
    assetId: at("AWS-E1", "build runner"),
    user: "h.schulz",
    ageMinutes: 410,
    status: "new",
    tactic: "Persistence",
    indicators: ["key AKIA…Q7", "last used 2 Jul 2026"],
    summary: "A build runner still holds a key nothing has used since July.",
    playbook: "Rotate or delete it — hygiene, not an incident.",
  },
  {
    id: "ALT-7780",
    severity: "high",
    source: "Endpoint",
    rule: "Scheduled task created by a non-admin",
    assetId: at("DUB", "print server"),
    user: "m.lindqvist",
    ageMinutes: 520,
    status: "contained",
    tactic: "Persistence",
    indicators: ["schtasks /create", "runs at logon", "powershell -enc"],
    summary:
      "A laptop gained a logon-time task that runs encoded PowerShell; the host was isolated this morning.",
    playbook: "Image the host, decode the payload, close when the task and its payload are gone.",
  },
  {
    id: "ALT-7774",
    severity: "medium",
    source: "Identity",
    rule: "Sign-in from an anonymising network",
    assetId: at("LON", "meeting-room display"),
    user: "a.okafor",
    ageMinutes: 600,
    status: "closed",
    tactic: "Initial access",
    indicators: ["exit node 192.0.2.77", "device compliant"],
    summary:
      "A compliant, enrolled laptop signed in through an anonymising network — the owner was travelling and said so.",
    playbook: "Closed as benign: the device was theirs and the session was expected.",
  },
];

const SOURCE_WEIGHTS: ReadonlyArray<{ name: AlertSource; weight: number; severe: number }> = [
  { name: "Identity", weight: 2.1, severe: 0.3 },
  { name: "Endpoint", weight: 1.9, severe: 0.34 },
  { name: "Email", weight: 1.6, severe: 0.12 },
  { name: "Cloud", weight: 1.2, severe: 0.22 },
  { name: "Network", weight: 0.9, severe: 0.2 },
];

const REGIONS = ["EU", "US", "APAC"] as const;

const SUMMARIES: Record<IncidentSeverity, readonly string[]> = {
  SEV1: [
    "Confirmed intrusion — host isolated, credentials reset",
    "Data left the estate before the block landed",
    "Privileged account used from outside the country",
  ],
  SEV2: [
    "Phishing campaign with a credential page; two accounts reset",
    "Malware executed, contained before it spread",
    "Public bucket held customer data for under an hour",
  ],
  SEV3: [
    "Suspicious sign-in — owner confirmed travel",
    "Unsigned binary, allow-listed after review",
    "Scan from an internal host — a test, unannounced",
  ],
  SEV4: [
    "Detection tuned after a false positive",
    "Stale access key rotated",
    "Alert flapped during a log-pipeline outage",
  ],
};

/**
 * 90 days of security incidents (~170), as the incident explorer reads them: the `service`
 * field carries the SOURCE that raised each one, so the explorer's ranking reads "incidents by
 * source". A phishing wave in mid-August, quieter weekends.
 */
export const securityIncidents: Incident[] = (() => {
  const rnd = seeded(77);
  const total = SOURCE_WEIGHTS.reduce((sum, s) => sum + s.weight, 0);
  const pickSource = () => {
    let roll = rnd() * total;
    for (const s of SOURCE_WEIGHTS) {
      roll -= s.weight;
      if (roll <= 0) return s;
    }
    return SOURCE_WEIGHTS[SOURCE_WEIGHTS.length - 1]!;
  };
  const rows: Incident[] = [];
  let counter = 2210;
  for (let i = 0; i < incidentDays.length; i++) {
    const day = incidentDays[i]!;
    const weekday = day.getUTCDay();
    let expected = 1.9;
    if (weekday === 0 || weekday === 6) expected -= 0.9;
    if (i >= 40 && i <= 47) expected += 2.6;
    const count = Math.max(0, Math.round(expected + (rnd() - 0.5) * 2));
    for (let n = 0; n < count; n++) {
      const source = i >= 40 && i <= 47 && rnd() < 0.55 ? SOURCE_WEIGHTS[2]! : pickSource();
      const roll = rnd();
      const severity: IncidentSeverity =
        roll < source.severe * 0.3
          ? "SEV1"
          : roll < source.severe
            ? "SEV2"
            : roll < 0.7
              ? "SEV3"
              : "SEV4";
      const openedAt = new Date(day.getTime() + Math.floor(rnd() * 24 * 60) * 60_000);
      const recent = i >= incidentDays.length - 2;
      const status = recent && rnd() < 0.5 ? (rnd() < 0.5 ? "open" : "mitigated") : "resolved";
      const base = { SEV1: 240, SEV2: 120, SEV3: 55, SEV4: 25 }[severity];
      const summaries = SUMMARIES[severity];
      rows.push({
        id: `SEC-${counter++}`,
        day,
        openedAt,
        service: source.name,
        severity,
        region: REGIONS[Math.floor(rnd() * REGIONS.length)]!,
        status,
        minutesToResolve: status === "open" ? null : Math.round(base * (0.5 + rnd() * 1.4)),
        summary: summaries[Math.floor(rnd() * summaries.length)]!,
      });
    }
  }
  return rows.sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime());
})();

/** The sources, busiest first — the order the explorer ranks them in. */
export const sourceNames: string[] = (() => {
  const counts = new Map<string, number>();
  for (const row of securityIncidents) counts.set(row.service, (counts.get(row.service) ?? 0) + 1);
  return ALERT_SOURCES.map((s) => s as string).sort(
    (a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0),
  );
})();
