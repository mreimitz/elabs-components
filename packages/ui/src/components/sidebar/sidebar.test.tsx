import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "./sidebar";

function renderFrame() {
  return render(
    <SidebarProvider>
      <Sidebar>
        <span>chrome</span>
      </Sidebar>
      <SidebarInset>
        <p>canvas</p>
      </SidebarInset>
    </SidebarProvider>,
  );
}

describe("SidebarProvider", () => {
  /**
   * Regression lock. The wrapper spans the whole app frame — chrome AND content —
   * so painting the CHROME's ink on it leaks that ink onto the canvas: every
   * element that inherits its colour (an outline Button, a list row) renders in
   * sidebar ink on a page background. That is invisible only while a theme gives
   * `--sidebar` and `--background` the same polarity; a theme with dark chrome
   * under a light canvas renders near-white text on white.
   */
  it("paints the app frame with the page ink, never the chrome ink", () => {
    const { container } = renderFrame();
    const wrapper = container.querySelector('[data-slot="sidebar-wrapper"]');
    expect(wrapper).not.toBeNull();
    expect(wrapper?.className).toContain("text-foreground");
    expect(wrapper?.className).not.toContain("text-sidebar-foreground");
  });

  it("keeps the chrome ink on the sidebar itself", () => {
    renderFrame();
    // The desktop sidebar root owns the chrome colour pair, so the chrome is
    // still correct without the wrapper carrying it.
    const chrome = screen.getByText("chrome").closest('[class*="text-sidebar-foreground"]');
    expect(chrome).not.toBeNull();
  });

  it("marks the active menu button with a non-colour cue, not hue alone", () => {
    render(
      <SidebarProvider>
        <Sidebar>
          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive>Active item</SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>Resting item</SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>,
    );
    const active = screen.getByRole("button", { name: "Active item" });
    const resting = screen.getByRole("button", { name: "Resting item" });
    // Asserting the two class strings merely DIFFER passes on colour-only code and
    // is not sufficient (.claude/rules/accessibility.md §1.4.1). Assert the cues
    // that survive greyscale: a drawn bar, and a heavier weight.
    expect(active.className).toContain("data-[active=true]:before:w-(--sidebar-indicator-width)");
    expect(active.className).toContain("data-[active=true]:font-semibold");
    expect(resting).toHaveAttribute("data-active", "false");
  });

  it("does not re-bind the global keydown listener on every toggle", async () => {
    const user = userEvent.setup();
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    render(
      <SidebarProvider>
        <Sidebar>chrome</Sidebar>
        <SidebarInset>
          <SidebarTrigger />
        </SidebarInset>
      </SidebarProvider>,
    );
    const keydownAddCallsAtMount = addSpy.mock.calls.filter((c) => c[0] === "keydown").length;
    expect(keydownAddCallsAtMount).toBe(1);

    // Each click flips `open`, which recreates `toggleSidebar` (it closes
    // over `setOpen`, which closes over `open`) — a `useEffect` depending on
    // that callback directly would tear down and re-add the `keydown`
    // listener on every single toggle.
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByRole("button"));

    const keydownAddCallsAfterToggles = addSpy.mock.calls.filter((c) => c[0] === "keydown").length;
    const keydownRemoveCalls = removeSpy.mock.calls.filter((c) => c[0] === "keydown").length;
    expect(keydownAddCallsAfterToggles).toBe(1);
    expect(keydownRemoveCalls).toBe(0);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});

describe("Sidebar containerPosition", () => {
  const frame = (position?: "viewport" | "inset") =>
    render(
      <SidebarProvider>
        <Sidebar containerPosition={position}>
          <span>chrome</span>
        </Sidebar>
        <SidebarInset>
          <p>canvas</p>
        </SidebarInset>
      </SidebarProvider>,
    ).container;

  it("pins the rail to the window by default — today's behaviour, unchanged", () => {
    const container = frame().querySelector('[data-slot="sidebar-container"]');
    expect(container?.className).toContain("fixed");
    expect(container?.className).not.toContain("absolute");
    expect(frame().querySelector('[data-slot="sidebar"]')?.className).not.toContain("relative");
  });

  it('pins the rail to its own place in the layout with containerPosition="inset"', () => {
    const root = frame("inset");
    const container = root.querySelector('[data-slot="sidebar-container"]');
    expect(container?.className).toContain("absolute");
    expect(container?.className).not.toContain("fixed");
    // The absolute container needs a positioned ancestor of the rail's own height.
    expect(root.querySelector('[data-slot="sidebar"]')?.className).toContain("relative");
  });
});
