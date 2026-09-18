/**
 * Invariants for the one coherent Ashgrove fixture dataset (RM-095). See `README.md` for the
 * story these numbers tell.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CONSOLE_PRODUCT, OWNERS, PRODUCTS, REGIONS } from "./company";
import {
  CHURN_BY_REGION,
  CHURN_SERIES,
  headlineDelta,
  headlineValue,
  KPI_HEADLINES,
  KPI_SERIES,
} from "./kpis";
import { ACCOUNT_OWNERS, generateOrders, ORDERS_FULL_COUNT } from "./orders";
import {
  aggregateAccountMrr,
  CHURN_MOVERS,
  CHURN_SAMPLE_SIZE,
  topMovers,
  CHURN_MOVERS_COUNT,
} from "./churn";
import { CONVERSATION } from "./conversation";
import { FLOW_ACTIVE_NODE_ID, FLOW_NODES } from "./flow";
import {
  generateProcessLog,
  PROCESS_LOG,
  PROCESS_LOG_CASE_COUNT,
  PROCESS_LOG_SLOW_VARIANT_SHARE,
} from "./process-log";
import { SETTINGS_MEMBERS } from "./settings";

const FIXTURES_DIR = dirname(fileURLToPath(import.meta.url));

/** Every source/doc file this dataset ships, except this test itself (see below). */
function listFixtureFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx|md)$/.test(entry.name) && entry.name !== "fixtures.test.ts")
        out.push(full);
    }
  };
  walk(FIXTURES_DIR);
  return out;
}

