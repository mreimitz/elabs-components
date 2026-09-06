import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { AppShell } from "./app-shell";
import { TopNav } from "../top-nav";
import { PageShell } from "../page-shell";
import { SectionHeader } from "../section-header";
import { Button } from "../button";

const meta = {
  title: "Layout/App Shell/Minimal",
  component: AppShell,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AppShell>;
export default meta;
type Story = StoryObj<typeof meta>;

const nav = ["Dashboard", "Projects", "Reports", "Settings"];

export const Default: Story = {
  render: () => (
    <div className="h-[600px]">
      <AppShell
        sidebar={
          <nav className="flex h-full w-60 flex-col gap-1 border-e border-sidebar-border bg-sidebar p-3 text-sidebar-foreground">
            <div className="px-2 pb-3 font-semibold">Brand UI</div>
            {nav.map((n, i) => (
              <button
                key={n}
                className={
                  "rounded-md px-3 py-2 text-start text-body font-medium " +
                  (i === 0
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60")
                }
              >
                {n}
              </button>
            ))}
          </nav>
        }
        topNav={
          <TopNav end={<Button size="sm">Invite</Button>}>
            <span className="text-body font-medium">Dashboard</span>
          </TopNav>
        }
      >
        <PageShell
          header={
            <SectionHeader
              // The page's own title, so it owns the document outline root.
              as="h1"
              title="Overview"
              description="A minimal, unstyled two-region shell — the honest answer for a simple layout. For full sidebar behavior use the Sidebar primitive; for a fully wired enterprise console see Layout/App Shell/Flagship."
            />
          }
        >
          <div className="rounded-xl border bg-card p-6 text-body text-muted-foreground">
            Main content area.
          </div>
        </PageShell>
      </AppShell>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The shell ships a skip link, so a keyboard user can pass the nav rail
    // instead of tabbing through it on every route (WCAG 2.4.1). Resolve the
    // TARGET FROM THE LINK, never from a hard-coded `#main-content`: querying
    // the id directly stays green when the link and the target are deleted
    // together.
    const skip = canvas.getByRole("link", { name: "Skip to main content" });
    const targetId = (skip.getAttribute("href") ?? "").replace(/^#/, "");
    await expect(targetId).not.toBe("");
    const target = canvasElement.querySelector(`#${CSS.escape(targetId)}`) as HTMLElement;
    await expect(target).toBeVisible();
    await expect(target.tagName).toBe("MAIN");
    await expect(canvas.getByRole("main")).toBe(target);

    // …and here <main> IS the scroll port (in the registry blocks the skip
    // target and the port are separate elements), so it takes a REAL tab stop,
    // not the `-1` a pure skip target would carry: a region that scrolls has to
    // be keyboard-operable even when nothing inside it is focusable (WCAG
    // 2.1.1, axe `scrollable-region-focusable`). Read as an ATTRIBUTE — the
    // `tabIndex` IDL getter answers -1 for any non-focusable element whether or
    // not anyone set it, so it cannot tell "-1 was set" from "nothing was set".
    await expect(target).toHaveAttribute("tabindex", "0");
    await expect(getComputedStyle(target).overflowY).toBe("auto");
    // The INSET rung: the shell root above carries `overflow-hidden`, which
    // clips both layers of the plain `focus-ring`. Asserting only that
    // `focus-ring-inset` is present would still pass with both classes on the
    // element — and then the clipped one is what paints.
    await expect(target.classList.contains("focus-ring-inset")).toBe(true);
    await expect(target.classList.contains("focus-ring")).toBe(false);

    // The outline has a root. axe cannot catch its absence here:
    // `page-has-heading-one` is a best-practice rule outside the wcag2a/wcag2aa
    // tag set, and `heading-order` passes happily on levels that start at 2.
    const h1s = canvasElement.querySelectorAll("h1");
    await expect(h1s.length).toBe(1);
    await expect(canvas.getByRole("heading", { level: 1 })).toHaveTextContent("Overview");
  },
};
