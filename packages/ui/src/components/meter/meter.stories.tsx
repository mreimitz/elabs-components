import type { Meta, StoryObj } from "@storybook/react-vite";
import { Meter } from "./meter";

const meta = {
  title: "Display/Meter",
  component: Meter,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A word-sized read-only quantity — a confidence, a share of a ceiling, “4 of 5 signals held”. The ARIA `meter` role, not a `progressbar`: it is a fact within a range, not a task in flight. Default ink is `foreground`; a status tone must be paired with `aria-valuetext` so the state is never colour-only. `segments` draws a countable strip; `marker` draws a reference tick.",
      },
    },
  },
  argTypes: {
    value: { control: "number", table: { category: "State" } },
    min: { control: "number", table: { category: "Behavior" } },
    max: { control: "number", table: { category: "Behavior" } },
    segments: { control: "number", table: { category: "Behavior" } },
    marker: { control: "number", table: { category: "Behavior" } },
    size: {
      control: { type: "select" },
      options: ["xs", "sm", "md"],
      table: { category: "Appearance" },
    },
    variant: {
      control: { type: "select" },
      options: ["default", "success", "warning", "destructive"],
      table: { category: "Appearance" },
    },
  },
  args: { "aria-label": "Share of ceiling", value: 62, className: "w-48" },
} satisfies Meta<typeof Meter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The three heights; `xs` is the inline confidence rung beside a printed percentage. */
export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      <Meter {...args} size="xs" />
      <Meter {...args} size="sm" />
      <Meter {...args} size="md" />
    </div>
  ),
};

/** A quantity that IS a verdict takes a status tone — always with `aria-valuetext`. */
export const Tones: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      <Meter {...args} aria-valuetext="62 of 100" variant="default" />
      <Meter {...args} aria-valuetext="62 of 100, healthy" variant="success" />
      <Meter
        {...args}
        aria-valuetext="88 of 100, approaching the ceiling"
        value={88}
        variant="warning"
      />
      <Meter
        {...args}
        aria-valuetext="100 of 100, over the ceiling"
        value={122}
        variant="destructive"
      />
    </div>
  ),
};

/** A ceiling drawn as a tick; the fill runs past it in the destructive rung. */
export const WithMarker: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      <Meter {...args} marker={500} markerLabel="ceiling 500" max={800} value={420} />
      <Meter
        {...args}
        aria-valuetext="612 of 500, over the ceiling"
        marker={500}
        markerLabel="ceiling 500"
        max={800}
        value={612}
        variant="destructive"
      />
    </div>
  ),
};

/** “4 of 5 signals held” — five discrete facts drawn as five countable cells. */
export const Segmented: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      <Meter {...args} aria-label="Signals held" max={5} segments={5} value={5} />
      <Meter {...args} aria-label="Signals held" max={5} segments={5} value={4} />
      <Meter {...args} aria-label="Signals held" max={5} segments={5} value={2} />
      <Meter {...args} aria-label="Seats active" max={42} segments={42} size="xs" value={41} />
    </div>
  ),
};
