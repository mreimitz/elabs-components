import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Globe, Search, Sparkles } from "lucide-react";
import { AppShell } from "./app-shell";
import { TopNav } from "../top-nav";
import { PageShell } from "../page-shell";
import { SectionHeader } from "../section-header";
import { Button } from "../button";
import { NavUser } from "../nav-user";
import { TeamSwitcher } from "../team-switcher";
import { AppSidebar } from "../app-sidebar";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "../sidebar";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../input-group";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "../navigation-menu";

const meta = {
  title: "Layout/App Shell/Minimal",
  component: AppShell,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AppShell>;
export default meta;
type Story = StoryObj<typeof meta>;

// Settings is not a nav row — it lives in the user menu at the foot of the rail.
const nav = ["Dashboard", "Projects", "Reports"];

// Neutral placeholder identity, reused verbatim from `Layout/AppSidebar`'s own
// stories — never a real product name.
const sampleTeams = [
  { name: "Acme Inc.", logo: Sparkles, plan: "Enterprise" },
  { name: "Beta Corp.", logo: Globe, plan: "Free" },
];
const sampleUser = { name: "Jane Doe", email: "jane@example.com" };

const navMenu = (
  <SidebarGroup>
    <SidebarGroupContent>
      <SidebarMenu>
        {nav.map((n, i) => (
          <SidebarMenuItem key={n}>
            <SidebarMenuButton isActive={i === 0}>{n}</SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
);

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
            {/* The standard footer every shell ends with. NavUser reads the
                sidebar context, so a nested (context-only) provider carries it
                without turning this plain nav into a Sidebar frame. */}
            <div className="mt-auto">
              <SidebarProvider frame="nested">
                <NavUser
                  user={{ name: "Avery Rao", email: "avery@acme.co" }}
                  settingsHref="/settings"
                />
              </SidebarProvider>
            </div>
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

/**
 * `brandPlacement="topbar"` moves the brand mark out of the sidebar header and
 * into the top bar, and `topBar.center` gives it a genuinely centred search
 * field — a 3-column grid, not `flex-1` filler that only happens to centre
 * when the flanking content is symmetric (here it is not: the brand is a
 * short mark, the trailing slot a wider action button).
 */
export const BrandInTopBar: Story = {
  name: "Brand in the top bar, with a centred search field",
  render: () => (
    <div className="h-[600px]">
      <SidebarProvider>
        <AppShell
          brandPlacement="topbar"
          brand={
            <span className="flex items-center gap-2 font-semibold">
              <Sparkles className="size-4" aria-hidden="true" />
              Acme Inc.
            </span>
          }
          topBar={{
            center: (
              <InputGroup className="w-72">
                <InputGroupAddon>
                  <Search aria-hidden="true" />
                </InputGroupAddon>
                <InputGroupInput placeholder="Search…" aria-label="Search" />
              </InputGroup>
            ),
            end: <Button size="sm">Invite</Button>,
          }}
          sidebar={<AppSidebar>{navMenu}</AppSidebar>}
        >
          <PageShell
            header={
              <SectionHeader
                as="h1"
                title="Overview"
                description="The sidebar renders navigation only — no header of its own — because the brand now lives in the top bar."
              />
            }
          >
            <div className="rounded-xl border bg-card p-6 text-body text-muted-foreground">
              Main content area.
            </div>
          </PageShell>
        </AppShell>
      </SidebarProvider>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const header = canvasElement.querySelector("header") as HTMLElement;
    await expect(header).toBeVisible();
    const brand = canvasElement.querySelector('[data-slot="app-shell-brand"]');
    await expect(brand).toBeVisible();
    await expect(brand).toHaveTextContent("Acme Inc.");
    await expect(header.contains(brand)).toBe(true);

    // The search field renders through the CENTRE column, not `start`/`end`.
    const centerSlot = canvasElement.querySelector('[data-slot="top-nav-center"]') as HTMLElement;
    const search = canvas.getByPlaceholderText("Search…");
    await expect(search).toBeVisible();
    await expect(centerSlot.contains(search)).toBe(true);

    // True centring: with an asymmetric brand (narrow) and action button
    // (wider) on either side, the centre column's midpoint still lands on
    // the bar's own midpoint — a `flex-1` row would not manage this.
    const barBox = header.getBoundingClientRect();
    const centerBox = centerSlot.getBoundingClientRect();
    const barMid = barBox.left + barBox.width / 2;
    const centerMid = centerBox.left + centerBox.width / 2;
    await expect(Math.round(Math.abs(barMid - centerMid))).toBeLessThanOrEqual(2);

    // The sidebar renders the nav rows and nothing that duplicates the brand.
    const sidebar = canvasElement.querySelector('[data-slot="sidebar"]') as HTMLElement;
    await expect(sidebar).toBeVisible();
    await expect(within(sidebar).queryByText("Acme Inc.")).not.toBeInTheDocument();
  },
};

/**
 * No `topNav`/`topBar` at all — the layout this shell has always supported.
 * The sidebar keeps today's behavior in full: it owns the brand (via
 * `TeamSwitcher`) and the account menu (via `NavUser`) with no shell code
 * change required to reach it.
 */
export const NoTopBar: Story = {
  name: "No top bar",
  render: () => (
    <div className="h-[600px]">
      <SidebarProvider>
        <AppShell
          sidebar={
            <AppSidebar
              header={<TeamSwitcher teams={sampleTeams} />}
              footer={<NavUser user={sampleUser} settingsHref="/settings" />}
            >
              {navMenu}
            </AppSidebar>
          }
        >
          <PageShell
            header={
              <SectionHeader
                as="h1"
                title="Overview"
                description="No top bar at all — the sidebar’s own header and footer are this screen’s only chrome."
              />
            }
          >
            <div className="rounded-xl border bg-card p-6 text-body text-muted-foreground">
              Main content area.
            </div>
          </PageShell>
        </AppShell>
      </SidebarProvider>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvasElement.querySelector("header")).toBeNull();

    const sidebar = canvasElement.querySelector('[data-slot="sidebar"]') as HTMLElement;
    await expect(sidebar).toBeVisible();
    // The brand lives in the sidebar's own header (TeamSwitcher), unchanged.
    await expect(within(sidebar).getByText("Acme Inc.")).toBeVisible();
    // …and the account menu is NavUser, the standard footer — never a loose
    // Settings row.
    await expect(
      within(sidebar).getByRole("button", { name: `${sampleUser.name} ${sampleUser.email}` }),
    ).toBeVisible();

    await expect(canvas.getByRole("heading", { level: 1 })).toHaveTextContent("Overview");
  },
};

/**
 * `navigation="topbar"` renders no sidebar column at all — the primary
 * navigation moves into `topBar.center` as a horizontal `NavigationMenu`
 * instead, with the brand leading it in `topBar.start`.
 */
export const TopBarNavigation: Story = {
  name: "Horizontal primary navigation in the top bar",
  render: () => (
    <div className="h-[600px]">
      <AppShell
        navigation="topbar"
        topBar={{
          start: (
            <span className="flex items-center gap-2 font-semibold">
              <Sparkles className="size-4" aria-hidden="true" />
              Acme Inc.
            </span>
          ),
          center: (
            <NavigationMenu aria-label="Primary">
              <NavigationMenuList>
                {nav.map((n, i) => (
                  <NavigationMenuItem key={n}>
                    <NavigationMenuLink
                      asChild
                      active={i === 0}
                      className={navigationMenuTriggerStyle()}
                    >
                      <a href="#">{n}</a>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                ))}
              </NavigationMenuList>
            </NavigationMenu>
          ),
          end: <Button size="sm">Invite</Button>,
        }}
      >
        <PageShell
          header={
            <SectionHeader
              as="h1"
              title="Overview"
              description="No sidebar column — the primary navigation runs horizontally in the top bar instead."
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

    // No sidebar column, in any form.
    await expect(canvasElement.querySelector('[data-slot="sidebar"]')).toBeNull();

    const primaryNav = canvas.getByRole("navigation", { name: "Primary" });
    await expect(primaryNav).toBeVisible();
    for (const n of nav) {
      await expect(within(primaryNav).getByRole("link", { name: n })).toBeVisible();
    }

    const header = canvasElement.querySelector("header") as HTMLElement;
    await expect(header.contains(primaryNav)).toBe(true);
    await expect(header).toHaveTextContent("Acme Inc.");

    await expect(canvas.getByRole("heading", { level: 1 })).toHaveTextContent("Overview");
  },
};

/**
 * `secondaryPanel` adds a second column beside the sidebar — sized from
 * `--shell-secondary-width` (16rem by default) and hidden below `md` exactly
 * like `sidebar`, for a resource/filter panel that is not itself navigation.
 */
export const SecondaryPanel: Story = {
  name: "A second resource panel beside the sidebar",
  render: () => (
    <div className="h-[600px]">
      <SidebarProvider>
        <AppShell
          sidebar={
            <AppSidebar footer={<NavUser user={sampleUser} settingsHref="/settings" />}>
              {navMenu}
            </AppSidebar>
          }
          secondaryPanel={
            <div className="flex h-full w-full flex-col gap-1 border-e bg-sidebar p-3 text-sidebar-foreground">
              <div className="px-2 pb-2 text-eyebrow text-sidebar-muted-foreground">
                Saved views
              </div>
              {["Overview", "In progress", "Archived"].map((label) => (
                <button
                  key={label}
                  className="rounded-md px-3 py-2 text-start text-body text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
                >
                  {label}
                </button>
              ))}
            </div>
          }
          topNav={<TopNav start={<span className="text-body font-medium">Dashboard</span>} />}
        >
          <PageShell
            header={
              <SectionHeader
                as="h1"
                title="Overview"
                description="A second column between the primary navigation and the content — its own scroll region, its own chrome."
              />
            }
          >
            <div className="rounded-xl border bg-card p-6 text-body text-muted-foreground">
              Main content area.
            </div>
          </PageShell>
        </AppShell>
      </SidebarProvider>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const panel = canvasElement.querySelector(
      '[data-slot="app-shell-secondary-panel"]',
    ) as HTMLElement;
    await expect(panel).toBeVisible();
    await expect(panel).toHaveTextContent("Saved views");

    const sidebar = canvasElement.querySelector('[data-slot="sidebar"]') as HTMLElement;
    const main = canvasElement.querySelector("main") as HTMLElement;
    await expect(sidebar).toBeVisible();
    await expect(main).toBeVisible();

    // DOM order: sidebar, then the secondary panel, then the main column —
    // reading order matches the visual left-to-right layout.
    await expect(
      !!(sidebar.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
    await expect(!!(panel.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(
      true,
    );

    // The real width the token contract promises, measured in the browser.
    const width = Math.round(panel.getBoundingClientRect().width);
    await expect(`secondary panel width=${width}px`).toBe("secondary panel width=256px");
  },
};
