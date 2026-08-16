/**
 * AppIcon — the standard product/brand mark for app chrome.
 *
 * Built on `BrandLogo`, so it's theme-correct automatically (the approved Qlik
 * colorway per theme). In `morph="auto"` it shows the full "Qlik" lockup and
 * collapses to the Q mark when its enclosing `Sidebar` collapses to the icon rail
 * — a width + crossfade morph. Use it everywhere an app icon appears.
 *
 * The morph keys off the `Sidebar`'s `group-data-[collapsible=icon]` signal.
 * @qlik-coe-emea/qlabs-components-icons can't import `Sidebar` (sibling package), so these stories simulate
 * it with a `.group` + `data-collapsible` wrapper; the real Sidebar integration is
 * shown in the app-shell / admin-console scenarios (apps/docs).
 */
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { AppIcon } from "./app-icon";

const meta = {
  title: "Icons/AppIcon",
  component: AppIcon,
  parameters: { layout: "centered" },
  argTypes: {
    morph: {
      description: "auto = lockup that collapses to the mark in a collapsed Sidebar.",
      control: "inline-radio",
      options: ["auto", "mark", "lockup"],
    },
    height: { control: { type: "range", min: 16, max: 64, step: 2 } },
    tone: { control: "inline-radio", options: ["auto", "white"] },
  },
  args: { morph: "auto", height: 24, tone: "auto", title: "Qlik" },
  tags: ["autodocs"],
} satisfies Meta<typeof AppIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default: the full Qlik lockup (theme-aware). */
export const Default: Story = {};

/**
 * The collapse morph — toggle to watch the lockup morph to the Q mark, exactly as
 * it does when a `Sidebar` collapses. (The `.group` + `data-collapsible` wrapper
 * stands in for the real `Sidebar` here.)
 */
export const CollapseMorph: Story = {
  render: (args) => {
    function Demo() {
      const [collapsed, setCollapsed] = useState(false);
      return (
        <div className="flex flex-col items-center gap-6">
          <div
            className="group flex h-12 items-center rounded-lg border bg-card px-3"
            data-collapsible={collapsed ? "icon" : undefined}
          >
            <AppIcon {...args} />
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="rounded-md border bg-background px-3 py-1.5 text-body font-medium hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {collapsed ? "Expand" : "Collapse"} sidebar
          </button>
        </div>
      );
    }
    return <Demo />;
  },
};

/** Both resting endpoints of the morph, side by side. */
export const Endpoints: Story = {
  render: (args) => (
    <div className="flex items-center gap-10">
      <div className="group flex h-12 items-center rounded-lg border bg-card px-3">
        <AppIcon {...args} />
        <span className="ms-2 text-meta text-muted-foreground">expanded</span>
      </div>
      <div
        className="group flex h-12 items-center rounded-lg border bg-card px-3"
        data-collapsible="icon"
      >
        <AppIcon {...args} />
        <span className="ms-2 text-meta text-muted-foreground">collapsed</span>
      </div>
    </div>
  ),
};

/** Forced full lockup (no morph). */
export const Lockup: Story = { args: { morph: "lockup" } };

/** Forced Q mark (no morph). */
export const Mark: Story = { args: { morph: "mark" } };

/** Scales proportionally with `height`. */
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {[20, 24, 32, 48].map((h) => (
        <AppIcon key={h} morph="lockup" height={h} title={`Qlik ${h}px`} />
      ))}
    </div>
  ),
};
