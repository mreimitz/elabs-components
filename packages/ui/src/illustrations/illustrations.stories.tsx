import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentType } from "react";
import {
  EmptyListIllustration,
  NoResultsIllustration,
  NoAccessIllustration,
  ErrorIllustration,
  OfflineIllustration,
  SuccessIllustration,
  FirstRunIllustration,
  type IllustrationProps,
} from "./index";

/**
 * Demo wrapper: illustrations are pure `currentColor` line art (plus a
 * `--border` backdrop and a `--primary` accent), so a story renders them
 * inside a `text-muted-foreground` container — the same ambient color
 * `StatePanel` applies via its icon/illustration slot.
 */
function Demo(props: IllustrationProps & { as: ComponentType<IllustrationProps> }) {
  const { as: Illustration, ...rest } = props;
  return (
    <div className="text-muted-foreground">
      <Illustration {...rest} />
    </div>
  );
}

const meta = {
  title: "States/Illustrations",
  component: Demo,
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "text",
      description: "Rendered width/height (any CSS length). Legible ~4rem–10rem.",
    },
  },
} satisfies Meta<typeof Demo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyList: Story = {
  args: { as: EmptyListIllustration },
};

export const NoResults: Story = {
  args: { as: NoResultsIllustration },
};

export const NoAccess: Story = {
  args: { as: NoAccessIllustration },
};

export const Error: Story = {
  args: { as: ErrorIllustration },
};

export const Offline: Story = {
  args: { as: OfflineIllustration },
};

export const Success: Story = {
  args: { as: SuccessIllustration },
};

export const FirstRun: Story = {
  args: { as: FirstRunIllustration },
};

export const CustomSize: Story = {
  name: "Custom size (10rem)",
  args: { as: EmptyListIllustration, size: "10rem" },
};

export const AllStates: Story = {
  name: "All seven, side by side",
  render: () => (
    <div className="flex flex-wrap gap-8 text-muted-foreground">
      <EmptyListIllustration />
      <NoResultsIllustration />
      <NoAccessIllustration />
      <ErrorIllustration />
      <OfflineIllustration />
      <SuccessIllustration />
      <FirstRunIllustration />
    </div>
  ),
};
