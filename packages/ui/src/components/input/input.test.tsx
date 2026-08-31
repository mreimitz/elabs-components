import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "./input";

describe("Input", () => {
  it("accepts typed text", async () => {
    render(<Input aria-label="email" />);
    const el = screen.getByLabelText<HTMLInputElement>("email");
    await userEvent.type(el, "hi");
    expect(el.value).toBe("hi");
  });

  it("is disabled when disabled prop is set", () => {
    render(<Input aria-label="email" disabled />);
    const el = screen.getByLabelText<HTMLInputElement>("email");
    expect(el).toBeDisabled();
  });

  it("applies text-foreground class to ensure text color is not inherited from parent", () => {
    // Render Input inside a container with a different text color (simulating sidebar)
    render(
      <div className="text-sidebar-foreground">
        <Input aria-label="search" />
      </div>,
    );
    const el = screen.getByLabelText<HTMLInputElement>("search");
    // Verify that the Input element has the text-foreground class
    // This ensures its text color is explicitly set and not inherited
    expect(el.className).toContain("text-foreground");
  });
});
