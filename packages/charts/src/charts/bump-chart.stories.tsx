import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { BumpChart, END_LABEL_MIN_GAP } from "./bump-chart";

const meta = {
  title: "Charts/BumpChart",
  component: BumpChart,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Tracks the rank of several entities across ordered periods — not their value — " +
          "on an inverted y-axis (rank 1 at the top), as either a trajectory line per entity " +
          '(`variant="lines"`) or a fixed-row, shaded filmstrip with printed numbers ' +
          '(`variant="strip"`) for a narrow, printable read. A `LineChart` over the same data ' +
          "plots value, so an overtake is invisible unless the reader does the arithmetic " +
          "themselves; with only two periods, a `DumbbellChart` reads the same before/after " +
          "delta more directly. See " +
          "[Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs).",
      },
    },
  },
} satisfies Meta<typeof BumpChart>;

export default meta;
type Story = StoryObj<typeof meta>;

// ── "lines" — a small, steady four-entity race ──────────────────────────────
const quarterlyShare = [
  { quarter: "Q1", product: "Atlas", share: 28 },
  { quarter: "Q1", product: "Nimbus", share: 34 },
  { quarter: "Q1", product: "Forge", share: 19 },
  { quarter: "Q1", product: "Origin", share: 22 },
  { quarter: "Q2", product: "Atlas", share: 31 },
  { quarter: "Q2", product: "Nimbus", share: 30 },
  { quarter: "Q2", product: "Forge", share: 21 },
  { quarter: "Q2", product: "Origin", share: 20 },
  { quarter: "Q3", product: "Atlas", share: 35 },
  { quarter: "Q3", product: "Nimbus", share: 27 },
  { quarter: "Q3", product: "Forge", share: 23 },
  { quarter: "Q3", product: "Origin", share: 18 },
  { quarter: "Q4", product: "Atlas", share: 38 },
  { quarter: "Q4", product: "Nimbus", share: 25 },
  { quarter: "Q4", product: "Forge", share: 24 },
  { quarter: "Q4", product: "Origin", share: 15 },
];

/** `variant="lines"` (default) — rank is derived from `share`; Atlas overtakes
 * Nimbus in Q2 and the two lines visibly cross. */
export const Default: Story = {
  args: {
    data: quarterlyShare,
    period: "quarter",
    entity: "product",
    valueKey: "share",
  },
  render: (args) => (
    <div className="h-72 w-[560px]">
      <BumpChart {...args} />
    </div>
  ),
};

/** `highlightKey` draws one entity in ink (bold end labels), the rest on the
 * neutral mono ladder — the "one line is the point" read. */
export const Highlighted: Story = {
  args: {
    data: quarterlyShare,
    period: "quarter",
    entity: "product",
    valueKey: "share",
    highlightKey: "Atlas",
    showDelta: true,
  },
  render: (args) => (
    <div className="h-72 w-[560px]">
      <BumpChart {...args} />
    </div>
  ),
};

// ── "strip" — G21 Rank Strip recreation: "Flows climbs to the top" ─────────
// Ranks are supplied directly (`rankKey`) so the story is a deterministic,
// hand-authored recreation rather than a derived approximation — Flows sits
// at rank 4 for two quarters, then leaps straight to rank 1 in the last one
// (prevRank 4 → lastRank 1 ⇒ the delta flag reads exactly "▲3").
const rankStripData = [
  { period: "Q1", team: "Flows", rank: 4 },
  { period: "Q1", team: "Vault", rank: 1 },
  { period: "Q1", team: "Ledger", rank: 2 },
  { period: "Q1", team: "Beacon", rank: 3 },
  { period: "Q2", team: "Flows", rank: 4 },
  { period: "Q2", team: "Vault", rank: 1 },
  { period: "Q2", team: "Ledger", rank: 2 },
  { period: "Q2", team: "Beacon", rank: 3 },
  { period: "Q3", team: "Flows", rank: 4 },
  { period: "Q3", team: "Vault", rank: 1 },
  { period: "Q3", team: "Ledger", rank: 3 },
  { period: "Q3", team: "Beacon", rank: 2 },
  { period: "Q4", team: "Flows", rank: 1 },
  { period: "Q4", team: "Vault", rank: 2 },
  { period: "Q4", team: "Ledger", rank: 4 },
  { period: "Q4", team: "Beacon", rank: 3 },
];

