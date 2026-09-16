import type { TreemapNode } from "@elabs-ai/components-charts";

/**
 * Acme Logistics' Q3 operating cost, category → sub-category, in the same EUR
 * unit and quarter as the shared Acme dataset (`AS_OF_DATE`, `QUARTER_LABEL`
 * in `kpi-card-parts/data/acme-quarter`). Every leaf here is a typed FACT;
 * {@link totalCost} and {@link leafSharePct} are the only places a total or a
 * share is computed, so the headline can never quote a number the tree does
 * not actually sum to.
 */

export interface CostLeaf {
  name: string;
  /** EUR, Q3. */
  value: number;
}

export interface CostGroup {
  name: string;
  children: CostLeaf[];
}

export interface CostScenario {
  id: string;
  groups: CostGroup[];
  highlightGroup: string;
  highlightLeaf: string;
  /** The same leaf's share of cost last quarter (Q2) — the comparison fact behind "up/down Npp". */
  priorSharePct: number;
  /** Short editorial context for the highlighted leaf. */
  context: string;
}

function sumGroup(group: CostGroup): number {
  return group.children.reduce((sum, leaf) => sum + leaf.value, 0);
}

/** The one place the grand total is computed — never a second, hand-typed figure. */
export function totalCost(scenario: CostScenario): number {
  return scenario.groups.reduce((sum, group) => sum + sumGroup(group), 0);
}

function findLeaf(
  scenario: CostScenario,
  groupName: string,
  leafName: string,
): CostLeaf | undefined {
  return scenario.groups
    .find((group) => group.name === groupName)
    ?.children.find((leaf) => leaf.name === leafName);
}

/** The highlighted leaf's value, in EUR. */
export function highlightValue(scenario: CostScenario): number {
  return findLeaf(scenario, scenario.highlightGroup, scenario.highlightLeaf)?.value ?? 0;
}

/** One decimal — enough to tell 30.6% from 31.4% without false precision. */
export function leafSharePct(scenario: CostScenario, groupName: string, leafName: string): number {
  const leaf = findLeaf(scenario, groupName, leafName);
  const total = totalCost(scenario);
  if (!leaf || total <= 0) return 0;
  return Math.round((leaf.value / total) * 1000) / 10;
}

/** Signed whole percentage points vs {@link CostScenario.priorSharePct}. */
export function sharePpChange(scenario: CostScenario): number {
  const currentPct = leafSharePct(scenario, scenario.highlightGroup, scenario.highlightLeaf);
  return Math.round(currentPct - scenario.priorSharePct);
}

/** `TreemapChart`'s own data shape — a parent's `value` is left unset so it is
 * always the sum of its children, never a second figure that could drift. */
export function toTreemapNode(scenario: CostScenario): TreemapNode {
  return {
    name: "Q3 cost",
    children: scenario.groups.map((group) => ({
      name: group.name,
      children: group.children.map((leaf) => ({ name: leaf.name, value: leaf.value })),
    })),
  };
}

// ── Scenario 1: fuel (default) ──────────────────────────────────────────────
// Every leaf value is EUR, Q3. Fuel is exactly 31% of the €2.6M total by
// construction (806,000 / 2,600,000) — the same figure the headline states.
export const fuelCostScenario: CostScenario = {
  id: "fuel",
  groups: [
    {
      name: "Transportation",
      children: [
        { name: "Fuel", value: 806_000 },
        { name: "Freight contracts", value: 440_000 },
        { name: "Fleet maintenance", value: 240_000 },
        { name: "Tolls & parking", value: 80_000 },
      ],
    },
    {
      name: "Labor",
      children: [
        { name: "Driver wages", value: 260_000 },
        { name: "Warehouse staff", value: 140_000 },
        { name: "Admin & support", value: 70_000 },
      ],
    },
    {
      name: "Warehousing",
      children: [
        { name: "Storage & handling", value: 210_000 },
        { name: "Equipment leases", value: 120_000 },
        { name: "Utilities", value: 84_000 },
      ],
    },
    {
      name: "Overhead",
      children: [
        { name: "Insurance", value: 90_000 },
        { name: "IT & software", value: 60_000 },
      ],
    },
  ],
  highlightGroup: "Transportation",
  highlightLeaf: "Fuel",
  priorSharePct: 27,
  context: "diesel prices rose through the quarter and the fleet grew",
};

// ── Scenario 2: driver wages (alternate highlight) ──────────────────────────
// Same tree, same total — only which leaf is called out changes.
export const driverWagesCostScenario: CostScenario = {
  ...fuelCostScenario,
  id: "driver-wages",
  highlightGroup: "Labor",
  highlightLeaf: "Driver wages",
  priorSharePct: 12,
  context: "a new hourly rate for peak-season drivers took effect in August",
};
