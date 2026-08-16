import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@qlik-coe-emea/qlabs-components-ui";
import { Hero } from "./hero";

const meta = {
  title: "Marketing/Hero",
  component: Hero,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
} satisfies Meta<typeof Hero>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Centered: Story = {
  args: {
    eyebrow: "Internal platform",
    title: "Ship branded internal apps in hours, not weeks",
    description:
      "A source-owned component system for prototypes, POCs, AI assistants and data apps — themeable to any brand.",
    actions: (
      <>
        <Button>Get started</Button>
        <Button variant="outline">View components</Button>
      </>
    ),
  },
};
