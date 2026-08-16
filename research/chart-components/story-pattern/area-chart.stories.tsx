/**
 * SAMPLE / PATTERN — area-chart.stories.tsx
 * ------------------------------------------------------------------------------
 * The locked Storybook pattern for the vendored charts (CH-01 issue-04).
 * Copy this shape for all 14 charts, seeding the data + composition from the
 * matching bklit example in `packages/ui/registry/examples/<chart>.tsx`.
 *
 * NOTE: this file lives in research/ as a TEMPLATE. It will compile + run only
 * once the charts are vendored into `@qlik-coe-emea/qlabs-components-charts` (CH-01 issue-02) and
 * Storybook is running. Six-theme verification is an execution step
 * (`pnpm --filter @qlik-coe-emea/qlabs-components-docs test-storybook` + the theme globals), not done by
 * authoring the file. Conventions: co-located `*.stories.tsx`, `tags:["autodocs"]`,
 * title group `Charts/<Name>`, real sample data, sized parent (charts need one),
 * key states as separate stories. See `.claude/rules/storybook-mcp.md`.
 */
import type { Meta, StoryObj } from "@storybook/react";
import { curveNatural } from "@visx/curve";

// Imports resolve after vendoring into @qlik-coe-emea/qlabs-components-charts (CH-01 issue-02).
import { Area, AreaChart, ChartTooltip, Grid, XAxis } from "@qlik-coe-emea/qlabs-components-charts";

// --- sample data (ported from bklit's area-chart example) ----------------------
const series = [
  { date: new Date("2024-01-01"), desktop: 186, mobile: 120 },
  { date: new Date("2024-02-01"), desktop: 305, mobile: 210 },
  { date: new Date("2024-03-01"), desktop: 237, mobile: 190 },
  { date: new Date("2024-04-01"), desktop: 73, mobile: 130 },
  { date: new Date("2024-05-01"), desktop: 209, mobile: 160 },
  { date: new Date("2024-06-01"), desktop: 214, mobile: 175 },
];

const meta = {
  title: "Charts/AreaChart",
  component: AreaChart,
  tags: ["autodocs"],
  // Charts need a sized parent — every story renders inside one.
  decorators: [
    (Story) => (
      <div className="h-[320px] w-full max-w-3xl rounded-lg border border-border bg-card p-4">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
} satisfies Meta<typeof AreaChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default — single series, the canonical usage (from the example). */
export const Default: Story = {
  render: () => (
    <AreaChart data={series} animationDuration={1100}>
      <Grid horizontal />
      <Area dataKey="desktop" curve={curveNatural} strokeWidth={2.5} fillOpacity={0.4} />
      <XAxis />
      <ChartTooltip />
    </AreaChart>
  ),
};

/** Multi-series — exercises the extended `--chart-1..N` palette (CH-01 issue-03). */
export const MultiSeries: Story = {
  render: () => (
    <AreaChart data={series} animationDuration={1100}>
      <Grid horizontal />
      <Area dataKey="desktop" curve={curveNatural} strokeWidth={2.5} fillOpacity={0.35} />
      <Area dataKey="mobile" curve={curveNatural} strokeWidth={2.5} fillOpacity={0.35} />
      <XAxis />
      <ChartTooltip />
    </AreaChart>
  ),
};

/** Empty — the no-data state (use @qlik-coe-emea/qlabs-components-ui StatePanel/EmptyState when integrated). */
export const Empty: Story = {
  render: () => (
    <AreaChart data={[]} animationDuration={0}>
      <Grid horizontal />
      <Area dataKey="desktop" />
      <XAxis />
    </AreaChart>
  ),
};

/*
 * Six-theme verification (execution step, not authoring):
 *   pnpm --filter @qlik-coe-emea/qlabs-components-docs test-storybook            # interaction + axe
 *   preview each story with globals=theme:<slug> for:
 *     qlik-bright · qlik-dark · light · dark · blueprint · high-contrast
 *   Confirm series colors are distinguishable + labels ≥ AA in every theme
 *   (tune the --chart-* palette per CH-01 issue-04).
 */
