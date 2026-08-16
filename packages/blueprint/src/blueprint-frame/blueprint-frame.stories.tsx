/* eslint-disable brand/no-raw-font-size -- Blueprint drafting typography (mono, fixed drafting sizes) is a decorative aesthetic, not content hierarchy; the raw sizes are intentional. */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { BlueprintFrame } from "./blueprint-frame";
import { TitleBlock } from "../title-block";
import { FigAnnotation } from "../fig-annotation";

const meta = {
  title: "Blueprint/BlueprintFrame",
  component: BlueprintFrame,
  tags: ["autodocs"],
  globals: { theme: "blueprint" },
  parameters: { layout: "padded" },
} satisfies Meta<typeof BlueprintFrame>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "Detail sheet",
    className: "max-w-xl",
    children: (
      <div className="space-y-2">
        <h3 className="font-mono text-lg font-semibold uppercase tracking-wide text-foreground">
          Independent Transforms
        </h3>
        <p className="font-mono text-body text-muted-foreground">
          Animate x, y, rotate, scale on the same element — without wrappers.
        </p>
      </div>
    ),
  },
};

export const WithTitleBlock: Story = {
  args: {
    label: "Pump assembly",
    className: "max-w-xl",
    children: <FigAnnotation figNumber={1} caption="Sectioned view of the main housing." />,
    titleBlock: (
      <TitleBlock
        title="Pump Assembly"
        scale="1:2"
        sheet="A-01"
        revision="C"
        className="border-0"
      />
    ),
  },
};

export const Plain: Story = {
  args: {
    corners: false,
    grid: false,
    label: "Plain",
    className: "max-w-xl",
    children: <p className="font-mono text-body text-foreground">No grid, no corner ticks.</p>,
  },
};
