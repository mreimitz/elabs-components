/**
 * terminal-banner.test.tsx — smoke + structural lock for the launch card
 * above an empty transcript (#117 T7).
 *
 * The load-bearing assertions here are the ANNOUNCED STRUCTURE — a real
 * heading, the capability/what's-new lists as real `<ul>`/`<li>` lists, and
 * the quick actions as real controls with accessible names — not that two
 * class strings differ, which would pass on markup that merely LOOKS right
 * and prove nothing (`.claude/rules/accessibility.md` § "Colour is never the
 * only channel"; the same reasoning extends to structure here).
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TerminalBanner } from "./terminal-banner";

describe("TerminalBanner", () => {
  it("renders a deliberate, non-broken card from title alone", () => {
    render(<TerminalBanner title="brand-ui Agent" />);
    expect(screen.getByRole("heading", { name: "brand-ui Agent" })).toBeInTheDocument();
    // No section scaffolding for the sections that were never given data.
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByRole("group")).toBeNull();
  });

  it("renders nothing at all when every slot is omitted, without throwing", () => {
    const { container } = render(<TerminalBanner />);
    expect(container.querySelector("[data-slot='terminal-banner']")).toBeInTheDocument();
    expect(container.querySelector("[data-slot='terminal-banner-identity']")).toBeNull();
  });

  it("announces the title as a REAL heading, not a fieldset/legend border trick", () => {
    render(<TerminalBanner title="Codename" level={2} />);
    const heading = screen.getByRole("heading", { level: 2, name: "Codename" });
    expect(heading.tagName).toBe("H2");
    // The upstream `<fieldset>`/`<legend>` mechanism this deliberately avoids —
    // it would misreport a decorative title as a form-control group.
    expect(document.querySelector("fieldset")).toBeNull();
    expect(document.querySelector("legend")).toBeNull();
  });

  it("joins model and version in the identity meta line", () => {
    render(<TerminalBanner title="Agent" model="gpt-5.1-codex" version="v2.4.0" />);
    expect(screen.getByText("gpt-5.1-codex · v2.4.0")).toBeInTheDocument();
  });

  it("renders capabilities as a REAL list, named by its own caption", () => {
    render(
      <TerminalBanner
        capabilities={[
          { label: "Web search", description: "Look things up" },
          { label: "Run code" },
        ]}
      />,
    );
    const list = screen.getByRole("list", { name: "Capabilities" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(list).getByText("Web search")).toBeInTheDocument();
    expect(within(list).getByText("Look things up")).toBeInTheDocument();
  });

  it("renders what's new as a REAL list, with a link only when href is given", () => {
    render(
      <TerminalBanner
        whatsNew={[
          { label: "Faster file search", href: "https://example.com/notes" },
          { label: "Fixed a bug" },
        ]}
      />,
    );
    const list = screen.getByRole("list", { name: "What’s new" });
    expect(within(list).getByRole("link", { name: "Faster file search" })).toHaveAttribute(
      "href",
      "https://example.com/notes",
    );
    expect(within(list).getByText("Fixed a bug")).toBeInTheDocument();
    expect(within(list).queryByRole("link", { name: "Fixed a bug" })).toBeNull();
  });

  it("renders quick actions as REAL controls with accessible names that include the key hint", () => {
    const onSelect = vi.fn();
    render(
      <TerminalBanner
        quickActions={[
          { label: "New chat", keyHint: "⌘N", onSelect },
          { label: "Continue previous session" },
        ]}
      />,
    );
    const group = screen.getByRole("group", { name: "Quick actions" });
    const button = within(group).getByRole("button", { name: "New chat ⌘N" });
    button.click();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(
      within(group).getByRole("button", { name: "Continue previous session" }),
    ).toBeInTheDocument();
  });

  it("wraps a long workspace path instead of truncating it — the full value stays reachable", () => {
    const longPath = "~/Documents/very/long/nested/workspace/path/that/keeps/going/on/purpose";
    render(<TerminalBanner workspace={longPath} />);
    const workspace = screen.getByText(longPath);
    expect(workspace.className).toContain("break-words");
    expect(workspace.className).not.toContain("truncate");
    // The full string is a real text node in the DOM — nothing was clipped.
    expect(workspace.textContent).toBe(longPath);
  });

  it("lets a caller-supplied logo render without ever importing a vendor mark", () => {
    render(<TerminalBanner title="Agent" logo={<svg data-testid="custom-logo" />} />);
    expect(screen.getByTestId("custom-logo")).toBeInTheDocument();
  });

  it("inherits marker by default and lets a caller override the variant for its own rows", () => {
    const { container } = render(
      <TerminalBanner capabilities={[{ label: "Web search" }]} variant="rail" />,
    );
    const row = container.querySelector("[data-slot='terminal-row']");
    expect(row).toHaveAttribute("data-variant", "rail");
  });
});
