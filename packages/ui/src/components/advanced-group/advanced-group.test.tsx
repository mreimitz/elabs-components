import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdvancedGroup } from "./advanced-group";

describe("AdvancedGroup", () => {
  it("is collapsed by default and hides its content", () => {
    render(
      <AdvancedGroup>
        <p>Retry budget</p>
      </AdvancedGroup>,
    );
    const trigger = screen.getByRole("button", { name: /advanced/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Retry budget")).not.toBeInTheDocument();
  });

  it("summarises non-default values while collapsed, then drops the summary", async () => {
    const user = userEvent.setup();
    render(
      <AdvancedGroup changedCount={3}>
        <p>Retry budget</p>
      </AdvancedGroup>,
    );
    expect(screen.getByText("3 changed")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /advanced/i }));

    expect(screen.getByText("Retry budget")).toBeInTheDocument();
    expect(screen.queryByText("3 changed")).not.toBeInTheDocument();
  });

  it("shows no summary when nothing changed", () => {
    render(<AdvancedGroup changedCount={0}>content</AdvancedGroup>);
    expect(screen.queryByText(/changed/)).not.toBeInTheDocument();
  });

  it("prefers an explicit summary node over changedCount", () => {
    render(
      <AdvancedGroup changedCount={3} summary="Using a custom endpoint">
        content
      </AdvancedGroup>,
    );
    expect(screen.getByText("Using a custom endpoint")).toBeInTheDocument();
    expect(screen.queryByText("3 changed")).not.toBeInTheDocument();
  });

  it("honours defaultOpen", () => {
    render(<AdvancedGroup defaultOpen>Retry budget</AdvancedGroup>);
    expect(screen.getByRole("button", { name: /advanced/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("stays controlled: a click reports out but never self-toggles", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <AdvancedGroup open={false} onOpenChange={onOpenChange} changedCount={2}>
        <p>Retry budget</p>
      </AdvancedGroup>,
    );

    await user.click(screen.getByRole("button", { name: /advanced/i }));

    expect(onOpenChange).toHaveBeenCalledWith(true);
    // The owner did not move `open`, so the group must not have opened itself —
    // a controlled component never flips to uncontrolled.
    expect(screen.getByRole("button", { name: /advanced/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByText("2 changed")).toBeInTheDocument();
  });

  it("takes a custom title", () => {
    render(<AdvancedGroup title="Developer options">content</AdvancedGroup>);
    expect(screen.getByRole("button", { name: /developer options/i })).toBeInTheDocument();
  });
});
