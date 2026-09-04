import type { Meta, StoryObj } from "@storybook/react-vite";
import { DumbbellChart } from "./dumbbell-chart";

const meta = {
  title: "Charts/DumbbellChart",
  component: DumbbellChart,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "One track per category (a hairline) with a marker at `start` and one at `end`, " +
          "joined by a connector — the visible delta between two points, in rows or columns " +
          '(`orientation`), with an optional `variant="slope"` that draws one line per ' +
          "category across two value columns instead. A grouped `BarChart`, the previous " +
          "standing answer for two values per category, hides that delta behind two separate " +
          "bar heights the reader has to subtract themselves; with more than two points per " +
          "category, `BumpChart` reads the trajectory instead. See " +
          "[Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs).",
      },
    },
  },
} satisfies Meta<typeof DumbbellChart>;

export default meta;
type Story = StoryObj<typeof meta>;

// ── F12: "Onboarding before/after" — hollow (before) -> filled (after), beads
// count the steps saved. ───────────────────────────────────────────────────
const onboardingSteps = [
  { step: "Sign up", before: 100, after: 100 },
  { step: "Verify email", before: 82, after: 94 },
  { step: "Add payment method", before: 41, after: 68 },
  { step: "Invite a teammate", before: 12, after: 39 },
  { step: "Ship first project", before: 19, after: 51 },
];

/** F12 Dumbbell Queue — hollow dot = before, ink dot = after, beads between count the units gained. */
export const Default: Story = {
  args: {
    data: onboardingSteps,
    category: "step",
    startKey: "before",
    endKey: "after",
    beads: { unit: 4 },
    showDelta: true,
  },
  render: (args) => (
    <div className="h-80 w-[640px]">
      <DumbbellChart {...args} />
    </div>
  ),
};

// ── F6: "This year vs last" — a slope pair per category. ───────────────────
const yearOverYear = [
  { channel: "Organic search", lastYear: 42000, thisYear: 51500 },
  { channel: "Paid social", lastYear: 18000, thisYear: 15200 },
  { channel: "Email", lastYear: 9800, thisYear: 12100 },
  { channel: "Referral", lastYear: 6400, thisYear: 7900 },
];

/** F6 Paired Rungs — two value columns (last year / this year), one line per category. */
export const ThisYearVsLast: Story = {
  args: {
    data: yearOverYear,
    category: "channel",
    startKey: "lastYear",
    endKey: "thisYear",
    variant: "slope",
    valueFormat: "compact",
  },
  render: (args) => (
    <div className="h-80 w-[640px]">
      <DumbbellChart {...args} />
    </div>
  ),
};

/** Vertical orientation — tracks run as columns instead of rows. */
export const VerticalOrientation: Story = {
  args: {
    data: onboardingSteps,
    category: "step",
    startKey: "before",
    endKey: "after",
    orientation: "vertical",
    showDelta: true,
  },
  render: (args) => (
    <div className="h-[420px] w-[640px]">
      <DumbbellChart {...args} />
    </div>
  ),
};

// ── L7 Brand Spectrum — small competitor dots on the same track. ───────────
const brandSpectrum = [
  { metric: "Price", us: 40, target: 65, competitorA: 55, competitorB: 30 },
  { metric: "Ease of use", us: 30, target: 70, competitorA: 45, competitorB: 60 },
  { metric: "Support", us: 50, target: 85, competitorA: 40, competitorB: 35 },
];

/** L7 Brand Spectrum — extraKeys draws small competitor dots on the shared track. */
export const CompetitorDots: Story = {
  args: {
    data: brandSpectrum,
    category: "metric",
    startKey: "us",
    endKey: "target",
    extraKeys: ["competitorA", "competitorB"],
    markers: { start: "hollow", end: "filled" },
  },
  render: (args) => (
    <div className="h-72 w-[640px]">
      <DumbbellChart {...args} />
    </div>
  ),
};

// ── Slope past the 8-row soft cap — refuses (dev warning) but stays legible. ─
const manyCategories = Array.from({ length: 9 }, (_, i) => ({
  category: `Region ${i + 1}`,
  q1: 20 + i * 6,
  q2: 25 + ((i * 7) % 40),
}));

/**
 * Slope variant past the 8-row soft cap — dev-only console warning, still
 * renders every row with collision-spaced labels (the "legible fallback").
 */
export const SlopeOverflowWarning: Story = {
  args: {
    data: manyCategories,
    category: "category",
    startKey: "q1",
    endKey: "q2",
    variant: "slope",
    palette: "mono",
  },
  render: (args) => (
    <div className="h-96 w-[640px]">
      <DumbbellChart {...args} />
    </div>
  ),
};

/** Sorted by delta — the biggest movers surface first. */
export const SortedByDelta: Story = {
  args: {
    data: onboardingSteps,
    category: "step",
    startKey: "before",
    endKey: "after",
    sortBy: "delta",
    showDelta: true,
  },
  render: (args) => (
    <div className="h-80 w-[640px]">
      <DumbbellChart {...args} />
    </div>
  ),
};

/** Accessible variant — announces label + description to screen readers on focus. */
export const WithAccessibleLabel: Story = {
  args: {
    data: onboardingSteps,
    category: "step",
    startKey: "before",
    endKey: "after",
    beads: { unit: 4 },
    accessibleLabel: "Onboarding completion rate, before and after the redesign",
    accessibleDescription:
      "Five onboarding steps, each showing completion rate before and after the redesign, with the point gain called out per step.",
  },
  render: (args) => (
    <div className="h-80 w-[640px]">
      <DumbbellChart {...args} />
    </div>
  ),
};