/** G21 Rank Strip — "Flows climbs to the top": rows stay fixed at final rank,
 * shade + the printed number carry the per-quarter rank, the hero row (Flows)
 * is bold and its delta flag reads ▲3. */
export const RankStrip: Story = {
  args: {
    data: rankStripData,
    period: "period",
    entity: "team",
    rankKey: "rank",
    variant: "strip",
    highlightKey: "Flows",
    showDelta: true,
  },
  render: (args) => (
    <div className="h-64 w-[480px]">
      <BumpChart {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    // `react-use-measure` debounces its ResizeObserver callback, so the SVG
    // body mounts a tick after first paint — wait for it before querying.
    await waitFor(() => {
      expect(canvasElement.querySelector('[data-slot="bump-chart-category-label"]')).not.toBeNull();
    });

    // `matrix.series` sorts ascending by FINAL rank, and Flows finishes #1 —
    // so the hero is the first row drawn.
    const heroLabel = canvasElement.querySelector('[data-slot="bump-chart-category-label"]');
    await expect(heroLabel).toHaveTextContent("Flows");
    await expect(heroLabel?.getAttribute("class") ?? "").toMatch(/font-bold/);

    const deltaLabels = canvasElement.querySelectorAll('[data-slot="bump-chart-delta-label"]');
    await expect(deltaLabels.length).toBeGreaterThan(0);
    await expect(deltaLabels[0]).toHaveTextContent("▲3");
  },
};

// ── "lines" — 8 entities × 6 periods, collision-spaced end labels ──────────
// Deterministic (no Math.random — see the marks-layer honesty rule): a phase
// per entity means ranks reshuffle across periods, so several end labels land
// within END_LABEL_MIN_GAP of each other before spacing is applied.
const manyEntityNames = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel"];
const manyPeriods = ["P1", "P2", "P3", "P4", "P5", "P6"];
const manyEntitiesData: { period: string; entity: string; value: number }[] = [];
manyPeriods.forEach((period, periodIndex) => {
  manyEntityNames.forEach((entity, entityIndex) => {
    const value = 50 + 35 * Math.sin(entityIndex * 0.9 + periodIndex * 1.4) + entityIndex * 2;
    manyEntitiesData.push({ period, entity, value: Math.round(value * 100) / 100 });
  });
});

/** 8 entities × 6 periods — every end label stays legible: no two are closer
 * than `END_LABEL_MIN_GAP` px apart (the `spaceSlopeLabels` collision pass
 * `DumbbellChart`'s `variant="slope"` already relies on). */
export const LinesManyEntities: Story = {
  args: {
    data: manyEntitiesData,
    period: "period",
    entity: "entity",
    valueKey: "value",
    // Ranks are unique integers 1..8, so a tall chart never actually
    // collides (adjacent-rank spacing is already >> END_LABEL_MIN_GAP). A
    // narrow aspect ratio compresses that spacing below the minimum so the
    // raw end-label positions genuinely overlap and `spaceSlopeLabels` has
    // real work to do — this is what makes the "no overlapping end labels"
    // assertion below discriminating rather than vacuously true.
    aspectRatio: "6 / 1",
  },
  render: (args) => (
    <div className="w-[720px]">
      <BumpChart {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    // Same render-readiness wait as the RankStrip story above.
    await waitFor(() => {
      expect(canvasElement.querySelectorAll('[data-slot="bump-chart-label-end"]').length).toBe(
        manyEntityNames.length,
      );
    });

    const endLabels = Array.from(
      canvasElement.querySelectorAll('[data-slot="bump-chart-label-end"]'),
    );
    await expect(endLabels).toHaveLength(manyEntityNames.length);
    const ys = endLabels.map((el) => Number(el.getAttribute("y"))).sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) {
      await expect((ys[i] as number) - (ys[i - 1] as number)).toBeGreaterThanOrEqual(
        END_LABEL_MIN_GAP - 0.5,
      );
    }
  },
};
