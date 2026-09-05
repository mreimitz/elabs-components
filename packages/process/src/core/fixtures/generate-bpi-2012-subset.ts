/**
 * Seeded BPI-2012-shaped event-log generator — RM-053.
 *
 * A SEPARATE generator from `synthetic-log.ts` (RM-049), not a second copy of it: RM-049's
 * `generateSyntheticLog` produces an order-to-cash shaped log (Create Order, Check Credit,
 * Ship Order, …); this one produces a log shaped like the public BPI Challenge 2012 event
 * log (van Dongen, 2012) — a Dutch financial institution's loan-application process, whose
 * activity vocabulary follows the dataset's own three-lifecycle-prefix convention
 * (`A_` application state, `O_` offer state, `W_` work item). The BPI Challenge datasets are
 * a public academic research corpus; naming them is not naming a commercial vendor (see
 * `.claude/rules/process-components.md` and the RM-053 brief's naming constraint).
 *
 * This is what analysis §4 R21 asks for: a ~13,000-case fixture large enough to exercise
 * `discoverGraph`'s performance budget (already covered by RM-049's own
 * `generateSyntheticLog({ cases: 13_000 })` in `discover-graph.test.ts`) and, from RM-051
 * onward, a Storybook "LargeGraph" story that wants a visually denser, more tangled graph
 * than the order-to-cash shape produces (more branching, more rework, a wider activity
 * vocabulary).
 *
 * Determinism is the whole contract, exactly as in `synthetic-log.ts`:
 * `generateBpi2012Subset({ cases: n, seed: s })` returns a byte-identical log on every run.
 *
 * ## This module is BROWSER-SAFE — no Node built-ins
 *
 * Deliberately: `discoverGraph`/`extractVariants` demos (the RM-053 placeholder Storybook
 * story, and any future browser-rendered fixture preview) import this module directly, and
 * Storybook's story tests run in a real browser (`@storybook/addon-vitest`'s Playwright
 * provider) where `node:fs`/`node:path`/`node:url` are externalized and throw on access. So
 * this file exports the PURE generator only — no filesystem write, no `import.meta.url`
 * resolution, no `process.argv` read. The CLI entry point that writes the on-disk fixture
 * lives in the sibling `generate-bpi-2012-subset-cli.ts`, which is the only place those
 * Node-only imports appear.
 *
 * ## Producing the on-disk fixture
 *
 * The 13k-case output is a ~250k-row JSON document — too large to commit as a binary (see
 * the repo's "no committed large binary fixture" convention, already followed by
 * `synthetic-log.ts`). It is a GENERATED artifact: run
 *
 * ```
 * pnpm --filter @elabs-ai/components-process generate:fixtures
 * ```
 *
 * which writes `bpi-2012-subset.json` next to this file (git-ignored — see the package's
 * `.gitignore`), via `generate-bpi-2012-subset.write.ts` (run through `vitest`, not `tsx` —
 * see that file's docblock for why). A consumer of the generated JSON should treat it as a
 * build artifact, not a checked-in fixture; import {@link generateBpi2012Subset} directly
 * wherever possible instead of reading the file.
 */
import type { EventLog, EventRow } from "../types";

/** Epoch ms the first case starts at: 2012-01-02T08:00:00.000Z, a Monday morning. */
export const BPI_2012_SUBSET_EPOCH = 1325487600000;

const MINUTE = 60_000;

/** Options for {@link generateBpi2012Subset}. */
export interface Bpi2012SubsetOptions {
  /** How many cases to generate. Values below 1 yield an empty log. */
  cases: number;
  /** PRNG seed. The same seed always produces the same log. */
  seed?: number;
  /** Epoch ms the first case starts at. Defaults to {@link BPI_2012_SUBSET_EPOCH}. */
  startTime?: number;
}

