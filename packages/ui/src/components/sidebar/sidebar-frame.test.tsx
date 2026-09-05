import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { SidebarProvider, useSidebar } from "./sidebar";

/**
 * Task 9A regression net for `SidebarProvider`'s `frame` prop (ADR 0035 §4).
 * `frame="app"` (default, unset) must stay byte-identical to Task 8's
 * behaviour; `frame="nested"` must suppress every row of the ADR's emission
 * table except the two that survive `display: contents` — the CSS custom
 * properties and the `SidebarContext` value.
 */

function Probe() {
  const { state, setOpen } = useSidebar();
  return (
    <div>
      <span data-testid="state">{state}</span>
      <button type="button" onClick={() => setOpen(true)}>
        open
      </button>
    </div>
  );
}

function clearSidebarCookie() {
  document.cookie = "sidebar_state=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
}

describe("SidebarProvider frame", () => {
  beforeEach(() => {
    clearSidebarCookie();
  });

  it("default (no frame prop) renders today's full frame surface", () => {
    const { container } = render(<SidebarProvider>content</SidebarProvider>);
    const wrapper = container.querySelector('[data-slot="sidebar-wrapper"]');
    expect(wrapper).not.toBeNull();
    expect(wrapper).toHaveAttribute("data-state", "expanded");
    expect(wrapper?.className).toContain("group/sidebar-wrapper");
    expect(wrapper?.className).toContain("flex");
    expect(wrapper?.className).toContain("min-h-svh");
    expect(wrapper?.className).toContain("w-full");
    expect(wrapper?.className).toContain("text-foreground");
    expect(wrapper?.className).toContain("has-data-[variant=inset]:bg-sidebar");
    const style = (wrapper as HTMLElement).getAttribute("style") ?? "";
    expect(style).toContain("--sidebar-width");
    expect(style).toContain("--sidebar-width-icon");
  });

  it('frame="app" is byte-identical to the default', () => {
    const { container: defaultContainer } = render(<SidebarProvider>content</SidebarProvider>);
    const { container: appContainer } = render(
      <SidebarProvider frame="app">content</SidebarProvider>,
    );
    const defaultWrapper = defaultContainer.querySelector('[data-slot="sidebar-wrapper"]');
    const appWrapper = appContainer.querySelector('[data-slot="sidebar-wrapper"]');
    expect(appWrapper?.outerHTML).toBe(defaultWrapper?.outerHTML);
  });

  it('frame="nested" emits none of the frame surface', () => {
    const { container } = render(<SidebarProvider frame="nested">content</SidebarProvider>);
    expect(container.querySelector('[data-slot="sidebar-wrapper"]')).toBeNull();

    const root = container.firstElementChild as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.className).not.toContain("group/sidebar-wrapper");
    expect(root.className).not.toContain("min-h-svh");
    expect(root.className).not.toContain("has-data-[variant=inset]");
    expect(root.hasAttribute("data-variant")).toBe(false);
    expect(root.hasAttribute("data-state")).toBe(false);
    expect(root.className).toContain("contents");
    const style = root.getAttribute("style") ?? "";
    expect(style).toContain("--sidebar-width");
    expect(style).toContain("--sidebar-width-icon");
  });

  it('suppresses data-variant/bg-sidebar under frame="nested" even when variant is passed', () => {
    const { container: nestedContainer } = render(
      <SidebarProvider frame="nested" variant="inset">
        content
      </SidebarProvider>,
    );
    const nestedRoot = nestedContainer.firstElementChild as HTMLElement;
    expect(nestedRoot.hasAttribute("data-variant")).toBe(false);
    expect(nestedRoot.className).not.toContain("bg-sidebar");

    const { container: appContainer } = render(
      <SidebarProvider frame="app" variant="inset">
        content
      </SidebarProvider>,
    );
    const appWrapper = appContainer.querySelector('[data-slot="sidebar-wrapper"]') as HTMLElement;
    expect(appWrapper).toHaveAttribute("data-variant", "inset");
    expect(appWrapper.className).toContain("bg-sidebar");
  });

  it('useSidebar() still works under frame="nested"', () => {
    render(
      <SidebarProvider frame="nested" defaultOpen={false}>
        <Probe />
      </SidebarProvider>,
    );
    expect(screen.getByTestId("state").textContent).toBe("collapsed");
    fireEvent.click(screen.getByRole("button", { name: "open" }));
    expect(screen.getByTestId("state").textContent).toBe("expanded");
  });

  it('registers no global keyboard shortcut under frame="nested", but does under frame="app"', () => {
    const nestedSpy = vi.fn();
    render(
      <SidebarProvider frame="nested" open={false} onOpenChange={nestedSpy}>
        content
      </SidebarProvider>,
    );
    fireEvent.keyDown(window, { key: "b", metaKey: true });
    expect(nestedSpy).not.toHaveBeenCalled();

    const appSpy = vi.fn();
    render(
      <SidebarProvider frame="app" open={false} onOpenChange={appSpy}>
        content
      </SidebarProvider>,
    );
    fireEvent.keyDown(window, { key: "b", metaKey: true });
    expect(appSpy).toHaveBeenCalled();
  });

  it('writes no sidebar_state cookie under frame="nested", but does under frame="app"', () => {
    clearSidebarCookie();
    render(
      <SidebarProvider frame="nested">
        <Probe />
      </SidebarProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "open" }));
    expect(document.cookie).not.toContain("sidebar_state");

    clearSidebarCookie();
    render(
      <SidebarProvider frame="app">
        <Probe />
      </SidebarProvider>,
    );
    const appButtons = screen.getAllByRole("button", { name: "open" });
    fireEvent.click(appButtons[appButtons.length - 1]!);
    expect(document.cookie).toContain("sidebar_state");
  });

  it("renders exactly one sidebar-wrapper when a nested provider sits inside an app frame", () => {
    const { container } = render(
      <SidebarProvider>
        <div>
          <SidebarProvider frame="nested">
            <span>rail</span>
          </SidebarProvider>
        </div>
      </SidebarProvider>,
    );
    expect(container.querySelectorAll('[data-slot="sidebar-wrapper"]')).toHaveLength(1);
  });
});
