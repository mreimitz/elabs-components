import type { Meta, StoryObj } from "@storybook/react-vite";
import { FileText, History, MessageSquare } from "lucide-react";
import { expect, screen, waitFor } from "storybook/test";

import { ContextRail, type ContextRailSection } from "./context-rail";

const meta = {
  title: "Layout/ContextRail",
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
 *
 * Known constraint (task-11f-brief.md Finding 5): this story's own fixed
 * `h-[560px]` host is shorter than the browser viewport, so the expanded
 * body's `Sheet` (always viewport-height) visibly outruns the persistent
 * strip below it — see the seam this reproduces in `ContextRail`'s own doc
 * comment.
 */
export const Narrow: Story = {
  render: () => (
    <div className="flex h-[560px] w-full">
      <div className="flex-1 bg-background p-6 text-muted-foreground">Canvas content</div>
      <ContextRail sections={sections} defaultActiveSectionId="sources" overlayBreakpoint={2000} />
    </div>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(canvas.getByRole("button", { name: "Sources 4 items" })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Comments 2 items" })).toBeInTheDocument();
    await expect(canvasElement.querySelector('[data-slot="sidebar"]')).toBeNull();
    await expect(canvasElement.querySelector('[data-slot="context-rail"]')).not.toBeNull();

    // `ContextRail` has no `open`/`defaultOpen` here, so `SidebarProvider`'s
    // own default (`true`) drives the Sheet `ContextRailNarrow` wires to that
    // same `open` state — the panel renders OPEN at the same time as the
    // persistent 48px strip, which is exactly the configuration the
    // panel-occludes-the-strip regression (fix round 1, task-9b-fix-1.md)
    // needs to reproduce. `userEvent.click` only checks `pointer-events:
    // none` — it does NOT hit-test — so an occluded-but-visible button would
    // still report a passing click. Assert the browser's REAL hit-test
    // (`document.elementFromPoint`) instead, for an INACTIVE entry and for
    // the ACTIVE/toggle entry — the reviewer's raw-coordinate repro landed
    // on the sheet's own close button from exactly the active entry's
    // position, so both are asserted, not just the easy one.
    async function assertHitTestable(name: string) {
      const button = canvas.getByRole("button", { name });
      // The sheet's own entrance/exit transition (`duration-slow`, 380ms —
      // `themes.css`) animates the panel in via `slide-in-from-right`. The
      // panel is `position: fixed`, so mid-transition it sits translated by
      // roughly its own width — a hit-test taken the instant after the click
      // that opened it would see that IN-FLIGHT position (measured: right
      // edge past the viewport, not its resting inset-by-the-strip-width
      // position) and fail for a reason that has nothing to do with the
      // Blocker this lock exists to catch. Wait for the REAL, settled
      // hit-test to succeed instead of sleeping a fixed amount — this reads
      // as fast as the animation actually is, and still fails for real
      // (after timing out) if the panel keeps covering the strip once
      // settled, which is the only case task-9b-fix-1.md's regression is.
      await waitFor(
        () => {
          const rect = button.getBoundingClientRect();
          if (rect.width === 0) {
            throw new Error(`"${name}" has not been laid out yet (zero width)`);
          }
          const x = rect.left + rect.width / 2;
          const y = rect.top + rect.height / 2;
          const hit = document.elementFromPoint(x, y);
          const hitDescription =
            hit == null
              ? "nothing"
              : `<${hit.tagName.toLowerCase()}${
                  hit.getAttribute("data-slot")
                    ? ` data-slot="${hit.getAttribute("data-slot")}"`
                    : ""
                }>`;
          expect(
            hit != null && button.contains(hit),
            `expected the centre of "${name}" (${x}, ${y}) to hit-test to that button, but it ` +
              `hit ${hitDescription} instead — the sheet panel is likely covering the strip`,
          ).toBe(true);
        },
        { timeout: 1000 },
      );
      return button;
    }

    // The switched-to section's content renders inside `SheetContent`, which
    // Radix portals to `document.body` — a real DOM sibling of
    // `canvasElement`, not a descendant of it — so it must be queried via
    // `screen` (bound to `document.body`), not `canvas` (scoped to
    // `canvasElement`).

    // Inactive entry: clicking it changes the active section.
    const commentsEntry = await assertHitTestable("Comments 2 items");
    await userEvent.click(commentsEntry);
    await expect(screen.getByText("“Looks good, shipping.” — Sam")).toBeVisible();

    // Active/toggle entry: clicking it collapses the rail (closes the Sheet)
    // rather than changing the section. Radix flips the panel's own
    // `data-state` synchronously with the click (the exit ANIMATION, and the
    // eventual unmount, follow after) — asserting that attribute is the
    // immediate, non-flaky signal that the toggle actually fired, rather
    // than racing the animation to observe visibility.
    const commentsToggleEntry = await assertHitTestable("Comments 2 items");
    await userEvent.click(commentsToggleEntry);
    await expect(screen.getByRole("dialog", { hidden: true })).toHaveAttribute(
      "data-state",
      "closed",
    );
  },
};

/**
 * Eight sections in the default 20rem rail — the count at which the header's
 * two occupants genuinely compete for the band. `sections` is caller-supplied
 * and unbounded, and the switcher is a fixed-height row of 32px buttons, so
 * left uncapped it reserves its full width before the heading gets any: the
 * active section's label was measured down to roughly 20px of usable width
 * (its own padding included), which is no label at all. The cap keeps the
 * heading's half of the band and moves the overflow into the switcher, which
 * scrolls.
 */
export const ManySections: Story = {
  render: () => (
    <div className="flex h-[560px] w-full">
      <div className="flex-1 bg-background p-6 text-muted-foreground">Canvas content</div>
      <ContextRail
        sections={[
          ...sections,
          { id: "files", label: "Files", icon: <FileText />, content: <p>Files</p> },
          { id: "notes", label: "Notes", icon: <MessageSquare />, content: <p>Notes</p> },
          { id: "audit", label: "Audit", icon: <History />, content: <p>Audit</p> },
          { id: "links", label: "Links", icon: <FileText />, content: <p>Links</p> },
          { id: "tasks", label: "Tasks", icon: <MessageSquare />, content: <p>Tasks</p> },
        ]}
        defaultActiveSectionId="sources"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const header = canvasElement.querySelector<HTMLElement>('[data-slot="context-rail-header"]');
    const heading = canvasElement.querySelector<HTMLElement>('[data-slot="context-rail-heading"]');
    const switcher = canvasElement.querySelector<HTMLElement>(
      '[data-slot="context-rail-switcher"]',
    );
    await expect(header).not.toBeNull();
    await expect(heading).not.toBeNull();
    await expect(switcher).not.toBeNull();

    const headerWidth = header!.getBoundingClientRect().width;
    const switcherWidth = switcher!.getBoundingClientRect().width;
    const headingWidth = heading!.getBoundingClientRect().width;

    // The switcher never takes more than half the band…
    await expect(switcherWidth).toBeLessThanOrEqual(headerWidth / 2 + 0.5);
    // …so the heading keeps a width a label can actually render in. The
    // regression this locks measured ~20px here.
    await expect(headingWidth).toBeGreaterThan(80);
    // And the header itself never outgrows the rail (the overflow lives
    // inside the switcher, which scrolls).
    await expect(switcher!.scrollWidth).toBeGreaterThan(switcher!.clientWidth);
  },
};
