import type { Meta, StoryObj } from "@storybook/react-vite";
import { Home, Inbox, Search, Settings } from "lucide-react";
import { expect } from "storybook/test";
import { Sidebar } from "./sidebar";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
} from "./sidebar";

const meta = {
  title: "Layout/Sidebar",
  component: Sidebar,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The sidebar PRIMITIVE set you assemble yourself — an application sidebar with typed `header` / `footer` / nav slots is `Layout/AppSidebar`, which composes exactly these parts; see [Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). `SidebarProvider` owns the open state (⌘B / Ctrl+B, persisted in a `sidebar_state` cookie); `Sidebar` takes `side`, `variant` and a `collapsible` mode of `offcanvas` / `icon` / `none`; `SidebarHeader` / `SidebarContent` / `SidebarFooter` / `SidebarMenu*` are the parts. Reach for these only when the shell is bespoke.",
      },
    },
  },
} satisfies Meta<typeof Sidebar>;
export default meta;
type Story = StoryObj<typeof meta>;

const items = [
  { title: "Home", icon: Home },
  { title: "Inbox", icon: Inbox },
  { title: "Search", icon: Search },
  { title: "Settings", icon: Settings },
];

/** A collapsible icon-rail sidebar assembled from the primitive parts, with one active nav item. */
export const Default: Story = {
  render: () => (
    <div className="h-[480px]">
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <SidebarHeader className="px-3 py-2 font-semibold">Brand UI</SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Platform</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item, i) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton isActive={i === 0} tooltip={item.title}>
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <SidebarInset>
          <header className="flex h-14 items-center gap-2 border-b px-4">
            <SidebarTrigger />
            <span className="text-body font-medium">Dashboard</span>
          </header>
          <div className="p-6 text-body text-muted-foreground">
            Main content. Press ⌘/Ctrl+B to toggle.
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  ),
};

/** The active item is distinguishable without colour: an accent bar plus a heavier label. */
export const ActiveIndicator: Story = {
  render: () => (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton isActive data-testid="active">
                Overview
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton data-testid="resting">Reports</SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  ),
  play: async ({ canvasElement }) => {
    const active = canvasElement.querySelector('[data-testid="active"]') as HTMLElement;
    const resting = canvasElement.querySelector('[data-testid="resting"]') as HTMLElement;
    const bar = getComputedStyle(active, "::before");
    const none = getComputedStyle(resting, "::before");
    // Geometry, not hue: the bar has real width on the active item and none on the resting one.
    await expect(parseFloat(bar.width)).toBeGreaterThan(0);
    await expect(parseFloat(none.width) || 0).toBe(0);
    await expect(getComputedStyle(active).fontWeight).not.toBe(
      getComputedStyle(resting).fontWeight,
    );
  },
};

/**
 * The same non-colour cue one level down, at the sub-item: `SidebarMenuSubButton`
 * renders an anchor rather than a button, so the `::before` bar's containing block
 * is the anchor's own (relatively positioned) box, not `SidebarMenuSubItem`'s `<li>`.
 */
export const ActiveSubItemIndicator: Story = {
  render: () => (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton>Platform</SidebarMenuButton>
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton href="#overview" isActive data-testid="sub-active">
                    Overview
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton href="#reports" data-testid="sub-resting">
                    Reports
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  ),
  play: async ({ canvasElement }) => {
    const active = canvasElement.querySelector('[data-testid="sub-active"]') as HTMLElement;
    const resting = canvasElement.querySelector('[data-testid="sub-resting"]') as HTMLElement;
    // Still a real link with a real accessible name, not just a styled div.
    await expect(active).toHaveAccessibleName("Overview");
    await expect(resting).toHaveAccessibleName("Reports");
    const bar = getComputedStyle(active, "::before");
    const none = getComputedStyle(resting, "::before");
    // Geometry, not hue: the bar has real width on the active sub-item and none on the resting one.
    await expect(parseFloat(bar.width)).toBeGreaterThan(0);
    await expect(parseFloat(none.width) || 0).toBe(0);
    await expect(getComputedStyle(active).fontWeight).not.toBe(
      getComputedStyle(resting).fontWeight,
    );
  },
};

/**
 * A right-hand panel can drive the floating inset surface — sibling order must
 * not decide it (#342). `SidebarProvider variant="inset"` writes `data-variant`
 * on the frame wrapper, an ANCESTOR of both `SidebarInset` and the right-hand
 * `Sidebar`, so `SidebarInset` reaches it regardless of where the rail sits in
 * the DOM — unlike the old `peer-*` combinator, which only matches a sibling
 * that comes AFTER.
 */