/**
 * A deterministic 32-bit PRNG (mulberry32).
 *
 * Deliberately its OWN copy rather than one imported from `synthetic-log.ts`: that file's
 * `mulberry32` is intentionally unexported (its own doc comment explains why — a fixture
 * generator's output must not shift because an unrelated generator's internals changed), and
 * this generator's output is equally a byte-identical fixture contract. Same reasoning,
 * same repo convention, independently applied.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RESOURCES = [
  "Loan Officer 1",
  "Loan Officer 2",
  "Loan Officer 3",
  "Credit Assessor",
  "Automated System",
] as const;

/**
 * Activity vocabulary, following the public BPI Challenge 2012 log's own naming convention:
 * `A_` (application), `O_` (offer) and `W_` (work item) lifecycle prefixes.
 */
export const BPI_2012_ACTIVITIES = [
  "A_SUBMITTED",
  "A_PARTLYSUBMITTED",
  "A_PREACCEPTED",
  "W_Completeren aanvraag",
  "A_ACCEPTED",
  "O_SELECTED",
  "A_FINALIZED",
  "O_CREATED",
  "O_SENT",
  "W_Nabellen offertes",
  "O_SENT_BACK",
  "A_REGISTERED",
  "A_APPROVED",
  "A_ACTIVATED",
  "O_ACCEPTED",
  "A_DECLINED",
  "O_DECLINED",
  "O_CANCELLED",
  "A_CANCELLED",
] as const;

/** One activity name from {@link BPI_2012_ACTIVITIES}. */
export type Bpi2012Activity = (typeof BPI_2012_ACTIVITIES)[number];

/** Build the activity sequence of a single case. Pure given `random`. */
function buildTrace(random: () => number): Bpi2012Activity[] {
  const trace: Bpi2012Activity[] = ["A_SUBMITTED", "A_PARTLYSUBMITTED"];

  if (random() < 0.06) {
    trace.push("A_DECLINED");
    return trace;
  }

  trace.push("A_PREACCEPTED", "W_Completeren aanvraag");

  // Rework: an incomplete dossier sends the applicant back through completion, at most twice.
  let reworks = 0;
  while (reworks < 2 && random() < 0.18) {
    trace.push("W_Completeren aanvraag");
    reworks += 1;
  }

  if (random() < 0.08) {
    trace.push("A_CANCELLED");
    return trace;
  }

  trace.push(
    "A_ACCEPTED",
    "O_SELECTED",
    "A_FINALIZED",
    "O_CREATED",
    "O_SENT",
    "W_Nabellen offertes",
  );

  // About a quarter of offers are sent back at least once before acceptance.
  if (random() < 0.25) trace.push("O_SENT_BACK", "O_SENT", "W_Nabellen offertes");

  if (random() < 0.1) {
    trace.push("O_DECLINED");
    trace.push(random() < 0.5 ? "A_CANCELLED" : "A_DECLINED");
    return trace;
  }

  trace.push("O_ACCEPTED", "A_REGISTERED", "A_APPROVED", "A_ACTIVATED");
  return trace;
}

/**
 * Generate a synthetic BPI-2012-shaped loan-application log.
 *
 * Every event is an INTERVAL event (`startTimestamp` + `timestamp`), and cases are emitted
 * as `caseId`s of the form `bpi-000001`, zero-padded so lexical and numeric order agree —
 * the same shape `generateSyntheticLog` uses, so downstream consumers do not need a second
 * case-id convention.
 */
export function generateBpi2012Subset(options: Bpi2012SubsetOptions): EventLog {
  const total = Math.max(0, Math.floor(options.cases));
  const random = mulberry32(options.seed ?? 1);
  const epoch = options.startTime ?? BPI_2012_SUBSET_EPOCH;

  const events: EventRow[] = [];
  const pad = String(total).length;

  for (let index = 0; index < total; index += 1) {
    const caseId = `bpi-${String(index + 1).padStart(Math.max(6, pad), "0")}`;
    const trace = buildTrace(random);

    let cursor = epoch + index * 47 * MINUTE + Math.floor(random() * 30) * MINUTE;

    for (const activity of trace) {
      const idle = Math.floor(random() * 240) * MINUTE;
      const work = (1 + Math.floor(random() * 20)) * MINUTE;
      const start = cursor + idle;
      const end = start + work;
      events.push({
        caseId,
        activity,
        timestamp: end,
        startTimestamp: start,
        resource: RESOURCES[Math.floor(random() * RESOURCES.length)] as string,
      });
      cursor = end;
    }
  }

  return { events };
}
