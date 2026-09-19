import { createRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppShell } from "./app-shell";
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "../sidebar";

describe("AppShell", () => {
  it("forwards a ref to the root element", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <AppShell ref={ref} mainId="main">
        Content
      </AppShell>,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    // The forwarded node IS the shell root — the flex/overflow box that
    // establishes the fixed-height viewport, not some inner wrapper.
    expect(ref.current?.className).toContain("h-dvh");
  });

  /**
   * With none of the new composition props passed, the render is exactly what
   * it always has been: no header, no brand slot, no secondary panel, and the
   * `sidebar` wrapper carries no attribute this change did not add before.
   */
  it("renders unchanged with none of the new composition props passed", () => {
    const { container } = render(
      <AppShell mainId="main" sidebar={<div data-testid="sidebar-marker">Nav</div>}>
        Content
      </AppShell>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toBe("flex h-dvh w-full overflow-hidden bg-background text-foreground");
    expect(container.querySelector("header")).toBeNull();
    expect(container.querySelector('[data-slot="app-shell-brand"]')).toBeNull();
    expect(container.querySelector('[data-slot="app-shell-secondary-panel"]')).toBeNull();
    const sidebarWrapper = screen.getByTestId("sidebar-marker").parentElement;
    expect(sidebarWrapper?.className).toBe("hidden md:flex");
  });
});

describe("AppShell — brandPlacement", () => {
  it('renders no brand slot with brandPlacement left at its default ("sidebar")', () => {
    render(
      <AppShell mainId="main" brand={<span>Acme Inc.</span>}>
        Content
      </AppShell>,
    );
    expect(screen.queryByText("Acme Inc.")).not.toBeInTheDocument();
  });

  it('composes a TopNav with the brand leading it when brandPlacement="topbar"', () => {
    const { container } = render(
      <AppShell mainId="main" brandPlacement="topbar" brand={<span>Acme Inc.</span>}>
        Content
      </AppShell>,
    );
    const header = container.querySelector("header");
    expect(header).not.toBeNull();
    const brand = container.querySelector('[data-slot="app-shell-brand"]');
    expect(brand).not.toBeNull();
    expect(brand).toHaveTextContent("Acme Inc.");
  });

  it("has no effect when a caller-supplied topNav is passed instead of topBar", () => {
    const { container } = render(
      <AppShell
        mainId="main"
        brandPlacement="topbar"
        brand={<span>Acme Inc.</span>}
        topNav={<div data-testid="custom-top-nav">Custom</div>}
      >
        Content
      </AppShell>,
    );
    expect(screen.queryByText("Acme Inc.")).not.toBeInTheDocument();
    expect(screen.getByTestId("custom-top-nav")).toBeInTheDocument();
    // Only the caller's node rendered — the shell never composes a second bar.
    expect(container.querySelectorAll("header").length).toBe(0);
  });
});

describe("AppShell — topBar slots and topNav precedence", () => {
  it("composes start/center/end through TopNav's true-centred grid layout", () => {
    const { container } = render(
      <AppShell
        mainId="main"
        topBar={{
          start: <span data-testid="tb-start">Start</span>,
          center: <span data-testid="tb-center">Center</span>,
          end: <span data-testid="tb-end">End</span>,
        }}
      >
        Content
      </AppShell>,
    );
    expect(screen.getByTestId("tb-start")).toBeInTheDocument();
    expect(screen.getByTestId("tb-center")).toBeInTheDocument();
    expect(screen.getByTestId("tb-end")).toBeInTheDocument();
    // The grid layout that keeps `center` truly centred — not the plain
    // `flex-1` row TopNav falls back to without a `center` slot. Found via
    // the center wrapper's OWN slot, never a raw escaped-bracket class
    // selector, which would silently stop matching if the Tailwind
    // arbitrary-value syntax it encodes ever changes.
    const centerSlot = container.querySelector('[data-slot="top-nav-center"]');
    expect(centerSlot).not.toBeNull();
    expect(centerSlot?.contains(screen.getByTestId("tb-center"))).toBe(true);
    const grid = centerSlot?.parentElement;
    expect(grid?.className).toContain("grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]");
  });

  it("passing topNav wins over topBar — the shell never merges the two", () => {
    render(
      <AppShell
        mainId="main"
        topNav={<div data-testid="custom-top-nav">Custom</div>}
        topBar={{ center: <span data-testid="tb-center">Center</span> }}
      >
        Content
      </AppShell>,
    );
    expect(screen.getByTestId("custom-top-nav")).toBeInTheDocument();
    expect(screen.queryByTestId("tb-center")).not.toBeInTheDocument();
  });
});

