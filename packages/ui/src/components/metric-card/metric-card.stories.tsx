import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { MetricCard } from "./metric-card";

const meta = {
  title: "Core/MetricCard",
  component: MetricCard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The canonical KPI tile, owned by @elabs-ai/components-ui (ADR 0012). @elabs-ai/components-charts re-exports this " +
          "EXACT component, so import it from @elabs-ai/components-ui for app UI, or from @elabs-ai/components-charts when " +
          "you are already in a charts context — both resolve to the component documented here, which is why the " +
          "sidebar carries one MetricCard entry and not two. Don't fork a second KPI tile. The `visual` slot is " +
          "shown by the WithSparkline story, which fills it with a real @elabs-ai/components-charts mini-chart.",
      },
    },
  },
  argTypes: {
    label: {
      description: "Tile label — the metric name shown above the value.",
      control: "text",
      table: { category: "Content" },
    },
    value: {
      description: "Primary metric value (string or ReactNode).",
      control: "text",
      table: { category: "Content" },
    },
    description: {
      description: "Secondary context line under the value.",
      control: "text",
      table: { category: "Content" },
    },
    delta: {
      description: 'Signed change string, e.g. "+12.4%". Direction colors it.',
      control: "text",
      table: { category: "Content" },
    },
    deltaDirection: {
      description: "Direction of the delta — drives the arrow glyph and polarity color.",
      control: { type: "radio" },
      options: ["up", "down", "neutral"],
      table: { category: "State" },
    },
    positiveIsGood: {
      description: "Flip to false for metrics where increase is unfavorable (e.g. churn).",
      control: "boolean",
      table: { category: "Behavior" },
    },
    emphasis: {
      description:
        "`headline` uses the larger kpi text rung; `default` is the calm intermediate rung.",
      control: { type: "radio" },
      options: ["default", "headline"],
      table: { category: "Appearance" },
    },
    icon: {
      description: "Optional icon node shown to the right of the label.",
      control: false,
      table: { category: "Content" },
    },
    visual: {
      description: "Optional inline visual (e.g. sparkline) shown under value/description.",
      control: false,
      table: { category: "Content" },
    },
    evidence: {
      description:
        "Optional grounding footer — connects a figure to its source (e.g. EvidenceChip).",
      control: false,
      table: { category: "Content" },
    },
    loading: {
      description: "Loading vs ready — renders a layout-shaped skeleton at the same box height.",
      control: "boolean",
      table: { category: "State" },
    },
    announceLoading: {
      description:
        "Whether this tile announces its own loading state (set false when composed inside a container, e.g. MetricGrid, that already announces once).",
      control: "boolean",
      table: { category: "State" },
    },
  },
} satisfies Meta<typeof MetricCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "Active users",
    value: "24,512",
    delta: "12.4%",
    deltaDirection: "up",
  },
};

export const WithDescription: Story = {
  args: {
    label: "Monthly Revenue",
    value: "$84.2k",
    description: "vs $80.9k last month",
    delta: "4.1%",
    deltaDirection: "up",
  },
};

export const DeltaDown: Story = {
  args: {
    label: "Churn Rate",
    value: "1.8%",
    description: "0.3 pp worse than target",
    delta: "0.3%",
    deltaDirection: "down",
    positiveIsGood: false,
  },
};

export const DeltaUnfavorable: Story = {
  args: {
    label: "Open tickets",
    value: "37",
    description: "15 unassigned",
    delta: "+9",
    deltaDirection: "up",
    positiveIsGood: false,
  },
};

export const Neutral: Story = {
  args: {
    label: "Sessions",
    value: "100",
    delta: "0%",
    deltaDirection: "neutral",
  },
};

export const NoMetrics: Story = {
  args: {
    label: "Open gaps",
    value: "2",
    description: "in progress",
  },
};

// emphasis="headline" — the answer-leading KPI rung (#191, research 11 §B.5):
// size/weight/space only, the polarity color system is unchanged.
export const Headline: Story = {
  args: {
    emphasis: "headline",
    label: "Net revenue retention",
    value: "118%",
    delta: "+4.2pp",
    deltaDirection: "up",
  },
};

export const WithEvidence: Story = {
  args: {
    label: "Enterprise churn",
    value: "1.8%",
    delta: "0.4pp",
    deltaDirection: "down",
    positiveIsGood: false,
    evidence: <span>Grounded in 3 sources</span>,
  },
};

/**
 * A NUMERIC `value` is compacted for reading and stays reachable in full: the
 * tile renders its value as a real button that copies the exact figure. The
 * accessible name carries the tile's own label, so two tiles that compact to the
 * same string are still told apart by a screen reader.
 */
export const NumericValue: Story = {
  args: {
    label: "Revenue",
    value: 50012102.632741,
    delta: "8.1%",
    deltaDirection: "up",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Compacted for reading…
    await expect(canvas.getByText("50M")).toBeInTheDocument();
    // …and the exact figure is one keyboard-reachable control away.
    await expect(
      canvas.getByRole("button", { name: /50M\s+Revenue, Copy exact value/i }),
    ).toBeInTheDocument();
  },
};

/** `valueFormat="number"` is the escape hatch — full grouped digits, no copy control. */
export const NumericUncompacted: Story = {
  args: {
    label: "Open tickets",
    value: 1284,
    valueFormat: "number",
  },
};

/** Currency and percent read the same numeric seam. */
export const NumericCurrency: Story = {
  args: {
    label: "Pipeline",
    value: 4820000,
    valueFormat: "currency",
    currency: "EUR",
  },
};

/** Loading vs ready (#268) — a layout-shaped skeleton at the same box height as `Default`. */
export const Loading: Story = {
  args: {
    label: "Active users",
    value: "24,512",
    delta: "12.4%",
    deltaDirection: "up",
    loading: true,
  },
};
