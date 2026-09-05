import type { Meta, StoryObj } from "@storybook/react-vite";
import { FileText, History, MessageSquare } from "lucide-react";
import { expect } from "storybook/test";

import { ContextRail, type ContextRailSection } from "./context-rail";

const meta = {
  title: "Layout/Context Rail",
  component: ContextRail,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A right-hand rail whose collapsed state is a 48px icon strip that doubles as its own section switcher — click a switcher entry to make it active, click the ACTIVE entry again to collapse/expand. Below `overlayBreakpoint` (default 768) it renders the strip plus a `Sheet` overlay for the expanded body instead of a fixed-width panel. See `docs/ADR/0035-context-rail-and-side-dock.md`.",
      },
    },
  },
} satisfies Meta<typeof ContextRail>;
export default meta;
type Story = StoryObj<typeof meta>;

const sections: ContextRailSection[] = [
  {
    id: "sources",
    label: "Sources",
    icon: <FileText />,
    count: 4,
    content: (
      <ul className="flex flex-col gap-2 text-body">
        <li className="rounded-md border border-border p-2">quarterly-report.pdf — p.12</li>
        <li className="rounded-md border border-border p-2">design-notes.md — §3</li>
        <li className="rounded-md border border-border p-2">onboarding-flow.fig</li>
        <li className="rounded-md border border-border p-2">support-thread-4821</li>
      </ul>
    ),
  },
  {
    id: "comments",
    label: "Comments",
    icon: <MessageSquare />,
    count: 2,
    content: (
      <ul className="flex flex-col gap-2 text-body">
        <li className="rounded-md border border-border p-2">
          &ldquo;Can we tighten this copy?&rdquo; — Priya
        </li>
        <li className="rounded-md border border-border p-2">
          &ldquo;Looks good, shipping.&rdquo; — Sam
        </li>
      </ul>
    ),
  },
  {
    id: "activity",
    label: "Activity",
    icon: <History />,
    content: (
      <ul className="flex flex-col gap-2 text-body text-muted-foreground">
        <li>Created 2 hours ago</li>
        <li>Edited by Priya, 40 minutes ago</li>
        <li>Reviewed by Sam, 5 minutes ago</li>
      </ul>
    ),
  },
];

/** Expanded (`open`, default), three believable sections, the first active. */
export const Default: Story = {
  render: () => (
    <div className="flex h-[560px] w-full">
      <div className="flex-1 bg-background p-6 text-muted-foreground">Canvas content</div>
      <ContextRail sections={sections} defaultActiveSectionId="sources" />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Sources 4 items" })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Comments 2 items" })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Activity" })).toBeInTheDocument();
    await expect(canvas.getByText("Sources")).toBeInTheDocument();
  },
};

/** `defaultOpen={false}` — the collapsed 48px icon strip, still fully operable as a switcher (uncontrolled, so the click-to-expand in the play function actually moves state). */
export const Collapsed: Story = {
  render: () => (
    <div className="flex h-[560px] w-full">
      <div className="flex-1 bg-background p-6 text-muted-foreground">Canvas content</div>
      <ContextRail sections={sections} defaultActiveSectionId="sources" defaultOpen={false} />
    </div>
  ),
  play: async ({ canvas, userEvent }) => {
    const sourcesEntry = await canvas.findByRole("button", { name: "Sources 4 items" });
    await expect(sourcesEntry).toBeInTheDocument();
    // Content stays mounted while collapsed (only the ACTIVE section's
    // content is ever mounted at all — collapsing hides it visually via
    // CSS, it doesn't unmount it) — so assert visibility, not presence.
    await expect(canvas.getByText("quarterly-report.pdf — p.12")).not.toBeVisible();

    // Clicking the ACTIVE entry while collapsed expands the rail again.
    await userEvent.click(sourcesEntry);
    await expect(canvas.getByText("quarterly-report.pdf — p.12")).toBeVisible();
  },
};

/** No sections — the default localized empty state. */
export const Empty: Story = {
  render: () => (
    <div className="flex h-[560px] w-full">
      <div className="flex-1 bg-background p-6 text-muted-foreground">Canvas content</div>
      <ContextRail sections={[]} />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("No sections")).toBeInTheDocument();
  },
};

/**
 * Below `overlayBreakpoint` the rail mounts its own strip plus a `Sheet`
 * instead of `Sidebar`. A viewport-size story parameter cannot force this
 * branch under a headless run (the composed story's `window.innerWidth`
 * doesn't track the addon's viewport there), so this story forces it
 * deterministically with a very high `overlayBreakpoint` instead — reliable
 * both interactively and under `vitest --project storybook`.
 */
export const Narrow: Story = {
  render: () => (
    <div className="flex h-[560px] w-full">
      <div className="flex-1 bg-background p-6 text-muted-foreground">Canvas content</div>
      <ContextRail sections={sections} defaultActiveSectionId="sources" overlayBreakpoint={2000} />
    </div>
  ),
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("button", { name: "Sources 4 items" })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Comments 2 items" })).toBeInTheDocument();
    await expect(canvasElement.querySelector('[data-slot="sidebar"]')).toBeNull();
    await expect(canvasElement.querySelector('[data-slot="context-rail"]')).not.toBeNull();
  },
};
