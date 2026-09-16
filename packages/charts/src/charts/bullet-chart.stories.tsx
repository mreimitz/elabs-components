import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { BulletChart } from "./bullet-chart";

const REVENUE_BANDS = [
  { to: 60, label: "Poor" },
  { to: 80, label: "Satisfactory" },
  { to: 100, label: "Good" },
];

const meta = {
  title: "Charts/BulletChart",
  component: BulletChart,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Stephen Few's bullet graph — the canonical “am I on target?” KPI micro-visual. " +
          "One zero-based bar against 2–3 neutral qualitative bands, an optional target tick " +
          'and an optional comparative reference (e.g. last year). `size="sm"` is word-sized ' +
          'for a table cell or a KPI card\'s corner; `size="md"` adds a hairline tick axis. The ' +
          "SVG is aria-hidden — the accessible name is computed from the actual props (value, " +
          "target, the gap between them, and the qualitative band).",
      },
    },
  },
  render: (args) => (
    <div className="w-full max-w-sm">
      <BulletChart {...args} />
    </div>
  ),
} satisfies Meta<typeof BulletChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** `size="md"` with bands + a target — the standard reading, axis included. */
export const Default: Story = {
  args: {
    value: 82,
    target: 100,
    bands: REVENUE_BANDS,
    size: "md",
    labels: { value: "Revenue" },
  },
};

/** A second reference (last year) drawn as a small triangle notch, a shape distinct from the target's tick. */
export const WithComparative: Story = {
  args: {
    value: 82,
    target: 100,
    comparative: 68,
    bands: REVENUE_BANDS,
    size: "md",
    labels: { value: "Revenue", comparative: "Last year" },
  },
};

/** The value clamps visually at the domain ceiling once it passes the target — the accessible name still states the real number. */
export const OverTarget: Story = {
  args: {
    value: 145,
    target: 100,
    bands: REVENUE_BANDS,
    size: "md",
  },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-slot="bullet-chart"]');
    await expect(root?.getAttribute("aria-label")).toMatch(/145/);
  },
};

/** No `bands` prop — a single neutral track behind the bar. */
export const NoBands: Story = {
  args: {
    value: 82,
    target: 100,
    size: "md",
  },
};

/**
 * `higherIsBetter={false}` — a lower-is-better measure (e.g. cost). The worst
 * band sits at the HIGH end here, so the shade ramp mirrors: the darkest rung
 * shades the high (worst) end instead of the low end.
 */
export const LowerIsBetter: Story = {
  args: {
    value: 8.4,
    target: 7.9,
    bands: [
      { to: 8, label: "On track" },
      { to: 9, label: "Watch" },
      { to: 12, label: "Behind" },
    ],
    higherIsBetter: false,
    size: "md",
    labels: { value: "Cost per shipment" },
  },
};

/** `orientation="vertical"` — the bar grows upward; the parent box supplies the height. */
export const Vertical: Story = {
  args: {
    value: 82,
    target: 100,
    bands: REVENUE_BANDS,
    orientation: "vertical",
    size: "md",
  },
  render: (args) => (
    <div className="h-40">
      <BulletChart {...args} />
    </div>
  ),
};

/** `size="sm"` (the default) — word-sized, no axis, sitting inline inside a narrow card. */
export const SmallInCard: Story = {
  args: {
    value: 82,
    target: 100,
    bands: REVENUE_BANDS,
    labels: { value: "MRR" },
  },
  render: (args) => (
    <div className="w-48 rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="text-caption text-muted-foreground">Monthly recurring revenue</div>
      <div className="mt-1 text-kpi text-foreground">82K</div>
      <div className="mt-2">
        <BulletChart {...args} />
      </div>
    </div>
  ),
};
