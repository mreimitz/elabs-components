import type { Meta, StoryObj } from "@storybook/react-vite";
import { IntegrationGrid } from "@/components/integration-grid-01/integration-grid";

const meta = {
  title: "Patterns/Blocks/Integration Grid",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A responsive grid of integration cards (icon + name + description + connect/manage action + connection status) under a page header with an Add action — the canonical 'connect your tools' surface. Logos are consumer-supplied; the Lucide glyphs here are placeholders. Semantic tokens only; reads in both themes.\n\nCopy-own it: `npx shadcn add integration-grid-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <IntegrationGrid /> };
