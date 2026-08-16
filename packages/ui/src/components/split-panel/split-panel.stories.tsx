import type { Meta, StoryObj } from "@storybook/react-vite";
import { SplitPanel } from "./split-panel";

const meta = {
  title: "Layout/SplitPanel",
  component: SplitPanel,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SplitPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const MasterDetail: Story = {
  render: () => (
    <div className="h-[400px]">
      <SplitPanel
        startSize="280px"
        start={<div className="space-y-2 p-4 text-body">List pane</div>}
        end={<div className="p-6 text-body text-muted-foreground">Detail pane</div>}
      />
    </div>
  ),
};

/**
 * Ground-offset tiering: the detail pane is RAISED as a white card (`endTone="card"`)
 * on the page/list ground, so it reads as a distinct surface in every theme without a
 * heavier divider — a card is lighter than the ground in both light and dark (in light
 * the page itself is recessed below white; see research/structural-design 08 §H). A
 * `muted` list well is a light-theme-only enhancement (in dark, `--surface-muted` reads
 * lighter than `--card`), so this demo keeps the list `plain` to read correctly across
 * all three themes.
 */
export const Tiered: Story = {
  render: () => (
    <div className="h-[400px] bg-background p-4">
      <SplitPanel
        startSize="280px"
        endTone="card"
        divider={false}
        className="rounded-lg"
        endClassName="rounded-e-lg"
        start={
          <div className="space-y-2 p-4 text-body">
            <p className="font-medium">Produced assets</p>
            <p className="text-muted-foreground">board-note.md</p>
            <p className="text-muted-foreground">q3-vs-q2.csv</p>
          </div>
        }
        end={
          <div className="space-y-3 p-6 text-body">
            <p className="font-medium">board-note.md</p>
            <p className="text-muted-foreground">
              The raised detail card lifts off the list/page ground by surface offset.
            </p>
          </div>
        }
      />
    </div>
  ),
};
