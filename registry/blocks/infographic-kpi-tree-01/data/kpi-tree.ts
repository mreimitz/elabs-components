import type { TreeNode } from "@elabs-ai/components-charts";
import type { KpiUnit } from "@/components/kpi-card-parts/format";

/**
 * A software company's monthly operating profit, split into the drivers
 * that make it up — four levels, sixteen metrics. The shared KPI dataset
 * (`kpi-card-parts/data/acme-quarter.ts`) is a quarter-to-date logistics
 * snapshot; this block reasons about a subscription business's closed
 * months, in USD, so it defines its own tree rather than importing one.
 *
 * Only the LEAVES carry typed facts: 13 monthly points each, oldest →
 * newest, ending in the snapshot month. Every parent's series is COMPUTED
 * from its children with the parent's own `op` (sum, difference or
 * product), so a parent can never silently drift from its drivers
 * (`.claude/rules/charts.md` § Honesty). Month-over-month and
 * year-over-year changes are computed at render time from the same series.
 */

/** How a parent is built from its children, in the order they are listed. */
export type KpiTreeOp = "sum" | "difference" | "product";

/** 13 monthly points: the snapshot month and the 12 before it. */
export const KPI_TREE_MONTH_COUNT = 13;

/** First day (UTC) of the newest month in every series. */
export const KPI_TREE_PERIOD_END = new Date(Date.UTC(2026, 7, 1));

export const KPI_TREE_CURRENCY = "USD";

/** When the closed-month figures were last refreshed. */
export const KPI_TREE_AS_OF = new Date(Date.UTC(2026, 8, 2, 7, 30));
export const KPI_TREE_SOURCE = "General ledger";

interface KpiTreeBase {
  id: string;
  name: string;
  unit: KpiUnit;
  /** Whether a higher value is the good direction (false for every cost). */
  higherIsBetter: boolean;
  /** What the number counts, shown under it on the card. */
  caption: string;
}

interface KpiTreeLeafInput extends KpiTreeBase {
  monthly: readonly number[];
}

interface KpiTreeBranchInput extends KpiTreeBase {
  op: KpiTreeOp;
  children: KpiTreeInput[];
}

type KpiTreeInput = KpiTreeLeafInput | KpiTreeBranchInput;

/** The payload every node of the tree carries. */
export interface KpiTreeMetric extends KpiTreeBase {
  /** Absent on a leaf, whose series is a measured fact. */
  op?: KpiTreeOp;
  /** Names of the direct drivers, in order — empty on a leaf. */
  driverNames: string[];
  /** 13 monthly points, oldest → newest; computed for every parent. */
  monthly: number[];
}

export type KpiTreeNode = TreeNode<KpiTreeMetric>;

function combine(op: KpiTreeOp, series: number[][]): number[] {
  return Array.from({ length: KPI_TREE_MONTH_COUNT }, (_, month) => {
    const values = series.map((s) => s[month] as number);
    switch (op) {
      case "sum":
        return values.reduce((total, v) => total + v, 0);
      case "difference":
        return values.slice(1).reduce((total, v) => total - v, values[0] ?? 0);
      case "product":
        return values.reduce((total, v) => total * v, 1);
    }
  });
}

function build(input: KpiTreeInput): KpiTreeNode {
  const { id, name, unit, higherIsBetter, caption } = input;
  if (!("children" in input)) {
    if (input.monthly.length !== KPI_TREE_MONTH_COUNT) {
      throw new Error(`${name}: expected ${KPI_TREE_MONTH_COUNT} monthly points`);
    }
    return {
      id,
      name,
      data: {
        id,
        name,
        unit,
        higherIsBetter,
        caption,
        driverNames: [],
        monthly: [...input.monthly],
      },
    };
  }
  const children = input.children.map(build);
  const monthly = combine(
    input.op,
    children.map((child) => (child.data as KpiTreeMetric).monthly),
  );
  return {
    id,
    name,
    children,
    data: {
      id,
      name,
      unit,
      higherIsBetter,
      caption,
      op: input.op,
      driverNames: children.map((child) => child.name),
      monthly,
    },
  };
}

const usdPerMonth = "USD per month";

