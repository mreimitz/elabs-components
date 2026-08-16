import type { Meta, StoryObj } from "@storybook/react-vite";
import { UseCaseCard } from "./use-case-card";

const meta = {
  title: "Marketing/UseCaseCard",
  component: UseCaseCard,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof UseCaseCard>;
export default meta;
type Story = StoryObj<typeof meta>;

const sampleIcon = (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <rect x="3" y="3" width="14" height="14" rx="2" />
    <path d="M7 10h6M10 7v6" />
  </svg>
);

export const Default: Story = {
  args: {
    tag: "Analytics",
    icon: sampleIcon,
    title: "Self-service business intelligence",
    description:
      "Empower analysts to build and share dashboards without waiting for IT, using a governed data catalog.",
    footer: "Learn more →",
  },
};

export const WithoutIcon: Story = {
  args: {
    tag: "Sales",
    title: "Presales demo accelerator",
    description:
      "Spin up a branded, live demo environment in minutes and tailor it to each prospect's industry.",
    footer: "See how it works →",
  },
};

export const MinimalNoFooter: Story = {
  args: {
    title: "Embedded analytics",
    description:
      "Drop interactive charts and KPI tiles directly into your product without rebuilding your data layer.",
  },
};

export const FullFeatured: Story = {
  args: {
    tag: "AI & Automation",
    icon: sampleIcon,
    title: "AI-assisted decision making",
    description:
      "Surface contextual insights inside workflows so teams act on data without leaving their tools.",
    footer: "Explore use cases →",
  },
};
