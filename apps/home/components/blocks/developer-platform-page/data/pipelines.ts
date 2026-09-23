// registry: developer-platform-page — copied 2026-09-23
/**
 * Larkspur Systems, a fictional company that runs a storefront, its checkout and the workers
 * behind them — the delivery platform team's control room on a Tuesday morning. The pipeline is
 * the same for every service; the runs are today's, newest first; the deploy history is the
 * last 28 days as the DORA figures read it; the audit trail is what the platform recorded. Every
 * number on screen is computed from these rows at render time.
 */
import type { Actor, AuditEntry } from "../../agent-ops-parts/data/atlas-ops";

/** A small seeded generator so the sample data is identical on every render. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export const RUNS_AS_OF = "6 Oct 2026 · 10:20 UTC";

/** How a run is named on screen — its number behind a hash, the way CI systems print it. */
export const runLabel = (id: string) => `#${id}`;
const NOW = Date.UTC(2026, 9, 6, 10, 20);

export const SERVICES = [
  "checkout-api",
  "storefront-web",
  "payments-worker",
  "platform-infra",
] as const;
export type Service = (typeof SERVICES)[number];

export const RUN_STATUSES = ["failed", "running", "success", "cancelled"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export type StageStatus = "success" | "failed" | "running" | "skipped" | "queued";

export const STAGE_IDS = [
  "checkout",
  "install",
  "lint",
  "typecheck",
  "unit",
  "build",
  "e2e",
  "staging",
  "production",
] as const;
export type StageId = (typeof STAGE_IDS)[number];

export interface Stage {
  id: StageId;
  name: string;
  /** What the stage runs, as the pipeline file names it. */
  command: string;
  /** Stages this one waits for. */
  after: StageId[];
  /** Canvas position, left to right. */
  position: { x: number; y: number };
}

/** The one pipeline every service runs: a fan-out after install, a fan-in before build. */
export const stages: Stage[] = [
  {
    id: "checkout",
    name: "Checkout",
    command: "git fetch --depth=1",
    after: [],
    position: { x: 0, y: 120 },
  },
  {
    id: "install",
    name: "Install",
    command: "pnpm install --frozen-lockfile",
    after: ["checkout"],
    position: { x: 220, y: 120 },
  },
  {
    id: "lint",
    name: "Lint",
    command: "pnpm lint",
    after: ["install"],
    position: { x: 440, y: 0 },
  },
  {
    id: "typecheck",
    name: "Typecheck",
    command: "pnpm typecheck",
    after: ["install"],
    position: { x: 440, y: 120 },
  },
  {
    id: "unit",
    name: "Unit tests",
    command: "pnpm test",
    after: ["install"],
    position: { x: 440, y: 240 },
  },
  {
    id: "build",
    name: "Build",
    command: "pnpm build",
    after: ["lint", "typecheck", "unit"],
    position: { x: 660, y: 120 },
  },
  {
    id: "e2e",
    name: "End-to-end",
    command: "pnpm e2e --project=chromium",
    after: ["build"],
    position: { x: 880, y: 120 },
  },
  {
    id: "staging",
    name: "Deploy staging",
    command: "platform deploy staging",
    after: ["e2e"],
    position: { x: 1100, y: 120 },
  },
  {
    id: "production",
    name: "Deploy production",
    command: "platform deploy production --approve",
    after: ["staging"],
    position: { x: 1320, y: 120 },
  },
];

export interface StageResult {
  status: StageStatus;
  durationSec: number;
}

export interface RunFailure {
  stage: StageId;
  /** The test, rule or check that failed, as the tool names it. */
  check: string;
  file: string;
  message: string;
  /** The lines the tool printed — what the run log shows for the failing stage. */
  excerpt: string[];
  /** The change under test: the file before the commit and after it. */
  original: string;
  modified: string;
  language: "typescript" | "yaml";
}

export interface Run {
  id: string;
  service: Service;
  branch: string;
  sha: string;
  author: string;
  trigger: "push" | "pull request" | "schedule" | "manual";
  title: string;
  /** Minutes before `RUNS_AS_OF` the run started. */
  startedMinutesAgo: number;
  durationSec: number;
  status: RunStatus;
  stages: Record<StageId, StageResult>;
  failure?: RunFailure;
  /** Commit to production, in minutes — set on runs that reached production. */
  leadTimeMin?: number;
}

const ok = (durationSec: number): StageResult => ({ status: "success", durationSec });
const failed = (durationSec: number): StageResult => ({ status: "failed", durationSec });
const skipped = (): StageResult => ({ status: "skipped", durationSec: 0 });
const running = (durationSec: number): StageResult => ({ status: "running", durationSec });
const queued = (): StageResult => ({ status: "queued", durationSec: 0 });

/** A green run all the way to production, with the stage timings a service of that size has. */
function greenRun(scale: number): Record<StageId, StageResult> {
  return {
    checkout: ok(Math.round(6 * scale)),
    install: ok(Math.round(48 * scale)),
    lint: ok(Math.round(41 * scale)),
    typecheck: ok(Math.round(63 * scale)),
    unit: ok(Math.round(118 * scale)),
    build: ok(Math.round(96 * scale)),
    e2e: ok(Math.round(214 * scale)),
    staging: ok(Math.round(72 * scale)),
    production: ok(Math.round(84 * scale)),
  };
}

const sum = (results: Record<StageId, StageResult>) =>
  Object.values(results).reduce((total, result) => total + result.durationSec, 0);

const PRICING_ORIGINAL = `export interface PriceLine {
  unitPrice: number;
  quantity: number;
}

/** Ten percent off from the hundredth unit — the contract's own wording. */
const VOLUME_THRESHOLD = 100;
const VOLUME_DISCOUNT = 0.1;

export function applyVolumeDiscount(line: PriceLine): number {
  const gross = line.unitPrice * line.quantity;
  const discount = line.quantity >= VOLUME_THRESHOLD ? gross * VOLUME_DISCOUNT : 0;
  return Math.round((gross - discount) * 100) / 100;
}
`;

const PRICING_MODIFIED = `export interface PriceLine {
  unitPrice: number;
  quantity: number;
}

/** Ten percent off from the hundredth unit — the contract's own wording. */
const VOLUME_THRESHOLD = 100;
const VOLUME_DISCOUNT = 0.1;

export function applyVolumeDiscount(line: PriceLine): number {
  const gross = line.unitPrice * line.quantity;
  // Round the discount on its own so the invoice's line matches the ledger's.
  const discount =
    line.quantity > VOLUME_THRESHOLD ? Math.round(gross * VOLUME_DISCOUNT * 100) / 100 : 0;
  return Math.round((gross - discount) * 100) / 100;
}
`;

const RETRY_ORIGINAL = `export const refundQueue = {
  name: "refunds",
  concurrency: 4,
  attempts: 5,
  backoff: { type: "exponential", delayMs: 500 },
};
`;

const RETRY_MODIFIED = `export const refundQueue = {
  name: "refunds",
  concurrency: 8,
  attempts: 5,
  backoff: { type: "exponential", delayMs: 5_000 },
};
`;

const CATALOG_ORIGINAL = `export function ProductPrice({ amount, currency }: PriceProps) {
  const money = useMoney(currency);
  useEffect(() => {
    trackView("product-price");
  }, []);
  return <span className="tabular-nums">{money.format(amount)}</span>;
}
`;

const CATALOG_MODIFIED = `export function ProductPrice({ amount, currency }: PriceProps) {
  const money = useMoney(currency);
  return <span className="tabular-nums">{money.format(amount)}</span>;
}
`;

export const runs: Run[] = (
  [
    {
      id: "4821",
      service: "checkout-api",
      branch: "fix/volume-discount-rounding",
      sha: "9c4e21a",
      author: "Priya Nair",
      trigger: "pull request",
      title: "Round the volume discount on its own line",
      startedMinutesAgo: 14,
      status: "failed",
      stages: {
        checkout: ok(5),
        install: ok(44),
        lint: ok(39),
        typecheck: ok(58),
        unit: failed(97),
        build: skipped(),
        e2e: skipped(),
        staging: skipped(),
        production: skipped(),
      },
      failure: {
        stage: "unit",
        check: "applyVolumeDiscount › applies the volume discount at exactly 100 units",
        file: "src/pricing/volume-discount.test.ts:31",
        message: "expected 900 to be 1000 — the hundredth unit no longer earns the discount",
        excerpt: [
          "FAIL  src/pricing/volume-discount.test.ts",
          "  ● applyVolumeDiscount › applies the volume discount at exactly 100 units",
          "",
          "    AssertionError: expected 1000 to be 900",
          "",
          '      29 |   it("applies the volume discount at exactly 100 units", () => {',
          "      30 |     const total = applyVolumeDiscount({ unitPrice: 10, quantity: 100 });",
          "    > 31 |     expect(total).toBe(900);",
          "         |                   ^",
          "      32 |   });",
          "",
          " Test Files  1 failed | 41 passed (42)",
          "      Tests  1 failed | 386 passed (387)",
        ],
        original: PRICING_ORIGINAL,
        modified: PRICING_MODIFIED,
        language: "typescript",
      },
    },
    {
      id: "4820",
      service: "storefront-web",
      branch: "main",
      sha: "b17f0d3",
      author: "Deploy bot",
      trigger: "push",
      title: "Merge pull request 2231: product page skeletons",
      startedMinutesAgo: 42,
      status: "success",
      stages: greenRun(1.15),
      leadTimeMin: 190,
    },
    {
      id: "4819",
      service: "payments-worker",
      branch: "chore/refund-queue-backoff",
      sha: "e0a9b62",
      author: "Tomasz Kowal",
      trigger: "pull request",
      title: "Widen the refund queue and slow its backoff",
      startedMinutesAgo: 55,
      status: "failed",
      stages: {
        checkout: ok(6),
        install: ok(51),
        lint: ok(35),
        typecheck: ok(49),
        unit: ok(88),
        build: ok(77),
        e2e: failed(612),
        staging: skipped(),
        production: skipped(),
      },
      failure: {
        stage: "e2e",
        check: "refund flow › a refund lands within the SLA",
        file: "e2e/refund-flow.spec.ts:44",
        message: "Timeout 600 000 ms exceeded waiting for the refund to reach 'settled'",
        excerpt: [
          "  ✘ refund flow › a refund lands within the SLA (10.0m)",
          "",
          "    TimeoutError: Timeout 600000ms exceeded.",
          "    waiting for getByTestId('refund-status') to have text 'settled'",
          "      received: 'retrying (attempt 3 of 5)'",
          "",
          "  1 failed, 27 passed (11.4m)",
        ],
        original: RETRY_ORIGINAL,
        modified: RETRY_MODIFIED,
        language: "typescript",
      },
    },
    {
      id: "4818",
      service: "checkout-api",
      branch: "main",
      sha: "5d2c7f8",
      author: "Deploy bot",
      trigger: "push",
      title: "Merge pull request 2229: idempotency keys on order create",
      startedMinutesAgo: 63,
      status: "running",
      stages: {
        checkout: ok(5),
        install: ok(46),
        lint: ok(40),
        typecheck: ok(61),
        unit: ok(121),
        build: ok(94),
        e2e: ok(209),
        staging: ok(70),
        production: running(31),
      },
    },
    {
      id: "4817",
      service: "storefront-web",
      branch: "feat/wishlist-share",
      sha: "3f9a11c",
      author: "Lena Hoffmann",
      trigger: "pull request",
      title: "Share a wishlist by link",
      startedMinutesAgo: 78,
      status: "failed",
      stages: {
        checkout: ok(6),
        install: ok(49),
        lint: failed(37),
        typecheck: ok(66),
        unit: ok(131),
        build: skipped(),
        e2e: skipped(),
        staging: skipped(),
        production: skipped(),
      },
      failure: {
        stage: "lint",
        check: "@typescript-eslint/no-unused-vars",
        file: "src/product/product-price.tsx:1",
        message: "'useEffect' is defined but never used",
        excerpt: [
          "src/product/product-price.tsx",
          "  1:10  error  'useEffect' is defined but never used  @typescript-eslint/no-unused-vars",
          "",
          "✖ 1 problem (1 error, 0 warnings)",
        ],
        original: CATALOG_ORIGINAL,
        modified: CATALOG_MODIFIED,
        language: "typescript",
      },
    },
    {
      id: "4816",
      service: "platform-infra",
      branch: "main",
      sha: "a8e4d90",
      author: "Deploy bot",
      trigger: "push",
      title: "Merge pull request 2227: raise the worker pool to 6 nodes",
      startedMinutesAgo: 101,
      status: "success",
      stages: greenRun(0.7),
      leadTimeMin: 95,
    },
    {
      id: "4815",
      service: "payments-worker",
      branch: "main",
      sha: "c31b5e7",
      author: "Deploy bot",
      trigger: "push",
      title: "Merge pull request 2226: settle refunds in the ledger currency",
      startedMinutesAgo: 138,
      status: "success",
      stages: greenRun(1.05),
      leadTimeMin: 412,
    },
    {
      id: "4814",
      service: "checkout-api",
      branch: "feat/gift-cards",
      sha: "7b0e2aa",
      author: "Priya Nair",
      trigger: "pull request",
      title: "Redeem a gift card at checkout",
      startedMinutesAgo: 164,
      status: "success",
      stages: { ...greenRun(1), staging: skipped(), production: skipped() },
    },
    {
      id: "4813",
      service: "storefront-web",
      branch: "main",
      sha: "d5c8f14",
      author: "Deploy bot",
      trigger: "push",
      title: "Merge pull request 2225: header search on the phone layout",
      startedMinutesAgo: 205,
      status: "success",
      stages: greenRun(1.2),
      leadTimeMin: 260,
    },
    {
      id: "4812",
      service: "platform-infra",
      branch: "nightly",
      sha: "a8e4d90",
      author: "Scheduler",
      trigger: "schedule",
      title: "Nightly: rebuild base images",
      startedMinutesAgo: 320,
      status: "success",
      stages: { ...greenRun(0.9), staging: skipped(), production: skipped() },
    },
    {
      id: "4811",
      service: "payments-worker",
      branch: "chore/refund-queue-backoff",
      sha: "41c9de0",
      author: "Tomasz Kowal",
      trigger: "pull request",
      title: "Widen the refund queue",
      startedMinutesAgo: 352,
      status: "cancelled",
      stages: {
        checkout: ok(6),
        install: ok(50),
        lint: ok(36),
        typecheck: skipped(),
        unit: skipped(),
        build: skipped(),
        e2e: skipped(),
        staging: skipped(),
        production: skipped(),
      },
    },
    {
      id: "4810",
      service: "checkout-api",
      branch: "main",
      sha: "2e7a6b1",
      author: "Deploy bot",
      trigger: "push",
      title: "Merge pull request 2224: order create returns the invoice id",
      startedMinutesAgo: 401,
      status: "success",
      stages: greenRun(1),
      leadTimeMin: 148,
    },
    {
      id: "4809",
      service: "storefront-web",
      branch: "feat/wishlist-share",
      sha: "8a1d0c4",
      author: "Lena Hoffmann",
      trigger: "pull request",
      title: "Share a wishlist by link",
      startedMinutesAgo: 455,
      status: "success",
      stages: { ...greenRun(1.2), staging: skipped(), production: skipped() },
    },
    {
      id: "4808",
      service: "platform-infra",
      branch: "main",
      sha: "f60b3c2",
      author: "Jonas Weber",
      trigger: "manual",
      title: "Rotate the registry credentials",
      startedMinutesAgo: 512,
      status: "success",
      stages: greenRun(0.65),
      leadTimeMin: 22,
    },
  ] satisfies Omit<Run, "durationSec">[]
).map((run) => ({ ...run, durationSec: sum(run.stages) }));

/** One day of deploy history: how many production deploys, how many of them were rolled back. */
export interface DeployDay {
  /** ISO `yyyy-mm-dd`, UTC. */
  date: string;
  deploys: number;
  failed: number;
}

/** The last 28 days, weekends quieter, generated once with a fixed seed. */
export const deployHistory: DeployDay[] = (() => {
  const random = seeded(4821);
  const days: DeployDay[] = [];
  for (let offset = 27; offset >= 0; offset -= 1) {
    const at = new Date(NOW - offset * 86_400_000);
    const weekend = at.getUTCDay() === 0 || at.getUTCDay() === 6;
    const deploys = weekend ? Math.floor(random() * 2) : 4 + Math.floor(random() * 6);
    const failed = deploys > 0 && random() < 0.18 ? 1 : 0;
    days.push({ date: at.toISOString().slice(0, 10), deploys, failed });
  }
  return days;
})();

/** Minutes from a failed production deploy to service restored, most recent last. */
export const restoreMinutes = [38, 112, 21, 64, 47];

export const platformActors = {
  bot: { id: "deploy-bot", kind: "agent", name: "Deploy bot" },
  jonas: { id: "jonas", kind: "human", name: "Jonas Weber", initials: "JW" },
  priya: { id: "priya", kind: "human", name: "Priya Nair", initials: "PN" },
  tomasz: { id: "tomasz", kind: "human", name: "Tomasz Kowal", initials: "TK" },
  lena: { id: "lena", kind: "human", name: "Lena Hoffmann", initials: "LH" },
} satisfies Record<string, Actor>;

const minutesAgo = (minutes: number) => new Date(NOW - minutes * 60_000);

/** What the platform recorded today, newest first — approvals, deploys, holds, rollbacks. */
export const auditTrail: AuditEntry[] = [
  {
    id: "d1",
    at: minutesAgo(31),
    actor: platformActors.jonas,
    action: `Approved production deploy of ${runLabel("4818")}`,
    object: "checkout-api · 5d2c7f8",
    result: "applied",
  },
  {
    id: "d2",
    at: minutesAgo(38),
    actor: platformActors.bot,
    action: `Deployed staging for ${runLabel("4818")}; production waits for approval`,
    object: "checkout-api · 5d2c7f8",
    result: "held",
  },
  {
    id: "d3",
    at: minutesAgo(40),
    actor: platformActors.bot,
    action: `Deployed production for ${runLabel("4820")}`,
    object: "storefront-web · b17f0d3",
    result: "applied",
  },
  {
    id: "d4",
    at: minutesAgo(55),
    actor: platformActors.bot,
    action: `Stopped ${runLabel("4819")} at end-to-end: refund flow timed out`,
    object: "payments-worker · e0a9b62",
    result: "stopped",
  },
  {
    id: "d5",
    at: minutesAgo(99),
    actor: platformActors.bot,
    action: `Deployed production for ${runLabel("4816")}`,
    object: "platform-infra · a8e4d90",
    result: "applied",
  },
  {
    id: "d6",
    at: minutesAgo(352),
    actor: platformActors.tomasz,
    action: `Cancelled ${runLabel("4811")} to push a fix`,
    object: "payments-worker · 41c9de0",
    result: "reverted",
  },
  {
    id: "d7",
    at: minutesAgo(505),
    actor: platformActors.jonas,
    action: "Rotated the registry credentials",
    object: "platform-infra · f60b3c2",
    result: "applied",
  },
];

/** A stage line as the run log prints it — tool output the terminal renders with ANSI colour. */
const GREEN = "\u001b[32m";
const RED = "\u001b[31m";
const YELLOW = "\u001b[33m";
const DIM = "\u001b[2m";
const BOLD = "\u001b[1m";
const RESET = "\u001b[0m";

function clock(minutesAgo: number, offsetSec: number) {
  const at = new Date(NOW - minutesAgo * 60_000 + offsetSec * 1000);
  return at.toISOString().slice(11, 19);
}

function duration(seconds: number) {
  if (seconds < 60) return `${seconds} s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m} min` : `${m} min ${s} s`;
}

/**
 * The run log, built from the stage results in pipeline order: one heading per stage, its
 * command, its outcome — and, for the failing stage, what the tool printed. `only` narrows the
 * log to one stage, the way selecting a node in the graph does.
 */
export function runLog(run: Run, only?: StageId | null): string {
  const lines: string[] = [
    `${BOLD}${run.service} ${runLabel(run.id)}${RESET} ${DIM}· ${run.branch} @ ${run.sha} · ${run.trigger} by ${run.author}${RESET}`,
    "",
  ];
  let elapsed = 0;
  for (const stage of stages) {
    const result = run.stages[stage.id];
    const show = !only || only === stage.id;
    const startedAt = clock(run.startedMinutesAgo, elapsed);
    if (show) {
      lines.push(
        `${DIM}[${startedAt}]${RESET} ${BOLD}▶ ${stage.name}${RESET}  ${DIM}$ ${stage.command}${RESET}`,
      );
      if (result.status === "success")
        lines.push(
          `${DIM}[${clock(run.startedMinutesAgo, elapsed + result.durationSec)}]${RESET} ${GREEN}✓ ${stage.name} passed in ${duration(result.durationSec)}${RESET}`,
        );
      else if (result.status === "failed") {
        if (run.failure?.stage === stage.id)
          lines.push(...run.failure.excerpt.map((line) => `  ${line}`));
        lines.push(
          `${DIM}[${clock(run.startedMinutesAgo, elapsed + result.durationSec)}]${RESET} ${RED}✗ ${stage.name} failed after ${duration(result.durationSec)}${RESET}`,
        );
      } else if (result.status === "running")
        lines.push(`${YELLOW}… ${stage.name} running for ${duration(result.durationSec)}${RESET}`);
      else if (result.status === "queued") lines.push(`${DIM}· ${stage.name} queued${RESET}`);
      else lines.push(`${DIM}– ${stage.name} skipped${RESET}`);
      lines.push("");
    }
    elapsed += result.durationSec;
  }
  if (!only) {
    if (run.status === "success")
      lines.push(
        `${GREEN}${BOLD}Run ${runLabel(run.id)} succeeded in ${duration(run.durationSec)}${RESET}`,
      );
    else if (run.status === "failed")
      lines.push(
        `${RED}${BOLD}Run ${runLabel(run.id)} failed at ${stages.find((s) => s.id === run.failure?.stage)?.name ?? "a stage"}${RESET}`,
      );
    else if (run.status === "running")
      lines.push(`${YELLOW}${BOLD}Run ${runLabel(run.id)} is still running${RESET}`);
    else lines.push(`${DIM}${BOLD}Run ${runLabel(run.id)} was cancelled${RESET}`);
  }
  return lines.join("\n");
}

/** A stage marked as re-queued: the way a retry rewrites a failed run before its result lands. */
export function requeue(run: Run): Run {
  const failedStage = run.failure?.stage;
  if (!failedStage) return run;
  const next = { ...run.stages };
  let after = false;
  for (const stage of stages) {
    if (stage.id === failedStage) {
      next[stage.id] = running(0);
      after = true;
    } else if (after && next[stage.id].status === "skipped") next[stage.id] = queued();
  }
  return { ...run, status: "running", stages: next };
}

export { duration as formatDuration };