export const RightHandInset: Story = {
  render: () => (
    <SidebarProvider variant="inset">
      <SidebarInset data-testid="inset" gutter={{ start: true, bottom: true }}>
        <div className="p-6 text-body">content</div>
      </SidebarInset>
      <Sidebar side="right" variant="inset">
        <SidebarContent />
      </Sidebar>
    </SidebarProvider>
  ),
  play: async ({ canvasElement }) => {
    const inset = canvasElement.querySelector('[data-testid="inset"]') as HTMLElement;
    const s = getComputedStyle(inset);
    await expect(parseFloat(s.borderTopLeftRadius)).toBeGreaterThan(0);
    await expect(parseFloat(s.marginInlineStart)).toBeGreaterThan(0);
    // The §2.2 geometry: leading + bottom only. A tab must touch the page it belongs to.
    await expect(parseFloat(s.marginTop)).toBe(0);
    await expect(parseFloat(s.marginInlineEnd)).toBe(0);
  },
};

/**
 * A LEFT sidebar composing BOTH inset mechanisms at once — `SidebarProvider
 * variant="inset"` AND the legacy `Sidebar variant="inset"` on the same
 * frame, the exact shape a left-hand shell (e.g. the sidebar-02 rebuild)
 * uses — must resolve to the explicit `gutter`'s geometry, deterministically
 * (fix round 1, #342, Ruling 18). Unlike `RightHandInset`, DOM order here
 * lets BOTH the ancestor-scoped and the legacy peer-scoped selectors match
 * simultaneously, so this is the one shape that could have produced a
 * class-order race; the pinning assertion below is what proves it doesn't.
 */
export const LeftHandDualVariantInset: Story = {
  render: () => (
    <SidebarProvider variant="inset">
      <Sidebar variant="inset">
        <SidebarContent />
      </Sidebar>
      <SidebarInset data-testid="inset" gutter={{ start: true, bottom: true }}>
        <div className="p-6 text-body">content</div>
      </SidebarInset>
    </SidebarProvider>
  ),
  play: async ({ canvasElement }) => {
    const inset = canvasElement.querySelector('[data-testid="inset"]') as HTMLElement;
    const s = getComputedStyle(inset);
    // The explicit gutter's geometry: leading + bottom only.
    await expect(parseFloat(s.marginInlineStart)).toBeGreaterThan(0);
    await expect(parseFloat(s.marginBottom)).toBeGreaterThan(0);
    // NOT the legacy rule's hardcoded "auto" shape, which would set marginTop
    // > 0 and marginInlineStart === 0 — the opposite signature.
    await expect(parseFloat(s.marginTop)).toBe(0);
    await expect(parseFloat(s.marginInlineEnd)).toBe(0);
  },
};

/**
 * `SidebarInset`'s default gutter ("auto") recovers its leading margin once
 * the sidebar collapses — driven purely by `SidebarProvider`'s own
 * `data-state` on the ancestor wrapper (ADR 0035 §8 refinement 2), with NO
 * `variant` set on `Sidebar` itself (so the legacy peer rule cannot be what
 * produces this margin — only the ancestor path can).
 */
export const AutoGutterRecoversOnCollapse: Story = {
  render: () => (
    <SidebarProvider variant="inset" defaultOpen={false}>
      <Sidebar collapsible="icon">
        <SidebarContent />
      </Sidebar>
      <SidebarInset data-testid="inset">
        <div className="p-6 text-body">content</div>
      </SidebarInset>
    </SidebarProvider>
  ),
  play: async ({ canvasElement }) => {
    const inset = canvasElement.querySelector('[data-testid="inset"]') as HTMLElement;
    const s = getComputedStyle(inset);
    await expect(parseFloat(s.marginInlineStart)).toBeGreaterThan(0);
  },
};

/**
 * A nested rail's own `variant="inset"` must never repaint the FRAME's ground
 * once the frame declares its own `variant` (ADR 0035 §8 refinement 4) — the
 * old rule read `has-data-[variant=inset]:bg-sidebar`, and `:has()` is
 * depth-unlimited, so a descendant's variant used to leak up through it.
 */
