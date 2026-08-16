import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Sidebar, SidebarInset, SidebarProvider } from "./sidebar";

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
});
