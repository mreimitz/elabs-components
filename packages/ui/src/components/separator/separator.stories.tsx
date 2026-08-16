import type { Meta, StoryObj } from "@storybook/react-vite";
import { Separator } from "./separator";
const meta = {
  title: "Display/Separator",
  component: Separator,
  tags: ["autodocs"],
  argTypes: {
    orientation: {
      description: "Direction of the line.",
      control: { type: "radio" },
      options: ["horizontal", "vertical"],
      table: { category: "Appearance" },
    },
    tone: {
      description:
        "`subtle` uses `--border` (decorative/redundant); `strong` uses `--border-strong` (≥3:1, sole structural cue).",
      control: { type: "radio" },
      options: ["subtle", "strong"],
      table: { category: "Appearance" },
    },
    decorative: {
      description: "When true the separator is hidden from the accessibility tree (role=none).",
      control: "boolean",
      table: { category: "Behavior" },
    },
    className: {
      description: "Extra Tailwind classes merged via cn().",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof Separator>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default (subtle) — uses `--border`. The boundary is a decorative/redundant
 * cue (surrounding fill, elevation, or spacing already signals the edge).
 * WCAG 1.4.11 redundant-boundary exemption applies.
 */
export const Default: Story = {
  render: () => (
    <div className="w-64 text-body">
      <p>Above</p>
      <Separator className="my-3" />
      <p>Below</p>
    </div>
  ),
};

/**
 * Strong — uses `--border-strong` (≥3:1 vs `--card`/`--background`). Use when
 * the separator is the ONLY structural cue between two same-surface regions.
 * Decision test: "If I deleted this line, could a sighted user still tell the
 * two regions apart?" No → `tone="strong"`.
 */
export const Strong: Story = {
  render: () => (
    <div className="w-64 rounded-lg bg-card p-4 text-body">
      <p className="font-medium">Section A</p>
      <Separator tone="strong" className="my-3" />
      <p className="font-medium">Section B</p>
    </div>
  ),
};

/** Vertical orientation, default (subtle) tone. */
export const Vertical: Story = {
  render: () => (
    <div className="flex h-8 items-center gap-4 text-body">
      <span>Left</span>
      <Separator orientation="vertical" />
      <span>Right</span>
    </div>
  ),
};

/** Vertical orientation, strong tone — the only structural cue between columns. */
export const VerticalStrong: Story = {
  render: () => (
    <div className="flex h-8 items-center gap-4 text-body">
      <span>Left</span>
      <Separator orientation="vertical" tone="strong" />
      <span>Right</span>
    </div>
  ),
};