/** Operating profit = Revenue − Operating costs, four levels down to measured drivers. */
export const operatingProfitTree: KpiTreeNode = build({
  id: "operating-profit",
  name: "Operating profit",
  unit: "currency",
  higherIsBetter: true,
  caption: usdPerMonth,
  op: "difference",
  children: [
    {
      id: "revenue",
      name: "Revenue",
      unit: "currency",
      higherIsBetter: true,
      caption: usdPerMonth,
      op: "product",
      children: [
        {
          id: "customers",
          name: "Customers",
          unit: "count",
          higherIsBetter: true,
          caption: "Paying accounts",
          op: "sum",
          children: [
            {
              id: "self-serve-customers",
              name: "Self-serve customers",
              unit: "count",
              higherIsBetter: true,
              caption: "Paying accounts",
              monthly: [
                2950, 2990, 3035, 3070, 3110, 3150, 3205, 3250, 3290, 3340, 3395, 3450, 3520,
              ],
            },
            {
              id: "sales-led-customers",
              name: "Sales-led customers",
              unit: "count",
              higherIsBetter: true,
              caption: "Paying accounts",
              monthly: [880, 892, 905, 915, 928, 940, 951, 965, 978, 990, 1003, 1015, 1031],
            },
          ],
        },
        {
          id: "arpu",
          name: "ARPU",
          unit: "currency",
          higherIsBetter: true,
          caption: "USD per account per month",
          monthly: [468, 470, 471, 473, 475, 474, 478, 480, 483, 485, 488, 490, 494],
        },
      ],
    },
    {
      id: "operating-costs",
      name: "Operating costs",
      unit: "currency",
      higherIsBetter: false,
      caption: usdPerMonth,
      op: "sum",
      children: [
        {
          id: "cost-of-revenue",
          name: "Cost of revenue",
          unit: "currency",
          higherIsBetter: false,
          caption: usdPerMonth,
          op: "sum",
          children: [
            {
              id: "hosting",
              name: "Hosting",
              unit: "currency",
              higherIsBetter: false,
              caption: usdPerMonth,
              monthly: [
                214_000, 216_500, 219_000, 221_000, 224_500, 226_000, 229_500, 232_000, 236_000,
                238_500, 241_000, 244_500, 247_000,
              ],
            },
            {
              id: "customer-support",
              name: "Customer support",
              unit: "currency",
              higherIsBetter: false,
              caption: usdPerMonth,
              monthly: [
                148_000, 149_500, 151_000, 150_500, 153_000, 154_500, 156_000, 157_500, 158_000,
                160_500, 162_000, 163_000, 165_500,
              ],
            },
            {
              id: "payment-processing",
              name: "Payment processing",
              unit: "currency",
              higherIsBetter: false,
              caption: usdPerMonth,
              monthly: [
                52_000, 52_900, 53_800, 54_500, 55_600, 56_300, 57_500, 58_400, 59_300, 60_500,
                61_700, 62_900, 65_200,
              ],
            },
          ],
        },
        {
          id: "sales-and-marketing",
          name: "Sales & marketing",
          unit: "currency",
          higherIsBetter: false,
          caption: usdPerMonth,
          op: "sum",
          children: [
            {
              id: "paid-acquisition",
              name: "Paid acquisition",
              unit: "currency",
              higherIsBetter: false,
              caption: usdPerMonth,
              monthly: [
                265_000, 270_000, 282_000, 276_000, 290_000, 301_000, 296_000, 305_000, 312_000,
                308_000, 318_000, 322_000, 318_000,
              ],
            },
            {
              id: "sales-team",
              name: "Sales team",
              unit: "currency",
              higherIsBetter: false,
              caption: usdPerMonth,
              monthly: [
                352_000, 352_000, 358_000, 358_000, 364_000, 371_000, 371_000, 377_000, 383_000,
                383_000, 390_000, 390_000, 396_000,
              ],
            },
          ],
        },
        {
          id: "research-and-development",
          name: "R&D",
          unit: "currency",
          higherIsBetter: false,
          caption: usdPerMonth,
          monthly: [
            455_000, 458_000, 461_000, 466_000, 470_000, 472_000, 478_000, 482_000, 488_000,
            491_000, 495_000, 500_000, 506_000,
          ],
        },
        {
          id: "general-and-admin",
          name: "G&A",
          unit: "currency",
          higherIsBetter: false,
          caption: usdPerMonth,
          monthly: [
            196_000, 197_000, 199_000, 198_000, 201_000, 203_000, 202_000, 204_000, 206_000,
            205_000, 207_000, 209_000, 211_000,
          ],
        },
      ],
    },
  ],
});

// ── Derived facts ─────────────────────────────────────────────────────────

/** The newest value and the two baselines every card compares it with. */
export function latestAndBaselines(metric: KpiTreeMetric): {
  latest: number;
  previousMonth: number;
  yearAgo: number;
} {
  const n = metric.monthly.length;
  return {
    latest: metric.monthly[n - 1] as number,
    previousMonth: metric.monthly[n - 2] as number,
    yearAgo: metric.monthly[n - 13] as number,
  };
}

/** Every node of the tree, depth-first, root first. */
export function flattenKpiTree(root: KpiTreeNode): KpiTreeNode[] {
  return [root, ...(root.children ?? []).flatMap(flattenKpiTree)];
}

/**
 * How much of the ROOT's year-over-year change each node accounts for, by id.
 *
 * Every parent's change splits EXACTLY into its children's shares:
 * - `sum`: each child's own change;
 * - `difference`: the first child's change, minus each other child's;
 * - `product`: a sequential split, where child i's share is its own change
 *   times the NEW values of the children before it and the OLD values of
 *   the children after it — the terms telescope to the parent's change.
 *
 * A node's share of the root's change is its own change times the product
 * of those weights down the path, so the leaves' shares add up to the
 * root's change to the cent: the headline's "biggest driver" is a
 * decomposition, never an estimate.
 */
export function yoyContributions(root: KpiTreeNode): Map<string, number> {
  const shares = new Map<string, number>();
  const visit = (node: KpiTreeNode, weight: number) => {
    const metric = node.data as KpiTreeMetric;
    const { latest, yearAgo } = latestAndBaselines(metric);
    shares.set(metric.id, weight * (latest - yearAgo));
    const children = node.children ?? [];
    children.forEach((child, i) => {
      const pairs = children.map((c) => latestAndBaselines(c.data as KpiTreeMetric));
      let childWeight = 1;
      if (metric.op === "difference" && i > 0) childWeight = -1;
      if (metric.op === "product") {
        for (let j = 0; j < i; j++) childWeight *= (pairs[j] as { latest: number }).latest;
        for (let j = i + 1; j < pairs.length; j++) {
          childWeight *= (pairs[j] as { yearAgo: number }).yearAgo;
        }
      }
      visit(child, weight * childWeight);
    });
  };
  visit(root, 1);
  return shares;
}

/** The ids of every branch, depth-first. */
export function branchIds(root: KpiTreeNode): string[] {
  return flattenKpiTree(root)
    .filter((node) => (node.children?.length ?? 0) > 0)
    .map((node) => node.id as string);
}
