import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionHeader } from "./session-header";

const CAPABILITIES = [
  { label: "Web search", description: "Look things up while we talk." },
  { label: "Code execution" },
];

const WHATS_NEW = [{ label: "Faster file search", href: "https://example.com/changelog" }];

const QUICK_ACTIONS = [
  { label: "New chat", keyHint: "⌘N" },
  { label: "Open workspace", keyHint: "⌘O" },
  { label: "Settings" },
];

describe("SessionHeader", () => {
  it("renders only the title with no empty sections or stray separators (acceptance criterion)", () => {
    const { container } = render(<SessionHeader title="Codex" />);

    expect(screen.getByRole("heading")).toHaveTextContent("Codex");

    // No section for a prop that was never supplied.
    expect(container.querySelector('[data-slot="session-header-meta"]')).toBeNull();
    expect(container.querySelector('[data-slot="session-header-workspace"]')).toBeNull();
    expect(container.querySelector('[data-slot="session-header-capabilities"]')).toBeNull();
    expect(container.querySelector('[data-slot="session-header-whats-new"]')).toBeNull();
    expect(container.querySelector('[data-slot="session-header-quick-actions"]')).toBeNull();

    // No separator is ever rendered by this component — nothing left "stray"
    // when the sections around it are absent.
    expect(container.querySelector('[role="separator"]')).toBeNull();
    expect(screen.queryByRole("separator")).toBeNull();

    // No list/group scaffolding renders without content behind it.
    expect(container.querySelectorAll("ul")).toHaveLength(0);
    expect(container.querySelector('[role="group"]')).toBeNull();
  });

  it("renders nothing at all — not even the identity row — with no props supplied", () => {
    const { container } = render(<SessionHeader />);

    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("data-slot", "session-header");
    expect(root.querySelector('[data-slot="session-header-identity"]')).toBeNull();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("renders every quick action as a focusable button reachable by role and accessible name", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const quickActions = [
      { label: "New chat", keyHint: "⌘N", onSelect },
      ...QUICK_ACTIONS.slice(1),
    ];

    render(
      <SessionHeader
        title="Codex"
        model="gpt-5.1-codex"
        workspace="~/dev/acme/api-gateway"
        version="v2.4.0"
        capabilities={CAPABILITIES}
        whatsNew={WHATS_NEW}
        quickActions={quickActions}
      />,
    );

    for (const action of quickActions) {
      const button = screen.getByRole("button", { name: new RegExp(action.label) });
      expect(button.tagName).toBe("BUTTON");
    }

    await user.click(screen.getByRole("button", { name: /New chat/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("renders shortcut hints via the Kbd primitive", () => {
    render(<SessionHeader title="Codex" quickActions={QUICK_ACTIONS} />);

    const button = screen.getByRole("button", { name: /New chat/ });
    expect(button.querySelector("kbd")).toHaveTextContent("⌘N");
  });

  it("renders model and version together, separated, when both are supplied", () => {
    render(<SessionHeader title="Codex" model="gpt-5.1-codex" version="v2.4.0" />);

    expect(screen.getByText("gpt-5.1-codex · v2.4.0")).toBeInTheDocument();
  });

  it("truncates a long workspace path instead of overflowing", () => {
    const workspace =
      "~/dev/acme/monorepo/services/platform/billing/api-gateway/src/handlers/webhooks";
    const { container } = render(<SessionHeader title="Codex" workspace={workspace} />);

    const workspaceRow = container.querySelector('[data-slot="session-header-workspace"]');
    const label = workspaceRow?.querySelector("span");
    expect(label).toHaveTextContent(workspace);
    expect(label?.className.split(" ")).toEqual(
      expect.arrayContaining(["truncate", "min-w-0", "flex-1"]),
    );
  });

  it("defaults to a level-2 heading and honors an explicit level override", () => {
    const { rerender } = render(<SessionHeader title="Codex" />);
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();

    rerender(<SessionHeader title="Codex" level={3} />);
    expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  });

  it("renders capability and what's-new list items only when their arrays are non-empty", () => {
    render(<SessionHeader title="Codex" capabilities={CAPABILITIES} whatsNew={WHATS_NEW} />);

    expect(screen.getByText("Web search")).toBeInTheDocument();
    expect(screen.getByText("Look things up while we talk.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Faster file search" })).toHaveAttribute(
      "href",
      "https://example.com/changelog",
    );
  });

  it("merges a custom className onto the root", () => {
    const { container } = render(<SessionHeader title="Codex" className="custom-class" />);

    expect(container.firstElementChild).toHaveClass("custom-class");
  });

  it("forwards a ref to the root element", () => {
    const ref = vi.fn();
    render(<SessionHeader ref={ref} title="Codex" />);

    expect(ref).toHaveBeenCalledWith(expect.any(HTMLDivElement));
  });
});