export const FrameVariantWinsOverNestedInset: Story = {
  render: () => (
    <SidebarProvider variant="sidebar">
      <Sidebar variant="inset">
        <SidebarContent />
      </Sidebar>
      <SidebarInset>
        <div className="p-6 text-body">content</div>
      </SidebarInset>
    </SidebarProvider>
  ),
  play: async ({ canvasElement }) => {
    const wrapper = canvasElement.querySelector('[data-slot="sidebar-wrapper"]') as HTMLElement;
    // The frame explicitly says "sidebar", so the ground must stay
    // transparent even though a nested `Sidebar` renders `variant="inset"`.
    await expect(getComputedStyle(wrapper).backgroundColor).toBe("rgba(0, 0, 0, 0)");
  },
};

/**
 * The control for `FrameVariantWinsOverNestedInset`: when the frame's own
 * `variant` is UNSET (every caller before #342), the descendant `:has()`
 * fallback still applies — so existing callers render exactly as today.
 */
export const UnsetFrameVariantFallsBackToDescendant: Story = {
  render: () => (
    <SidebarProvider>
      <Sidebar variant="inset">
        <SidebarContent />
      </Sidebar>
      <SidebarInset>
        <div className="p-6 text-body">content</div>
      </SidebarInset>
    </SidebarProvider>
  ),
  play: async ({ canvasElement }) => {
    const wrapper = canvasElement.querySelector('[data-slot="sidebar-wrapper"]') as HTMLElement;
    await expect(getComputedStyle(wrapper).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  },
};

/** Collapsed to the icon rail, a group label takes no space at all — not an invisible box. */
export const CollapsedGroupLabel: Story = {
  render: () => (
    <SidebarProvider defaultOpen={false}>
      <Sidebar collapsible="icon">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel data-testid="label">Platform</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Overview">Overview</SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  ),
  play: async ({ canvasElement }) => {
    const label = canvasElement.querySelector('[data-testid="label"]') as HTMLElement;
    // `opacity: 0` leaves the box in flow — the gap users see. `display: none` does not.
    await expect(getComputedStyle(label).display).toBe("none");
    await expect(label.getBoundingClientRect().height).toBe(0);
  },
};

/**
 * `SidebarProvider frame="nested"` (ADR 0035 §4, Task 9A) is the shared
 * primitive a compound component (e.g. the future `ContextRail`) mounts to
 * give a second `Sidebar` its own `useSidebar()` state without behaving like
 * a second app frame — the smallest real composition that proves it in a
 * browser rather than in jsdom: an ordinary left-hand app frame whose inset
 * content nests a `frame="nested"` provider around a right-hand icon rail.
 */
export const NestedFrameProvider: Story = {
  render: () => (
    <div className="h-[480px]">
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <SidebarHeader className="px-3 py-2 font-semibold">Brand UI</SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton isActive tooltip="Home">
                      <Home />
                      <span>Home</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <SidebarInset>
          <header className="flex h-14 items-center gap-2 border-b px-4">
            <SidebarTrigger />
            <span className="text-body font-medium">Dashboard</span>
          </header>
          <div className="flex h-[calc(100%-3.5rem)]">
            <div className="flex-1 p-6 text-body text-muted-foreground">Main content.</div>
            <SidebarProvider frame="nested" data-testid="nested-provider">
              <Sidebar side="right" collapsible="icon">
                <SidebarContent>
                  <SidebarGroup>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        <SidebarMenuItem>
                          <SidebarMenuButton tooltip="Details">
                            <Inbox />
                            <span>Details</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                          <SidebarMenuButton tooltip="Settings">
                            <Settings />
                            <span>Settings</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </SidebarGroup>
                </SidebarContent>
              </Sidebar>
            </SidebarProvider>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // Exactly one frame in the whole composition — the nested provider does
    // not duplicate the "sidebar wrapper" slot.
    await expect(canvasElement.querySelectorAll('[data-slot="sidebar-wrapper"]')).toHaveLength(1);
    const nestedProviderEl = canvasElement.querySelector(
      '[data-testid="nested-provider"]',
    ) as HTMLElement;
    await expect(nestedProviderEl).not.toBeNull();
    // `display: contents` — resolved from the story's own DOM, not a guessed
    // ancestor.
    await expect(getComputedStyle(nestedProviderEl).display).toBe("contents");
    // The custom property survives `display: contents`, which is how the
    // nested provider publishes its width to the `Sidebar` beneath it.
    await expect(getComputedStyle(nestedProviderEl).getPropertyValue("--sidebar-width")).not.toBe(
      "",
    );
  },
};
