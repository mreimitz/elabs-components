import type { Meta, StoryObj } from "@storybook/react-vite";
import { FeatureGrid } from "./feature-grid";

const meta = {
  title: "Marketing/FeatureGrid",
  component: FeatureGrid,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof FeatureGrid>;
export default meta;
type Story = StoryObj<typeof meta>;

const sampleFeatures = [
  {
    title: "Token-driven theming",
    description:
      "Every colour, radius and shadow is a semantic token. Re-branding is a token change, not a component change.",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <circle cx="10" cy="10" r="8" />
        <path d="M6 10h8M10 6v8" />
      </svg>
    ),
  },
  {
    title: "Composable primitives",
    description:
      "Build dashboards, AI clients and data grids from a shared set of accessible Radix-backed components.",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <rect x="3" y="3" width="6" height="6" rx="1" />
        <rect x="11" y="3" width="6" height="6" rx="1" />
        <rect x="3" y="11" width="6" height="6" rx="1" />
        <rect x="11" y="11" width="6" height="6" rx="1" />
      </svg>
    ),
  },
  {
    title: "Source owned",
    description:
      "Stable primitives are imported; prototype blocks are copy-owned via the registry. No lock-in.",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M4 17l4-4 3 3 5-6" />
      </svg>
    ),
  },
  {
    title: "Three built-in themes",
    description: "Ship with qlik-bright and qlik-dark out of the box.",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <circle cx="10" cy="10" r="7" />
        <path d="M10 3v14M3 10h14" strokeDasharray="2 2" />
      </svg>
    ),
  },
  {
    title: "AI-ready",
    description:
      "ChatShell, MessageBubble and PromptInput connect directly to the Vercel AI SDK runtime.",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M4 14l2-4 4 2 2-6 2 4 2-2" />
      </svg>
    ),
  },
  {
    title: "Motion gated",
    description:
      "Animations respect prefers-reduced-motion and a global --motion-factor dial at the token level.",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M5 10h10M13 7l3 3-3 3" />
      </svg>
    ),
  },
];

export const Default: Story = {
  args: {
    features: sampleFeatures,
    columns: 3,
    animate: false,
  },
};

export const TwoColumns: Story = {
  args: {
    features: sampleFeatures.slice(0, 4),
    columns: 2,
    animate: false,
  },
};

export const FourColumns: Story = {
  args: {
    features: sampleFeatures,
    columns: 4,
    animate: false,
  },
};

export const NoIcons: Story = {
  args: {
    features: sampleFeatures.map(({ title, description }) => ({ title, description })),
    columns: 3,
    animate: false,
  },
};
