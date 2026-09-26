import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteShell, SiteShellFooter, SiteShellHeader, SiteShellMain } from "./site-shell";

describe("SiteShell", () => {
  it("renders skip link → header → main → footer landmarks, main as the skip target", () => {
    render(
      <SiteShell>
        <SiteShellHeader>nav</SiteShellHeader>
        <SiteShellMain>body</SiteShellMain>
        <SiteShellFooter>foot</SiteShellFooter>
      </SiteShell>,
    );
    const skip = screen.getByRole("link", { name: "Skip to main content" });
    expect(skip).toHaveAttribute("href", "#main-content");
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
    expect(main).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("banner")).toHaveTextContent("nav");
    expect(screen.getByRole("contentinfo")).toHaveTextContent("foot");
    // Document order: the skip link is the first focusable thing.
    const root = screen.getByRole("main").parentElement as HTMLElement;
    expect(root.firstElementChild).toBe(skip);
  });

  it("header is sticky by default with a surface; sticky={false} opts out", () => {
    const { rerender } = render(
      <SiteShell>
        <SiteShellHeader>nav</SiteShellHeader>
      </SiteShell>,
    );
    const header = screen.getByRole("banner");
    expect(header).toHaveClass("sticky", "top-0", "backdrop-blur");
    expect(header).toHaveAttribute("data-sticky");

    rerender(
      <SiteShell>
        <SiteShellHeader sticky={false}>nav</SiteShellHeader>
      </SiteShell>,
    );
    expect(screen.getByRole("banner")).not.toHaveClass("sticky");
    expect(screen.getByRole("banner")).not.toHaveAttribute("data-sticky");
  });

  it("asChild makes the child the sticky header and leaves its surface alone", () => {
    render(
      <SiteShell>
        <SiteShellHeader asChild>
          <header className="bg-background" data-testid="own">
            nav
          </header>
        </SiteShellHeader>
      </SiteShell>,
    );
    expect(document.querySelectorAll("header")).toHaveLength(1);
    const header = screen.getByTestId("own");
    expect(header).toHaveClass("sticky", "bg-background");
    expect(header).not.toHaveClass("backdrop-blur");
  });

  it("mainId retargets both the skip link and main", () => {
    render(
      <SiteShell mainId="site-body">
        <SiteShellMain>body</SiteShellMain>
      </SiteShell>,
    );
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute(
      "href",
      "#site-body",
    );
    expect(screen.getByRole("main")).toHaveAttribute("id", "site-body");
  });

  it("merges className and spreads props on every part", () => {
    render(
      <SiteShell className="root-x" data-testid="root">
        <SiteShellHeader className="h-x" data-testid="h">
          nav
        </SiteShellHeader>
        <SiteShellMain className="m-x">body</SiteShellMain>
        <SiteShellFooter className="f-x">foot</SiteShellFooter>
      </SiteShell>,
    );
    expect(screen.getByTestId("root")).toHaveClass("root-x", "min-h-svh");
    expect(screen.getByTestId("h")).toHaveClass("h-x", "sticky");
    expect(screen.getByRole("main")).toHaveClass("m-x", "flex-1");
    expect(screen.getByRole("contentinfo")).toHaveClass("f-x");
  });
});
