import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { useState } from "react";
import { Reveal, RevealGroup } from "./reveal";
import { Button } from "../button/button";
import { Card, CardContent } from "../card/card";

const meta = {
  title: "Core/Reveal",
  component: Reveal,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  argTypes: {
    appear: {
      description: "Entrance animation direction or style.",
      control: { type: "select" },
      options: ["up", "down", "left", "right", "zoom", "fade"],
      table: { category: "Appearance" },
    },
    speed: {
      description: "Animation duration rung — maps to the gated motion token.",
      control: { type: "radio" },
      options: ["fast", "base", "slow"],
      table: { category: "Appearance" },
    },
    delayMs: {
      description: "Animation delay in ms (RevealGroup sets this per child to stagger).",
      control: "number",
      table: { category: "Behavior" },
    },
    className: {
      description: "Extra Tailwind classes merged via cn().",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof Reveal>;

export default meta;
type Story = StoryObj<typeof meta>;

const ROWS = ["Connectors", "Pipelines", "Datasets", "Dashboards", "Alerts"];

function StaggerDemo() {
  const [run, setRun] = useState(0);
  return (
    <div className="flex w-80 flex-col gap-4">
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={() => setRun((n) => n + 1)}>
          Replay
        </Button>
      </div>
      <RevealGroup key={run} className="flex flex-col gap-2" appear="up" staggerMs={60}>
        {ROWS.map((row) => (
          <Card key={row} interactive>
            <CardContent className="p-3 text-body">{row}</CardContent>
          </Card>
        ))}
      </RevealGroup>
    </div>
  );
}

/** Staggered list entrance — hit Replay (or flip the Motion toolbar) to compare. */
export const Default: Story = {
  render: () => <StaggerDemo />,
  play: async ({ canvas }) => {
    // All children are cloned + rendered (presence, not immediate visibility —
    // staggered items sit at opacity 0 during their delay via fill-mode-both).
    await expect(await canvas.findByText("Connectors")).toBeInTheDocument();
    await expect(await canvas.findByText("Alerts")).toBeInTheDocument();
  },
};

/** The directional + zoom variants. */
export const Directions: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-3">
      {(["up", "down", "left", "right", "zoom", "fade"] as const).map((appear) => (
        <Reveal
          key={appear}
          appear={appear}
          className="bg-surface flex h-20 w-24 items-center justify-center rounded-md border text-meta"
        >
          {appear}
        </Reveal>
      ))}
    </div>
  ),
};
