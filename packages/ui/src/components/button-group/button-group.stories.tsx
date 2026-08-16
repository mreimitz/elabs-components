import type { Meta, StoryObj } from "@storybook/react-vite";
import { ButtonGroup, ButtonGroupText } from "./button-group";
import { Button } from "../button";
const meta = {
  title: "Forms/ButtonGroup",
  component: ButtonGroup,
  tags: ["autodocs"],
  argTypes: {
    orientation: {
      description: "Layout direction of the group.",
      control: { type: "radio" },
      options: ["horizontal", "vertical"],
      table: { category: "Appearance" },
    },
    className: {
      description: "Additional CSS classes applied to the root element.",
      control: "text",
      table: { category: "Appearance" },
    },
    children: {
      description: "Button or ButtonGroupText elements to group together.",
      control: false,
      table: { category: "Content" },
    },
  },
} satisfies Meta<typeof ButtonGroup>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <ButtonGroup>
      <Button variant="outline">Day</Button>
      <Button variant="outline">Week</Button>
      <Button variant="outline">Month</Button>
    </ButtonGroup>
  ),
};
export const WithText: Story = {
  render: () => (
    <ButtonGroup>
      <ButtonGroupText>https://</ButtonGroupText>
      <Button variant="outline">brand-ui.dev</Button>
    </ButtonGroup>
  ),
};
