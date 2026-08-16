import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sandbox, SandboxContent, SandboxHeader } from "./sandbox";

describe("Sandbox", () => {
  it("renders its header and content", () => {
    render(
      <Sandbox>
        <SandboxHeader title="Python sandbox" state="output-available" />
        <SandboxContent>Real output</SandboxContent>
      </Sandbox>,
    );
    expect(screen.getByText("Python sandbox")).toBeInTheDocument();
    expect(screen.getByText("Real output")).toBeInTheDocument();
  });
});

describe("Sandbox loading (#269, loading-states.md)", () => {
  it("renders a skeleton in SandboxContent while loading — header keeps rendering", () => {
    const { container } = render(
      <Sandbox loading>
        <SandboxHeader title="Python sandbox" state="input-streaming" />
        <SandboxContent>Real output — should not render while loading</SandboxContent>
      </Sandbox>,
    );
    expect(screen.getByText("Python sandbox")).toBeInTheDocument();
    expect(screen.queryByText(/Real output/)).not.toBeInTheDocument();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    const statuses = container.querySelectorAll('[role="status"]');
    expect(statuses).toHaveLength(1);
    expect(statuses[0]).toHaveAttribute("aria-live", "polite");
  });

  it("renders the real content once loading clears", () => {
    render(
      <Sandbox>
        <SandboxContent>Real output</SandboxContent>
      </Sandbox>,
    );
    expect(screen.getByText("Real output")).toBeInTheDocument();
  });
});
