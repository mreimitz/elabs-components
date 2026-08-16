import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@elabs/components-ui";
import { CTASection } from "./cta-section";

const meta = {
  title: "Marketing/CTASection",
  component: CTASection,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof CTASection>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "Start building in minutes",
    description:
      "brand-ui is source-owned — clone the repo, pick your theme and ship your first branded app today.",
    actions: (
      <>
        <Button variant="secondary">Get started free</Button>
        <Button variant="ghost">Read the docs</Button>
      </>
    ),
    animate: false,
  },
};

export const TitleOnly: Story = {
  args: {
    title: "Ready to see it in action?",
    animate: false,
  },
};

export const WithDescription: Story = {
  args: {
    title: "Everything your team needs to ship faster",
    description:
      "Tokens, components, AI primitives and data grids — all in one coherent, themeable system.",
    animate: false,
  },
};

export const SingleAction: Story = {
  args: {
    title: "Book a live demo",
    description: "See how brand-ui powers presales demos and AI-first internal apps.",
    actions: <Button variant="secondary">Schedule a call</Button>,
    animate: false,
  },
};
