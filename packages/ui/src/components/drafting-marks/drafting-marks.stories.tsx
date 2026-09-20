import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { DraftingMarks } from "./drafting-marks";

const meta = {
  title: "Foundations/DraftingMarks",
  component: DraftingMarks,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  argTypes: {
    anchor: {
      description: "The corner the construction grows out of, and fades away from.",
      control: { type: "radio" },
      options: ["top-start", "top-end", "bottom-start", "bottom-end"],
      table: { category: "Appearance" },
    },
    accent: {
      description: "Ink the station point in `--primary` and the plate in `--chart-2`.",
      control: "boolean",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof DraftingMarks>;
export default meta;
type Story = StoryObj<typeof meta>;

function Band({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <header
      className={`relative isolate overflow-hidden bg-surface-muted px-6 py-24 text-center ${className ?? ""}`}
    >
      {children}
      <h2 className="relative text-display font-semibold text-balance">
        The hard screens, one system.
      </h2>
      <p className="relative mx-auto mt-3 max-w-prose text-subtitle text-muted-foreground">
        A construction drawing in the corner the copy leaves empty. It fades out long before it
        reaches the text.
      </p>
    </header>
  );
}

/** One drawing, in the corner the header's content leaves empty. */
export const Default: Story = {
  args: { anchor: "top-start", accent: true },
  render: (args) => (
    <Band>
      <DraftingMarks {...args} />
    </Band>
  ),
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector('[data-slot="drafting-marks"]') as SVGSVGElement;
    await expect(svg).toHaveAttribute("aria-hidden", "true");
    await expect(getComputedStyle(svg).pointerEvents).toBe("none");
    await expect(getComputedStyle(svg).maskImage).toContain("radial-gradient");
  },
};

/** Paired with the corner stripes: drawing at one end of the band, stripes at the other. */
export const WithCornerStripes: Story = {
  render: () => (
    <Band className="bg-hairline-stripes">
      <DraftingMarks anchor="bottom-start" />
    </Band>
  ),
};

/** `accent={false}` — rule ink only, for a band that already carries colour. */
export const RuleInkOnly: Story = {
  render: () => (
    <Band>
      <DraftingMarks anchor="top-end" accent={false} />
    </Band>
  ),
};

/** All four anchors are the same drawing, mirrored. */
export const Anchors: Story = {
  render: () => (
    <div className="relative isolate h-[44rem] overflow-hidden bg-background">
      <DraftingMarks anchor="top-start" />
      <DraftingMarks anchor="top-end" />
      <DraftingMarks anchor="bottom-start" />
      <DraftingMarks anchor="bottom-end" />
    </div>
  ),
};
