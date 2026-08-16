import type { Meta, StoryObj } from "@storybook/react";
import { Descriptions, DescriptionsItem } from "./descriptions";

const meta = {
  title: "Layout/Descriptions",
  component: Descriptions,
  tags: ["autodocs"],
  argTypes: {
    columns: { control: "inline-radio", options: [1, 2, 3] },
    layout: { control: "inline-radio", options: ["horizontal", "vertical"] },
  },
} satisfies Meta<typeof Descriptions>;

export default meta;
type Story = StoryObj<typeof meta>;

const items = (
  <>
    <DescriptionsItem label="Name">Ada Lovelace</DescriptionsItem>
    <DescriptionsItem label="Email">ada@example.com</DescriptionsItem>
    <DescriptionsItem label="Role">Maintainer</DescriptionsItem>
    <DescriptionsItem label="Records" numeric>
      1,284
    </DescriptionsItem>
    <DescriptionsItem label="Status">Active</DescriptionsItem>
    <DescriptionsItem label="Last seen">2 hours ago</DescriptionsItem>
  </>
);

export const Default: Story = {
  args: { columns: 1, layout: "horizontal" },
  render: (args) => <Descriptions {...args}>{items}</Descriptions>,
};

export const TwoColumns: Story = {
  args: { columns: 2, layout: "horizontal" },
  render: (args) => <Descriptions {...args}>{items}</Descriptions>,
};

export const VerticalThreeColumns: Story = {
  args: { columns: 3, layout: "vertical" },
  render: (args) => <Descriptions {...args}>{items}</Descriptions>,
};