describe("credibility rule (concept §5: no lorem, no Item 1, no real/generic brand)", () => {
  // The deny-list lives here, not in a shipped fixture file, so it never shows up in a grep
  // of the fixtures themselves (this file is the checker, not the checked content).
  const DENIED = ["lorem", "Item 1", "foo", "Acme"];

  it("never appears in a fixture source or doc file", () => {
    for (const file of listFixtureFiles()) {
      const text = readFileSync(file, "utf8");
      for (const word of DENIED) {
        expect(text.includes(word), `${file} contains banned word "${word}"`).toBe(false);
      }
    }
  });

  it("never calls Math.random (charts-honesty's rule 3, extended by convention to this folder)", () => {
    // Blank out comments first — `lib/prng.ts`'s own doc explains why it exists INSTEAD OF
    // `Math.random`, which would otherwise trip this exact check on its own prose.
    const stripComments = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    for (const file of listFixtureFiles()) {
      if (!file.endsWith(".ts") && !file.endsWith(".tsx")) continue;
      const code = stripComments(readFileSync(file, "utf8"));
      expect(/Math\.random\s*\(/.test(code), `${file} calls Math.random`).toBe(false);
    }
  });
});

describe("kpis.ts — churn headline invariant", () => {
  it("the headline churn KPI equals the churn series' last point", () => {
    const headline = KPI_HEADLINES.find((h) => h.id === "churn");
    expect(headline).toBeDefined();
    expect(headline!.value).toBe(CHURN_SERIES.points[CHURN_SERIES.points.length - 1]!.value);
  });

  it("every headline's delta is its own series' last point minus its first, independently recomputed", () => {
    for (const headline of KPI_HEADLINES) {
      const series = KPI_SERIES.find((s) => s.id === headline.id)!;
      const recomputed = series.points[series.points.length - 1]!.value - series.points[0]!.value;
      expect(headline.value).toBe(series.points[series.points.length - 1]!.value);
      expect(headline.delta).toBeCloseTo(recomputed, 6);
    }
    expect(headlineDelta(CHURN_SERIES)).toBe(
      headlineValue(CHURN_SERIES) - CHURN_SERIES.points[0]!.value,
    );
  });

  it("EMEA churn ends higher than every other region (the story conversation.ts tells)", () => {
    const emeaEnd = headlineValue(CHURN_BY_REGION.EMEA);
    for (const region of REGIONS) {
      if (region === "EMEA") continue;
      expect(emeaEnd).toBeGreaterThan(headlineValue(CHURN_BY_REGION[region]));
    }
  });
});

describe("orders.ts — generateOrders", () => {
  it(`generates ${ORDERS_FULL_COUNT} rows in well under 150 ms`, () => {
    const start = performance.now();
    const rows = generateOrders(ORDERS_FULL_COUNT);
    const elapsed = performance.now() - start;
    expect(rows).toHaveLength(ORDERS_FULL_COUNT);
    expect(elapsed).toBeLessThan(150);
  });

  it("is deterministic across runs", () => {
    const a = generateOrders(2_000);
    const b = generateOrders(2_000);
    expect(b).toEqual(a);
  });

  it("every order's owner is one of company.ts's OWNERS", () => {
    const rows = generateOrders(500);
    for (const row of rows) expect(OWNERS).toContain(row.owner);
  });
});

describe("churn.ts — MRR consistency with orders.ts", () => {
  it("CHURN_MOVERS is exactly topMovers of a fresh generateOrders(CHURN_SAMPLE_SIZE) call", () => {
    const fresh = topMovers(generateOrders(CHURN_SAMPLE_SIZE), CHURN_MOVERS_COUNT);
    expect(CHURN_MOVERS).toEqual(fresh);
  });

  it("each mover's mrrChange is exactly lastMonth minus firstMonth", () => {
    for (const mover of CHURN_MOVERS) {
      expect(mover.mrrChange).toBeCloseTo(mover.lastMonth - mover.firstMonth, 2);
    }
  });

  it("aggregateAccountMrr only ever names accounts that also appear in ACCOUNT_OWNERS", () => {
    const aggregated = aggregateAccountMrr(generateOrders(CHURN_SAMPLE_SIZE));
    for (const row of aggregated) expect(ACCOUNT_OWNERS[row.account]).toBeDefined();
  });
});

describe("conversation.ts — every number matches kpis.ts", () => {
  const assistant = CONVERSATION.find((m) => m.role === "assistant");
  const toolPart = assistant?.parts.find((p) => p.type === "tool-query_kpis") as unknown as
    | { output: { overall: { week: string; value: number }[] } }
    | undefined;
  const chartPart = assistant?.parts.find((p) => p.type === "data-chart") as unknown as
    | { data: { data: { week: string; value: number }[] } }
    | undefined;
  const textPart = assistant?.parts.find((p) => p.type === "text") as unknown as
    | { text: string }
    | undefined;

  it("the tool result's overall churn series is literally kpis.ts' CHURN_SERIES", () => {
    expect(toolPart).toBeDefined();
    expect(toolPart!.output.overall).toEqual(CHURN_SERIES.points);
  });

  it("the chart artifact's data is derived from the same CHURN_SERIES points", () => {
    expect(chartPart).toBeDefined();
    expect(chartPart!.data.data.map((d) => d.value)).toEqual(
      CHURN_SERIES.points.map((p) => p.value),
    );
  });

  it("the final answer quotes the real overall and EMEA headline percentages", () => {
    expect(textPart).toBeDefined();
    const overallEnd = headlineValue(CHURN_SERIES).toFixed(1);
    const emeaEnd = headlineValue(CHURN_BY_REGION.EMEA).toFixed(1);
    expect(textPart!.text).toContain(`${overallEnd}%`);
    expect(textPart!.text).toContain(`${emeaEnd}%`);
  });

  it('imports only `type { UIMessage } from "ai"` (ai-sdk-types-only, D6)', () => {
    const source = readFileSync(join(FIXTURES_DIR, "conversation.ts"), "utf8");
    const aiImports = source.match(/^import[^;]*from\s+"ai";/gm) ?? [];
    expect(aiImports).toEqual(['import type { UIMessage } from "ai";']);
  });
});

describe("flow.ts — pipeline references the dataset's own tables", () => {
  it("every node's label or description names a real table this folder produces", () => {
    const tableNames = ["orders", "accounts", "kpis"];
    for (const node of FLOW_NODES) {
      const text = `${node.data.label} ${node.data.description}`.toLowerCase();
      expect(tableNames.some((name) => text.includes(name))).toBe(true);
    }
  });
});

describe("process-log.ts — case count and slow-variant share", () => {
  it("generates exactly PROCESS_LOG_CASE_COUNT cases", () => {
    const caseIds = new Set(PROCESS_LOG.events.map((e) => e.caseId));
    expect(caseIds.size).toBe(PROCESS_LOG_CASE_COUNT);
    expect(Object.keys(PROCESS_LOG.caseAttributes ?? {})).toHaveLength(PROCESS_LOG_CASE_COUNT);
  });

  it("exactly PROCESS_LOG_SLOW_VARIANT_SHARE of cases are the manual-review variant", () => {
    const attrs = Object.values(PROCESS_LOG.caseAttributes ?? {});
    const slow = attrs.filter((a) => a.variant === "manual-review").length;
    expect(slow).toBe(Math.round(PROCESS_LOG_CASE_COUNT * PROCESS_LOG_SLOW_VARIANT_SHARE));
  });

  it("only uses the six-activity vocabulary", () => {
    const activities = new Set(PROCESS_LOG.events.map((e) => e.activity));
    expect(activities.size).toBe(6);
  });

  it("the manual-review variant runs roughly twice as long as the standard one", () => {
    const caseSpan = new Map<string, { min: number; max: number }>();
    for (const e of PROCESS_LOG.events) {
      const start = Number(e.startTimestamp ?? e.timestamp);
      const end = Number(e.timestamp);
      const span = caseSpan.get(e.caseId) ?? { min: start, max: end };
      span.min = Math.min(span.min, start);
      span.max = Math.max(span.max, end);
      caseSpan.set(e.caseId, span);
    }
    const avgFor = (variant: string) => {
      const ids = Object.entries(PROCESS_LOG.caseAttributes ?? {})
        .filter(([, a]) => a.variant === variant)
        .map(([id]) => id);
      const totals = ids.map((id) => {
        const span = caseSpan.get(id)!;
        return span.max - span.min;
      });
      return totals.reduce((a, b) => a + b, 0) / totals.length;
    };
    const ratio = avgFor("manual-review") / avgFor("standard");
    expect(ratio).toBeGreaterThan(1.6);
    expect(ratio).toBeLessThan(2.6);
  });

  it("is deterministic across runs", () => {
    const a = generateProcessLog(200, 41);
    const b = generateProcessLog(200, 41);
    expect(b).toEqual(a);
  });
});

describe("settings.ts — members match orders.ts owners", () => {
  it("SETTINGS_MEMBERS names exactly OWNERS, in order", () => {
    expect(SETTINGS_MEMBERS.map((m) => m.name)).toEqual([...OWNERS]);
  });
});

describe("hero additions (RM-094-fx) — facts the hero scene reads", () => {
  it("CONSOLE_PRODUCT is one of the company's own products", () => {
    expect(PRODUCTS).toContain(CONSOLE_PRODUCT);
  });

  it("FLOW_ACTIVE_NODE_ID names a pipeline step that is neither the first nor the last", () => {
    const index = FLOW_NODES.findIndex((n) => n.id === FLOW_ACTIVE_NODE_ID);
    expect(index).toBeGreaterThan(0);
    expect(index).toBeLessThan(FLOW_NODES.length - 1);
  });
});