describe("AppShell — navigation placement", () => {
  it('renders the sidebar column by default ("sidebar")', () => {
    render(
      <AppShell mainId="main" sidebar={<div data-testid="sidebar-marker">Nav</div>}>
        Content
      </AppShell>,
    );
    expect(screen.getByTestId("sidebar-marker")).toBeInTheDocument();
  });

  it('renders no sidebar column when navigation="topbar", even with a sidebar node passed', () => {
    render(
      <AppShell
        mainId="main"
        navigation="topbar"
        sidebar={<div data-testid="sidebar-marker">Nav</div>}
        topBar={{ center: <span>Primary nav goes here</span> }}
      >
        Content
      </AppShell>,
    );
    expect(screen.queryByTestId("sidebar-marker")).not.toBeInTheDocument();
  });
});

describe("AppShell — secondaryPanel", () => {
  it("renders nothing extra when secondaryPanel is not passed", () => {
    const { container } = render(<AppShell mainId="main">Content</AppShell>);
    expect(container.querySelector('[data-slot="app-shell-secondary-panel"]')).toBeNull();
  });

  it("renders a hidden-below-md column sized from --shell-secondary-width, between sidebar and main", () => {
    const { container } = render(
      <AppShell
        mainId="main"
        sidebar={<div data-testid="sidebar-marker">Nav</div>}
        secondaryPanel={<div data-testid="secondary-marker">Resources</div>}
      >
        Content
      </AppShell>,
    );
    const panel = container.querySelector('[data-slot="app-shell-secondary-panel"]') as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.className).toContain("hidden");
    expect(panel.className).toContain("md:flex");
    expect(panel.className).toContain("w-(--shell-secondary-width)");
    expect(screen.getByTestId("secondary-marker")).toBeInTheDocument();

    // Column order: sidebar, then secondaryPanel, then the main content column.
    const root = container.firstElementChild as HTMLElement;
    const children = Array.from(root.children);
    const sidebarIndex = children.findIndex((el) =>
      el.contains(screen.getByTestId("sidebar-marker")),
    );
    const panelIndex = children.indexOf(panel);
    const mainIndex = children.findIndex((el) => el.querySelector("main"));
    expect(sidebarIndex).toBeGreaterThanOrEqual(0);
    expect(sidebarIndex).toBeLessThan(panelIndex);
    expect(panelIndex).toBeLessThan(mainIndex);
  });
});

describe("AppShell — mobile navigation (#review 2.1: sidebar disappears below md)", () => {
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  /**
   * The `sidebar` slot is `hidden md:flex` with no fallback of its own (see
   * `app-shell.tsx`'s module doc comment) — by design, because `<Sidebar>`
   * already renders its own off-canvas `Sheet` below the mobile breakpoint,
   * through a Radix portal that mounts into `document.body`, entirely
   * unaffected by AppShell's `hidden md:flex` wrapper (a portal is not a
   * descendant of that wrapper's DOM subtree). Composing `<AppShell>` with
   * the real `<Sidebar>` primitive (not a bare custom `<nav>`) and placing a
   * `<SidebarTrigger>` in `topNav` — both wrapped in ONE shared
   * `<SidebarProvider>`, which is a plain React context and so is never
   * blocked by AppShell's internal wrapper `<div>` — is therefore ALREADY a
   * working mobile nav path with no AppShell code change: this test locks
   * that composition rather than reworking AppShell into owning a second,
   * competing `Sheet` (which would have to unmount `<Sidebar>` whenever ITS
   * own drawer closes — see the doc comment for why that is a regression,
   * not a fix). A consumer who instead passes a bare nav node still needs to
   * bring its own responsive fallback, exactly as documented.
   */
  it("reaches sidebar navigation through Sidebar's own Sheet fallback at a mobile width", async () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 500,
    });
    const user = userEvent.setup();
    render(
      <SidebarProvider>
        <AppShell
          mainId="main"
          topNav={<SidebarTrigger />}
          sidebar={
            <Sidebar>
              <SidebarContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton>Dashboard</SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarContent>
            </Sidebar>
          }
        >
          Main content
        </AppShell>
      </SidebarProvider>,
    );

    // Below `md`, the desktop sidebar branch renders nothing (it is inside
    // AppShell's `hidden md:flex` slot AND `<Sidebar>` itself renders `null`
    // desktop markup on mobile) — the nav item is reachable only once the
    // trigger opens the portal-rendered Sheet.
    expect(screen.queryByRole("button", { name: "Dashboard" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Toggle Sidebar" }));

    expect(await screen.findByRole("button", { name: "Dashboard" })).toBeInTheDocument();
  });
});
