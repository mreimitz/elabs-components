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
