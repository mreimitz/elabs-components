// registry: grid-cost-tree-01 — copied 2026-09-25
import { seeded } from "../../grid-parts/grid-kit";

/** One node of the cost-centre tree. Parents carry the roll-up of their children. */
export interface CostCenter {
  id: string;
  name: string;
  owner: string;
  /** Approved full-year budget. */
  budget: number;
  /** Actual spend year to date. */
  actual: number;
  /** Full-year forecast; typed by the owner on leaf rows only. */
  forecast: number;
  children?: CostCenter[];
}

const TREE: [string, string, [string, string][]][] = [
  [
    "Engineering",
    "Priya Raman",
    [
      ["Platform", "Tomás Silva"],
      ["Product engineering", "Mei Chen"],
      ["Data & ML", "Oskar Berg"],
      ["Cloud hosting", "Tomás Silva"],
    ],
  ],
  [
    "Go-to-market",
    "Dana Whitfield",
    [
      ["Field sales", "Marco Rossi"],
      ["Demand generation", "Aisha Bello"],
      ["Events", "Aisha Bello"],
      ["Partner program", "Marco Rossi"],
    ],
  ],
  [
    "Customer",
    "Lena Vogel",
    [
      ["Support", "Ravi Patel"],
      ["Customer success", "Lena Vogel"],
      ["Training", "Ravi Patel"],
    ],
  ],
  [
    "G&A",
    "Henrik Olsen",
    [
      ["Finance", "Henrik Olsen"],
      ["Legal", "Grace Kim"],
      ["People", "Sara Novak"],
      ["Facilities", "Sara Novak"],
    ],
  ],
];

/** Sums the children into the parent — call after any leaf changes. */
export function rollUp(node: CostCenter): CostCenter {
  if (!node.children?.length) return node;
  const children = node.children.map(rollUp);
  const sum = (key: "budget" | "actual" | "forecast") =>
    children.reduce((total, child) => total + child[key], 0);
  return {
    ...node,
    children,
    budget: sum("budget"),
    actual: sum("actual"),
    forecast: sum("forecast"),
  };
}

/** Writes `patch` into the node with `id`, then re-rolls every ancestor. Untouched branches keep their objects. */
export function updateCostCenter(
  tree: readonly CostCenter[],
  id: string,
  patch: Partial<CostCenter>,
): CostCenter[] {
  const visit = (node: CostCenter): CostCenter => {
    if (node.id === id) return { ...node, ...patch };
    if (!node.children) return node;
    const children = node.children.map(visit);
    return children.every((child, i) => child === node.children![i])
      ? node
      : rollUp({ ...node, children });
  };
  return tree.map(visit);
}

/** Year-to-date share of the year elapsed at the fixture's "today" (25 September). */
export const YEAR_ELAPSED = 0.73;

export function makeCostCenters(): CostCenter[] {
  const rnd = seeded(17);
  return TREE.map(([name, owner, leaves], d) =>
    rollUp({
      id: `D${d + 1}`,
      name,
      owner,
      budget: 0,
      actual: 0,
      forecast: 0,
      children: leaves.map(([leaf, leafOwner], l) => {
        const budget = rnd.int(24, 180) * 10_000;
        // Most teams land near plan; a few run hot or cold.
        const pace = rnd.weighted([
          [0.93 + rnd.next() * 0.12, 6],
          [1.08 + rnd.next() * 0.12, 2],
          [0.78 + rnd.next() * 0.1, 1],
        ]);
        const actual = Math.round((budget * YEAR_ELAPSED * pace) / 1000) * 1000;
        const forecast = Math.round(actual / YEAR_ELAPSED / 5000) * 5000;
        return {
          id: `D${d + 1}.${l + 1}`,
          name: leaf,
          owner: leafOwner,
          budget,
          actual,
          forecast,
        };
      }),
    }),
  );
}
